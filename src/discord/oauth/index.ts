import { OAuth2Scopes } from "discord-api-types/payloads/v10";
import { Snowflake } from "discord-api-types/globals";
import { Routes } from "discord-api-types/v10";

import { UserClient } from "../client";
import { Sentry } from "../../sentry";
import { TokenStore } from "./tokenstore";
import { StateStore } from "./statestore";

const API_BASE_URL = "https://discordapp.com/api"

const SCOPES = [OAuth2Scopes.Identify, OAuth2Scopes.GuildsJoin, OAuth2Scopes.RoleConnectionsWrite];

export function buildRedirectUri(state: string): URL {
    const url = new URL(API_BASE_URL + Routes.oauth2Authorization());
    const params = new URLSearchParams([
        ["response_type", "code"],
        ["client_id", this.oauth.clientID],
        ["scope", SCOPES.join(" ")],
        ["state", state],
        ["redirect_uri", this.oauth.redirectURI],
        ["prompt", "none"],
    ]);
    url.search = params.toString();
    return url;
}

export interface AccessTokenResponse {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    refreshToken: string;
    scope: string[];
}

function parseTokenResponse(text: string): AccessTokenResponse {
    const data = JSON.parse(responseText);
    const expiresIn = data["expires_in"];
    const expiresAt = Date.now() + expiresIn * 1000;
    const accessToken = data["access_token"];
    const refreshToken = data["refresh_token"];

    return {
        accessToken,
        refreshToken,
        tokenType: data["token_type"],
        expiresAt,
        scope: data["scope"].split(" "),
    };
}

export class OAuthClient {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    sentry: Sentry;

    constructor(params: {
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        sentry: Sentry
    }) {
        this.clientId = params.clientId;
        this.clientSecret = params.clientSecret;
        this.redirectUri = params.redirectUri;
        this.sentry = params.sentry;
    }

    public async exchangeCode(code: string): Promise<AccessTokenResponse | null> {
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

    public async refreshToken(
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

        const token = parseTokenResponse(text);
        const oldToken = await this.tokenStore.replace(token.user, {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: new Date(token.expiresAt),
        });

        this.sentry.breadcrumbFromHTTP("refreshing oauth token", request.url, response);

        if (oldToken && oldToken !== token.accessToken) {
            await this.revokeToken(oldToken);
        }

        return token;
    }

    public async revokeToken(token: string) {
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
}
