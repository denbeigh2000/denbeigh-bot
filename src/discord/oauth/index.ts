import { parse as parseCookie } from "cookie";
import { OAuth2Scopes } from "discord-api-types/payloads/v10";
import { Snowflake } from "discord-api-types/globals";
import { Routes } from "discord-api-types/v10";

import { UserClient } from "../client";
import { Sentry } from "../../sentry";
import { TokenStore } from "./tokenstore";
import { StateStore } from "./statestore";

const API_BASE_URL = "https://discordapp.com/api"
export const AUTH_COOKIE_NAME = "session";

const SCOPES = [OAuth2Scopes.Identify, OAuth2Scopes.GuildsJoin, OAuth2Scopes.RoleConnectionsWrite];

export function getAuthToken(req: Request): string | null {
    const cookieStr = req.headers.get("Cookie");
    if (!cookieStr) {
        return null;
    }

    return parseCookie(cookieStr)[AUTH_COOKIE_NAME] || null;
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

    constructor(params: {
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        tokenKey: CryptoKey,
        tokenDB: D1Database,
        stateKV: KVNamespace,
        sentry: Sentry
    }) {
        this.clientId = params.clientId;
        this.clientSecret = params.clientSecret;
        this.redirectUri = params.redirectUri;
        this.tokenStore = new TokenStore(params.tokenKey, params.tokenDB, params.sentry);
        this.stateStore = new StateStore(params.stateKV);
        this.sentry = params.sentry;
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

    public async retrieveToken(userID: string): Promise<string | null> {
        const record = await this.tokenStore.get(userID);
        if (!record) {
            return null;
        }

        const { refreshToken, expiresAt } = record;
        if (expiresAt > new Date()) {
            // TODO: Cache user info in KV
            // this.sentry.setUser(user);

            // Token is fine, return it.
            return record.token;
        }

        // Refresh token, save to store
        const newToken = await this.refreshToken(refreshToken);
        if (!newToken) {
            return null;
        }

        // Return refreshed token
        return newToken.accessToken;
    }

    private async refreshToken(
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
                // TODO: I don't think this is the right place to provide
                // id/secret?
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

        const token = await this.parseRefreshResponseAndFetchUserId(text);
        const oldToken = await this.tokenStore.replace(token.user, {
            token: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: new Date(token.expiresAt),
        });

        this.sentry.breadcrumbFromHTTP("refreshing oauth token", request.url, response);

        if (oldToken && oldToken !== token.accessToken) {
            await this.revokeToken(oldToken);
        }

        return token;
    }

    private async revokeToken(token: string) {
        const request = new Request(API_BASE_URL + Routes.oauth2TokenRevocation(), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams([
                ["client_id", this.clientId],
                ["client_secret", this.clientSecret],
                ["token", token],
                ["token_type_hint", "access_token"],
            ]),
        });

        const response = await fetch(request);
        const text = await response.text();
        if (response.status >= 400) {
            console.log(`Error: status ${response.status}, ${text}`);
        }
    }

    private async upsertToken(text: string): Promise<AccessTokenResponse | null> {
        const tokenInfo = await this.parseRefreshResponseAndFetchUserId(text);

        // NOTE: we may now need to set our user in sentry now
        const oldToken = await this.tokenStore.upsert(
            tokenInfo.user,
            {
                token: tokenInfo.accessToken,
                refreshToken: tokenInfo.refreshToken,
                expiresAt: new Date(tokenInfo.expiresAt),
            },
        );

        if (oldToken) {
            await this.revokeToken(oldToken);
        }

        return tokenInfo;
    }

    // TODO: Remove the user fetch from this or do something with the info
    private async parseRefreshResponseAndFetchUserId(responseText: string): Promise<AccessTokenResponse> {
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

