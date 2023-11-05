import { parse as parseCookie } from "cookie";
import { OAuth2Scopes } from "discord-api-types/payloads/v10";
import { uuid } from "@cfworker/uuid";

import { UserClient } from "./discord";
import { Sentry } from "./sentry";
import { D1QB, D1ResultOne, D1Result, Raw } from "workers-qb";
import { Snowflake } from "discord-api-types/globals";
import { Routes } from "discord-api-types/v10";

const SCOPES = [OAuth2Scopes.Identify, OAuth2Scopes.GuildsJoin, OAuth2Scopes.RoleConnectionsWrite];
const STATE_TTL_SEC = 10 * 60;

export async function tokenStorageKey(accessToken: string): Promise<string> {
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
    const tokenBuffer = new TextEncoder().encode(accessToken);
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getAuthToken(req: Request): string | null {
    const cookieStr = req.headers.get("Cookie");
    if (!cookieStr) {
        return null;
    }

    return parseCookie(cookieStr)["auth"] || null;
}

export interface AccessTokenResponse {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    refreshToken: string;
    scope: string[];
    user: Snowflake;
}

export class OAuthClient {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    store: OAuthStore;
    stateStore: KVNamespace;
    sentry: Sentry;

    constructor(
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        store: OAuthStore,
        stateStore: KVNamespace,
        sentry: Sentry
    ) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.store = store;
        this.stateStore = stateStore;
        this.sentry = sentry;
    }

    public async getRefreshOrAuthorise(
        req: Request
    ): Promise<Response | string> {
        const givenToken = getAuthToken(req);
        if (!givenToken) {
            return this.authorise();
        }

        const token = await this.checkToken(givenToken);
        if (!token) {
            return this.authorise();
        }

        const path = new URL(req.url).pathname;

        if (token !== givenToken) {
            // We refreshed our token, load again with new token
            return new Response("", {
                status: 302,
                headers: {
                    Location: path,
                    "Set-Cookie": `auth=${token}`,
                },
            });
        }

        return token;
    }

    public async checkState(
        state: string
    ): Promise<boolean> {
        const stateKey = `state:${state}`;
        const stateValue = await this.stateStore.get(stateKey);
        if (stateValue === undefined) {
            return false;
        }

        await this.stateStore.delete(stateKey);
        return true;
    }

    public async authorise(): Promise<Response> {
        const state = uuid().toString();
        await this.stateStore.put(`state:${state}`, "OK", {
            expirationTtl: STATE_TTL_SEC,
        });


        const url = new URL(Routes.oauth2Authorization());
        const params = new URLSearchParams([
            ["response_type", "code"],
            ["client_id", this.clientId.toString()],
            ["scope", SCOPES.join(" ")],
            ["state", state],
            ["redirect_uri", this.redirectUri],
            ["prompt", "none"],
        ]);
        url.search = params.toString();

        return Response.redirect(url.toString());
    }

    public async getToken(code: string): Promise<AccessTokenResponse | null> {
        const request = new Request(Routes.oauth2TokenExchange(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: "authorization_code",
                code,
                redirect_uri: this.redirectUri,
            }),
        });
        const response = await fetch(request);

        const text = await response.text();
        if (response.status >= 400) {
            console.log(`Error: status ${response.status}, ${text}`);
            return null;
        }

        const token = await this.upsertToken(text);
        this.sentry.logGetToken(request, response);
        return token;
    }

    public async checkToken(token: string): Promise<string | null> {
        const record = await this.store.get(token);
        if (!record) {
            return null;
        }

        const { refreshToken, expiresAt } = record;
        if (expiresAt > new Date()) {
            // TODO: Cache user info in KV
            // this.sentry.setUser(user);

            // Token is fine, return it.
            return token;
        }

        // Refresh token, save to store
        const newToken = await this.refreshToken(token, refreshToken);
        if (!newToken) {
            return null;
        }

        // Delete record of old token
        await this.store.replace(newToken.accessToken, token, { refreshToken, expiresAt, user: newToken.user, });

        // Return refreshed token
        return newToken.accessToken;
    }

    private async refreshToken(
        oldAccessToken: string,
        refreshToken: string
    ): Promise<AccessTokenResponse | null> {
        const request = new Request(Routes.oauth2TokenExchange(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            // NOTE: TS won't let us cast the typed object of this body back to
            // a Record<string, string>
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
        });

        const response = await fetch(request);
        const text = await response.text();
        if (response.status >= 400) {
            console.log(`Error: status ${response.status}, ${text}`);
            return null;
        }

        const token = await this.parseRefreshRseponseAndFetchUserId(text);
        // TODO: Store something more useful than the user ID?
        await this.store.replace(oldAccessToken, token.accessToken, {
            expiresAt: new Date(token.expiresAt),
            refreshToken: token.refreshToken,
            user: token.user,
        });

        this.sentry.logRefresh(request, response);

        return token;
    }

    private async upsertToken(text: string): Promise<AccessTokenResponse | null> {
        const tokenInfo = await this.parseRefreshRseponseAndFetchUserId(text);
        const expiresAtDate = new Date(tokenInfo.expiresAt);

        // NOTE: we may now need to set our user in sentry now
        await this.store.upsert(
            tokenInfo.accessToken,
            { expiresAt: expiresAtDate, refreshToken: tokenInfo.refreshToken, user: tokenInfo.user },
        );

        return tokenInfo;
    }

    // TODO: Remove the user fetch from this or do something with the info
    private async parseRefreshRseponseAndFetchUserId(responseText: string): Promise<AccessTokenResponse> {
        const data = JSON.parse(responseText);
        const expiresIn = data["expires_in"];
        const expiresAt = Date.now() + expiresIn * 1000;
        const accessToken = data["access_token"];
        const refreshToken = data["refresh_token"];

        const client = new UserClient(accessToken, this.sentry);
        const user = await client.getUserInfo();
        if (!user) {
            throw new Error("token from refresh invalid");
        }
        this.sentry.setUser(user);

        return {
            accessToken,
            refreshToken,
            tokenType: data["token_type"],
            expiresAt,
            scope: data["scope"].split(" "),
            user: user.id,
        };
    }
}

interface OAuthRecord {
    refreshToken: string,
    expiresAt: Date,
    user: Snowflake,
}

const OAUTH_TABLE_NAME = "oauth";

export class OAuthStore {
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
            tableName: OAUTH_TABLE_NAME,
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

        this.qb.insert({
            tableName: OAUTH_TABLE_NAME,
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
                    user: new Raw("record.user"),
                },
            },
        });
    }

    public async replace(oldToken: string, newToken: string, newRecord: OAuthRecord) {
        const oldHashedToken = await this.encode(oldToken);
        const hashedToken = await this.encode(newToken);

        const inserted: D1Result = await this.qb.insert({
            tableName: OAUTH_TABLE_NAME,
            data: {
                access_token_hash: hashedToken,
                refresh_token: newRecord.refreshToken,
                expires_at: Number(newRecord.expiresAt),
                user: newRecord.user,
            },
        })
            .execute();

        if (!inserted.success) {
            this.sentry.sendMessage("failed to insert new token record");
        }

        const deleted: D1Result = await this.qb.delete({
            tableName: OAUTH_TABLE_NAME,
            where: {
                conditions: "access_token_hash = ?1",
                params: [oldHashedToken],
            },
        })
            .execute();

        if (!deleted.success) {
            this.sentry.sendMessage("failed to delete old token hash", "info");
        }
    }
}
