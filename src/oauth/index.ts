import { parse as parseCookie } from "cookie";
import { OAuth2Scopes } from "discord-api-types/payloads/v10";
import { Snowflake } from "discord-api-types/globals";
import { Routes } from "discord-api-types/v10";

import { UserClient } from "../discord";
import { Sentry } from "../sentry";
import { TokenStore } from "./tokenstore";
import { StateStore } from "./statestore";

const API_BASE_URL = "https://discordapp.com/api"

const SCOPES = [OAuth2Scopes.Identify, OAuth2Scopes.GuildsJoin, OAuth2Scopes.RoleConnectionsWrite];

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
    tokenStore: TokenStore;
    stateStore: StateStore;
    sentry: Sentry;

    constructor(
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        tokenDB: D1Database,
        stateKV: KVNamespace,
        sentry: Sentry
    ) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.tokenStore = new TokenStore(tokenDB, sentry);
        this.stateStore = new StateStore(stateKV);
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
        return await this.stateStore.checkRedirect(state);
    }

    public async authorise(): Promise<Response> {
        const state = await this.stateStore.createState();
        const url = new URL(API_BASE_URL + Routes.oauth2Authorization());
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
        const request = new Request(API_BASE_URL + Routes.oauth2TokenExchange(), {
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
        this.sentry.breadcrumbFromHTTP("getting oauth token", request.url, response);
        this.sentry.captureMessage("getting discord token", "debug");

        const text = await response.text();
        if (response.status >= 400) {
            console.log(`Error: status ${response.status}, ${text}`);
            return null;
        }

        const token = await this.upsertToken(text);
        return token;
    }

    public async checkToken(token: string): Promise<string | null> {
        const record = await this.tokenStore.get(token);
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

        // Return refreshed token
        return newToken.accessToken;
    }

    private async refreshToken(
        oldAccessToken: string,
        refreshToken: string
    ): Promise<AccessTokenResponse | null> {
        const request = new Request(API_BASE_URL + Routes.oauth2TokenExchange(), {
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
        await this.tokenStore.replace(oldAccessToken, token.accessToken, {
            expiresAt: new Date(token.expiresAt),
            refreshToken: token.refreshToken,
            user: token.user,
        });

        this.sentry.breadcrumbFromHTTP("refreshing oauth token", request.url, response);

        return token;
    }

    private async upsertToken(text: string): Promise<AccessTokenResponse | null> {
        const tokenInfo = await this.parseRefreshRseponseAndFetchUserId(text);
        const expiresAtDate = new Date(tokenInfo.expiresAt);

        // NOTE: we may now need to set our user in sentry now
        await this.tokenStore.upsert(
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

