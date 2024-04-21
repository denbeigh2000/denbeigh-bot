import { Snowflake } from "discord-api-types/v10";

import { Sentry } from "@bot/sentry";
import { getOne, GetResult, replaceOne, upsertOne, UpsertResult } from "./queries";

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
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
}

export class TokenStore {
    key: CryptoKey;
    db: D1Database;
    sentry: Sentry;
    decoder: TextDecoder = new TextDecoder();
    encoder: TextEncoder = new TextEncoder();

    constructor(key: CryptoKey, db: D1Database, sentry: Sentry) {
        this.key = key;
        this.db = db;
        this.sentry = sentry;
    }

    private iv(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(12));
    }

    private async decrypt(data: Uint8Array, iv: Uint8Array): Promise<string> {
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, this.key, data);
        return this.decoder.decode(decrypted);
    }

    private async encrypt(iv: Uint8Array, secret: string): Promise<ArrayBuffer> {
        const encoded = this.encoder.encode(secret);
        return await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            this.key,
            encoded,
        );
    }

    private async encryptInfo(info: DiscordAuthInfo): Promise<StorageData> {
        const iv = this.iv();
        const [encryptedToken, encryptedRefreshToken] = await Promise.all([
            this.encrypt(iv, info.accessToken),
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

    private async decryptInfo(data: GetResult): Promise<DiscordAuthInfo> {
        const iv_ = new Uint8Array(data.iv);
        const accessToken_ = new Uint8Array(data.encrypted_token);
        const refreshToken_ = new Uint8Array(data.encrypted_refresh_token);
        const [accessToken, refreshToken] = await Promise.all([
            this.decrypt(accessToken_, iv_),
            this.decrypt(refreshToken_, iv_),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresAt: new Date(data.expires_at),
        };
    }

    // NOTE: this is kinda a weird function, but it abstracts away the common
    // logic on upsert/replace of:
    // - decrypt the old value
    // - check to see if it's the same as the new value
    // - if it's not, return the old value so we can explicitly call revoke on it
    private async decryptOldPartial(newToken: string, data: UpsertResult): Promise<string | null> {
        if (!data.old_iv || !data.old_encrypted_token) {
            return null;
        }

        // TODO: need to catch exceptions(??)
        const token = new Uint8Array(data.old_encrypted_token);
        const iv = new Uint8Array(data.old_iv);
        const oldToken = await this.decrypt(token, iv);
        if (oldToken !== newToken) {
            return oldToken;
        }

        return null;
    }

    public async get(userId: string): Promise<DiscordAuthInfo | null> {
        const stmt = this.db.prepare(getOne).bind(userId);

        const { error, results } = await stmt.all<GetResult>();
        if (error) {
            this.sentry.captureMessage("failed to get user", "error", { originalException: error });
            throw error;
        }

        if (!results || !results[0]) {
            return null;
        }
        return this.decryptInfo(results[0]);
    }

    public async upsert(userID: Snowflake, info: DiscordAuthInfo): Promise<string | null> {
        const data = await this.encryptInfo(info);
        const stmt = this.db.prepare(upsertOne).bind(
            userID,
            data.encrypted_token,
            data.encrypted_refresh_token,
            data.iv,
            data.expires_at,
        );
        const { error, results } = await stmt.all<UpsertResult>();

        if (error) {
            this.sentry.captureMessage("failed to upsert access token", "error", { originalException: error });
            throw new Error("not able to insert new access token");
        }

        if (!results)
            return null;

        const result = results[0];
        if (!result || !result.old_iv || !result.old_encrypted_token) {
            return null;
        }
        // TODO: need to catch exceptions(??)
        return await this.decryptOldPartial(info.accessToken, result);
    }

    public async replace(userId: Snowflake, info: DiscordAuthInfo): Promise<string | null> {
        const data = await this.encryptInfo(info);
        const stmt = this.db
            .prepare(replaceOne)
            .bind(data.encrypted_token, data.encrypted_refresh_token, data.iv, data.expires_at, userId);
        const { error, results } = await stmt.all<UpsertResult>();

        if (error) {
            this.sentry.captureMessage("failed to update stored token", "error", { originalException: error });
            throw new Error("not able to replace access token");
        }

        if (!results) {
            return null;
        }

        // TODO: need to catch exceptions(??)
        return await this.decryptOldPartial(info.accessToken, results[0]);
    }
}
