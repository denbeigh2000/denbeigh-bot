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

    private async encode(accessToken: string): Promise<string> {
        // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
        const tokenBuffer = new TextEncoder().encode(accessToken);
        const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    private iv(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(12));
    }

    private async decrypt(data: ArrayBuffer, iv: Uint8Array): Promise<string> {
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCR", iv }, this.key, data);
        return new TextDecoder().decode(decrypted);
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
        const parsedIv = new Uint8Array(data.iv);
        const [decryptedToken, decryptedRefreshToken] = await Promise.all([
            this.decrypt(data.encrypted_token, parsedIv),
            this.decrypt(data.encrypted_refresh_token, parsedIv),
        ]);

        return {
            token: decryptedToken,
            refreshToken: decryptedRefreshToken,
            expiresAt: new Date(data.expires_at),
        };
    }

    public async get(userId: string): Promise<DiscordAuthInfo | null> {
        const fetched: D1ResultOne = await this.qb.fetchOne({
            tableName: TABLE_NAME,
            fields: ["refresh_token", "expires_at", "user"],
            where: {
                conditions: "user_id = ?1",
                params: [userId],
            },
        }).execute();

        const { results } = fetched;
        if (!results) {
            return null;
        }

        // const { token, refreshToken, expiresAt, iv } = results;
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

    public async upsert(userID: Snowflake, info: DiscordAuthInfo): Promise<ArrayBuffer | null> {
        // TODO: this needs to change to encrypt instead
        //const hashedToken = await this.encode(accessToken);
        const data = await this.encryptInfo(info);

        const result = await this.qb.insert({
            tableName: TABLE_NAME,
            data: {
                user: userID,
                // @ts-ignore: don't worry, this is just blindly passed to D1,
                // which does accept ArrayBuffers as parameters.
                encrypted_token: data.encrypted_token,
                // @ts-ignore: see above
                encrypted_refresh_token: encryptedRefreshToken,
                // @ts-ignore: see above
                iv: data.iv,
                expires_at: data.expires_at,
            },
            onConflict: {
                column: "user_id",
                data: {
                    encrypted_refresh_token: new Raw("excluded.encrypted_refresh_token"),
                    encrypted_token: new Raw("excluded.encrypted_token"),
                    iv: new Raw("excluded.iv"),
                    expires_at: new Raw("excluded.expires_at"),
                    old_encrypted_token: new Raw("encrypted_token"),
                },
            },
            returning: "encrypted_token",
        }).execute();

        if (result.results && result.results[0]) {
            // TODO: need to confirm this type
            console.debug(result.results);
            return result.results[0] as ArrayBuffer;
        }

        return null;
    }

    public async replace(userId: Snowflake, info: DiscordAuthInfo) {
        // const oldHashedToken = await this.encode(oldToken);
        // const hashedToken = await this.encode(newToken);
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
                conditions: "user_id = ?1",
                params: [userId],
            },
            returning: "encrypted_token",
        }).execute();

        if (!updated.success) {
            this.sentry.captureMessage("failed to update stored token", "error");
        }

        if (updated.results) {

        }

        if (!deleted.success) {
            this.sentry.captureMessage("failed to delete old token hash", "info");
        }
    }
}

