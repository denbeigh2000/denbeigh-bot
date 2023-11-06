import { Snowflake } from "discord-api-types/v10";
import { D1QB, D1Result, D1ResultOne, Raw } from "workers-qb";

import { Sentry } from "../../sentry";

const TABLE_NAME = "oauth";

export interface OAuthRecord {
    refreshToken: string,
    expiresAt: Date,
    user: Snowflake,
}

export class TokenStore {
    qb: D1QB;
    sentry: Sentry;

    constructor(db: D1Database, sentry: Sentry) {
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

    public async get(accessToken: string): Promise<OAuthRecord | null> {
        const hashedToken = await this.encode(accessToken);
        const fetched: D1ResultOne = await this.qb.fetchOne({
            tableName: TABLE_NAME,
            fields: ["refresh_token", "expires_at", "user"],
            where: {
                conditions: "access_token_hash = ?1",
                params: [hashedToken],
            },
        }).execute();

        const { results } = fetched;
        if (!results) {
            return null;
        }

        return {
            refreshToken: results.refresh_token as string,
            expiresAt: new Date(results.expires_at as number),
            user: results.user as Snowflake,
        };
    }

    public async upsert(accessToken: string, record: OAuthRecord) {
        const hashedToken = await this.encode(accessToken);
        const expiresNum = Number(record.expiresAt);

        await this.qb.insert({
            tableName: TABLE_NAME,
            data: {
                access_token_hash: hashedToken,
                refresh_token: record.refreshToken,
                expires_at: expiresNum,
                user: record.user,
            },
            onConflict: {
                column: "access_token_hash",
                data: {
                    refresh_token: new Raw("excluded.refresh_token"),
                    expires_at: new Raw("excluded.expires_at"),
                    user: new Raw("excluded.user"),
                },
            },
        }).execute();
    }

    public async replace(oldToken: string, newToken: string, newRecord: OAuthRecord) {
        const oldHashedToken = await this.encode(oldToken);
        const hashedToken = await this.encode(newToken);

        const inserted: D1Result = await this.qb.insert({
            tableName: TABLE_NAME,
            data: {
                access_token_hash: hashedToken,
                refresh_token: newRecord.refreshToken,
                expires_at: Number(newRecord.expiresAt),
                user: newRecord.user,
            },
        })
            .execute();

        if (!inserted.success) {
            this.sentry.captureMessage("failed to insert new token record", "error");
        }

        const deleted: D1Result = await this.qb.delete({
            tableName: TABLE_NAME,
            where: {
                conditions: "access_token_hash = ?1",
                params: [oldHashedToken],
            },
        })
            .execute();

        if (!deleted.success) {
            this.sentry.captureMessage("failed to delete old token hash", "info");
        }
    }
}

