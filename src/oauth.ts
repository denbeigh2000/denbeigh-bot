import { parse as parseCookie } from "cookie";
import { OAuth2Scopes } from "discord-api-types/payloads/v10";
import { uuid } from "@cfworker/uuid";

import { UserClient } from "./discord";
import { Sentry } from "./sentry";

const OAUTH_BASE = "https://discord.com/api/oauth2";
const OAUTH_AUTHZ = `${OAUTH_BASE}/authorize`;
const OAUTH_TOKEN = `${OAUTH_BASE}/token`;
// const OAUTH_REVOKE = `${OAUTH_TOKEN}/revoke`;

const SCOPES = [OAuth2Scopes.Identify, OAuth2Scopes.GuildsJoin];
const STATE_TTL_SEC = 10 * 60;

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
}

export class OAuthClient {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    sentry: Sentry;

    constructor(
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        sentry: Sentry
    ) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.sentry = sentry;
    }

    public async getRefreshOrAuthorise(
        store: KVNamespace,
        req: Request
    ): Promise<Response | string> {
        const givenToken = getAuthToken(req);
        if (!givenToken) {
            return this.authorise(store);
        }

        const token = await this.checkToken(store, givenToken);
        if (!token) {
            return this.authorise(store);
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
        store: KVNamespace,
        state: string
    ): Promise<boolean> {
        const stateKey = `state:${state}`;
        const stateValue = await store.get(stateKey);
        if (stateValue === undefined) {
            return false;
        }

        await store.delete(stateKey);
        return true;
    }

    public async authorise(store: KVNamespace): Promise<Response> {
        const state = uuid().toString();
        await store.put(`state:${state}`, "OK", {
            expirationTtl: STATE_TTL_SEC,
        });

        const url = new URL(OAUTH_AUTHZ);
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

    public async getToken(
        store: KVNamespace,
        code: string
    ): Promise<AccessTokenResponse | null> {
        const request = new Request(OAUTH_TOKEN, {
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
        const token = await this.upsertToken(store, response);
        this.sentry.logGetToken(request, response);
        return token;
    }

    public async checkToken(
        store: KVNamespace,
        token: string
    ): Promise<string | null> {
        const record = await store.get(`token:${token}`);
        if (!record) {
            return null;
        }

        const { refreshToken, expiresAt, user } = JSON.parse(record);
        if (expiresAt > Date.now()) {
            // Token is fine, return it.
            this.sentry.setUser(user);
            return token;
        }

        // Refresh token, save to store
        const newToken = await this.refreshToken(store, refreshToken);
        if (!newToken) {
            return null;
        }

        // Delete record of old token
        await store.delete(`token:${token}`);

        // Return refreshed token
        return newToken.accessToken;
    }

    private async refreshToken(
        store: KVNamespace,
        refreshToken: string
    ): Promise<AccessTokenResponse | null> {
        const request = new Request(OAUTH_TOKEN, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
        });

        const response = await fetch(request);
        const token = await this.upsertToken(store, response);

        this.sentry.logRefresh(request, response);

        return token;
    }

    private async upsertToken(
        store: KVNamespace,
        response: Response
    ): Promise<AccessTokenResponse | null> {
        const text = await response.text();
        if (response.status >= 400) {
            console.log(`Error: status ${response.status}, ${text}`);
            return null;
        }

        const data = JSON.parse(text);
        const expiresIn = data["expires_in"];
        const expiresAt = Date.now() + expiresIn * 1000;
        const accessToken = data["access_token"];
        const refreshToken = data["refresh_token"];

        const client = new UserClient(accessToken, this.sentry);
        // NOTE: This has the side effect of calling sentry.setUser, so no need to
        // call here.
        const user = await client.getUserInfo();
        await store.put(
            `token:${accessToken}`,
            JSON.stringify({ expiresAt, refreshToken, user })
        );

        return {
            accessToken,
            refreshToken,
            tokenType: data["token_type"],
            expiresAt,
            scope: data["scope"].split(" "),
        };
    }
}
