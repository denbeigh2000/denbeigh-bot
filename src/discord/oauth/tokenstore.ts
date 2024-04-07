import { Snowflake } from "discord-api-types/v10";
import { D1QB, D1Result, D1ResultOne, Raw } from "workers-qb";

import { Sentry } from "../../sentry";

const TABLE_NAME = "oauth";

export interface OAuthRecord {
    refreshToken: string,
    expiresAt: Date,
    user: Snowflake,
}

export interface EncryptedData {
    token: ArrayBuffer,
    refreshToken: ArrayBuffer,
    iv: Uint8Array,
}

interface StorageData {
    encrypted_token: ArrayBuffer,
    encrypted_refresh_token: ArrayBuffer,
    iv: ArrayBuffer,
    expires_at: number,
}

interface UpdatedTokenData {
    old_iv: ArrayBuffer,
    old_encrypted_token: ArrayBuffer,
}

export interface DiscordAuthInfo {
    token: string,
    refreshToken: string,
    expiresAt: Date,
}

export class TokenStore {
    key: CryptoKey;
    qb: D1QB;
    sentry: Sentry;

    constructor(key: CryptoKey, db: D1Database, sentry: Sentry) {
        this.key = key;
        this.qb = new D1QB(db);
        this.sentry = sentry;
    }

    private iv(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(12));
    }

    private async decrypt(data: Uint8Array, iv: Uint8Array): Promise<string> {
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, this.key, data);
        const s = new TextDecoder().decode(decrypted);
        return s;
    }

    private async encrypt(iv: Uint8Array, secret: string): Promise<ArrayBuffer> {
        const encoded = new TextEncoder().encode(secret);
        return await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            this.key,
            encoded,
        );
    }

    private async encryptInfo(info: DiscordAuthInfo): Promise<StorageData> {
        const iv = this.iv();
        const [encryptedToken, encryptedRefreshToken] = await Promise.all([
            this.encrypt(iv, info.token),
            this.encrypt(iv, info.refreshToken),
        ]);

        // https://stackoverflow.com/a/54646864
        const storedIv = iv.buffer.slice(iv.byteOffset, iv.byteLength + iv.byteOffset);

        return {
            encrypted_token: encryptedToken,
            encrypted_refresh_token: encryptedRefreshToken,
            expires_at: Number(info.expiresAt),
            iv: storedIv,
        };
    }

    private async decryptInfo(data: StorageData): Promise<DiscordAuthInfo> {
        const iv_ = new Uint8Array(data.iv);
        const token_ = new Uint8Array(data.encrypted_token);
        const refreshToken_ = new Uint8Array(data.encrypted_refresh_token);
        const [token, refreshToken] = await Promise.all([
            this.decrypt(token_, iv_),
            this.decrypt(refreshToken_, iv_),
        ]);

        return {
            token,
            refreshToken,
            expiresAt: new Date(data.expires_at),
        };
    }

    private async decryptOldPartial(data: UpdatedTokenData): Promise<string> {
        // TODO: need to catch exceptions(??)
        const token = new Uint8Array(data.old_encrypted_token);
        const iv = new Uint8Array(data.old_iv);
        return await this.decrypt(token, iv);
    }

    public async get(userId: string): Promise<DiscordAuthInfo | null> {
        const fetched: D1ResultOne = await this.qb.fetchOne({
            tableName: TABLE_NAME,
            fields: ["encrypted_token", "encrypted_refresh_token", "expires_at", "iv", "user"],
            where: {
                conditions: "user = ?1",
                params: [userId],
            },
        }).execute();

        const { results } = fetched;
        if (!results) {
            return null;
        }

        // @ts-ignore: iv should be an ArrayBuffer, if D1's docs are correct
        const iv = results.iv as ArrayBuffer;
        // @ts-ignore: iv should be an ArrayBuffer, if D1's docs are correct
        const encrypted_token = results.encrypted_token as ArrayBuffer;
        // @ts-ignore: iv should be an ArrayBuffer, if D1's docs are correct
        const encrypted_refresh_token = results.encrypted_refresh_token as ArrayBuffer;

        const expires_at = results.expires_at as number;

        return this.decryptInfo({
            encrypted_token,
            encrypted_refresh_token,
            iv: new Uint8Array(iv),
            expires_at,
        });
    }

    public async upsert(userID: Snowflake, info: DiscordAuthInfo): Promise<string | null> {
        const data = await this.encryptInfo(info);

        const updated = await this.qb.insert({
            tableName: TABLE_NAME,
            data: {
                user: userID,
                // @ts-ignore: don't worry, this is just blindly passed to D1,
                // which does accept ArrayBuffers as parameters.
                encrypted_token: data.encrypted_token,
                // @ts-ignore: see above
                encrypted_refresh_token: data.encrypted_refresh_token,
                // @ts-ignore: see above
                iv: data.iv,
                expires_at: data.expires_at,
            },
            onConflict: {
                column: "user",
                data: {
                    encrypted_refresh_token: new Raw("excluded.encrypted_refresh_token"),
                    encrypted_token: new Raw("excluded.encrypted_token"),
                    iv: new Raw("excluded.iv"),
                    expires_at: new Raw("excluded.expires_at"),
                    // Write the overwritten values to a new column, otherwise
                    // we can't use them in our RETURNING clause
                    old_encrypted_token: new Raw("encrypted_token"),
                    old_iv: new Raw("iv"),
                },
            },
            returning: ["old_encrypted_token", "old_iv"]
        }).execute();

        if (!updated.success) {
            this.sentry.captureMessage("failed to upsert access token", "error");
            throw new Error("not able to insert new access token");
        }

        if (updated.results && updated.results["old_encrypted_token"]) {
            // TODO: need to catch exceptions(??)
            const old = await this.decryptOldPartial(updated.results);
            // NOTE: Because discord can give us the same token when a user
            // re-authorises, we need to make sure we do not revoke a
            // still-current token. Maybe we can improve this so we always use
            // the same IV?
            if (old !== info.token) {
                return old;
            }
        }

        return null;
    }

    public async replace(userId: Snowflake, info: DiscordAuthInfo): Promise<string | null> {
        const data = await this.encryptInfo(info);

        const updated: D1Result = await this.qb.update({
            tableName: TABLE_NAME,
            data: {
                // @ts-ignore: don't worry, this is just blindly passed to D1,
                // which does accept ArrayBuffers as parameters.
                encrypted_token: data.encrypted_token,
                // @ts-ignore: see above
                encrypted_refresh_token: encryptedRefreshToken,
                // @ts-ignore: see above
                iv: data.iv,
                expires_at: data.expires_at,
            },
            where: {
                conditions: "user = ?1",
                params: [userId],
            },
            returning: ["old_encrypted_token", "old_iv"],
        }).execute();

        if (!updated.success) {
            this.sentry.captureMessage("failed to update stored token", "error");
            throw new Error("not able to replace access token");
        }

        if (updated.results && updated.results["old_encrypted_token"]) {
            // TODO: need to catch exceptions(??)
            return await this.decryptOldPartial(updated.results as any);
        }

        return null;
    }
}
