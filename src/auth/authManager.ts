import { APIUser } from "discord-api-types/payloads/v10/user";
import { UserClient } from "@bot/discord/client";
import { OAuthClient as DiscordOAuthClient } from "@bot/discord/oauth";
import { StateStore } from "@bot/discord/oauth/statestore";
import { TokenStore } from "@bot/discord/oauth/tokenstore";
import { Sentry } from "@bot/sentry";
import { SessionSigner } from "./sessionSigner";

export interface OAuthExchange {
    user: APIUser,
    accessToken: string,
}

export interface TokenResponse {
    discordUser: APIUser,
    discordToken: string,
}

export interface AuthManagerParams {
    oauthParams: OAuthParams,
    jwtKey: CryptoKey,
    tokenKey: CryptoKey,
    tokenDB: D1Database,
    stateKV: KVNamespace,
    sentry: Sentry,
}

export interface OAuthParams {
    clientID: string,
    clientSecret: string,
    redirectURI: string,
}

export enum AuthManagerErrorCode {
    INVALID_STATE = "invalid state",
    CODE_EXCHANGE_FAILED = "code exchange failed",
    NO_SUCH_TOKEN = "no token for user",
    REFRESH_TOKEN_FAILURE = "token refresh failed",
    JUST_CREATED_TOKEN_INVALID = "just-created token invalid",
    JUST_REFRESHED_TOKEN_INVALID = "just-refreshed token invalid",
}

export class AuthManagerError extends Error {
    code: AuthManagerErrorCode;

    constructor(code: AuthManagerErrorCode) {
        switch (code) {
            case AuthManagerErrorCode.INVALID_STATE:
                super("invalid state found during redirect");
                break;
            case AuthManagerErrorCode.CODE_EXCHANGE_FAILED:
                super("bad response from discord on code exchange");
                break;
            case AuthManagerErrorCode.NO_SUCH_TOKEN:
                super("no such token for that user");
                break;
            case AuthManagerErrorCode.REFRESH_TOKEN_FAILURE:
                super("not able to refresh oauth token for that user");
                break;
            case AuthManagerErrorCode.JUST_CREATED_TOKEN_INVALID:
                super("token that we just created was invalid");
                break;
            case AuthManagerErrorCode.JUST_REFRESHED_TOKEN_INVALID:
                super("token that we just refreshed was invalid");
                break;
            default:
                throw `invalid code ${code} given`;
        }

        this.code = code;

        // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, AuthManagerError.prototype);
    }
}

export class AuthManager {
    signer: SessionSigner;
    states: StateStore;
    tokens: TokenStore;
    discord: DiscordOAuthClient;
    sentry: Sentry;

    constructor({
        oauthParams,
        jwtKey,
        tokenKey,
        tokenDB,
        stateKV,
        sentry,
    }: AuthManagerParams) {
        this.signer = new SessionSigner(jwtKey);
        this.tokens = new TokenStore(tokenKey, tokenDB, sentry);
        this.states = new StateStore(stateKV);
        this.discord = new DiscordOAuthClient({ ...oauthParams, sentry });
        this.sentry = sentry;
    }

    public async initAuthorisation(): Promise<URL> {
        const state = await this.states.createState();
        return this.discord.buildRedirectUri(state);
    }

    public async handleOAuthRedirect(code: string, state: string): Promise<OAuthExchange> {
        //  - receives code/string
        //  - verifies given state in local store
        //  - calls out to discord to exchange code for token
        //  - encrypts token and stores in db
        //  - returns user id and token
        if (!this.states.checkRedirect(state)) {
            throw new AuthManagerError(AuthManagerErrorCode.INVALID_STATE);
        }

        const info = await this.discord.exchangeCode(code);
        if (!info) {
            throw new AuthManagerError(AuthManagerErrorCode.CODE_EXCHANGE_FAILED);
        }
        const { accessToken, refreshToken, expiresAt: expiresAtNum } = info;
        const expiresAt = new Date(expiresAtNum);

        const user = await this.getUser(info.accessToken);
        if (!user) {
            throw new AuthManagerError(AuthManagerErrorCode.JUST_CREATED_TOKEN_INVALID);
        }

        const oldToken = await this.tokens.upsert(user.id, {
            accessToken,
            refreshToken,
            expiresAt,
        });

        if (oldToken && oldToken !== info.accessToken) {
            await this.discord.revokeToken(oldToken);
        }

        return { user, accessToken };
    }

    public async getFromToken(token: string): Promise<TokenResponse> {
        //  - verifies jwt
        //  - fetches oauth token for decoded user id
        //  - uses discord refresh token if necessary
        //  - returns discord user id and token
        const { discordID } = await this.signer.decode(token);
        const tokenInfo = await this.tokens.get(discordID);
        if (!tokenInfo) {
            throw new AuthManagerError(AuthManagerErrorCode.NO_SUCH_TOKEN);
        }
        const { expiresAt, accessToken: discordToken, refreshToken } = tokenInfo;

        if (expiresAt > new Date()) {
            const discordUser = await this.getUser(discordToken);
            if (discordUser) {
                // Token is fine, return it.
                return { discordUser, discordToken };
            }

            // If fetching the user didn't succeed, fall through to a refresh
            // operation
            this.sentry.captureMessage("seemingly valid user token failed");
        }

        const newTokenInfo = await this.discord.refreshToken(refreshToken);
        if (!newTokenInfo) {
            throw new AuthManagerError(AuthManagerErrorCode.REFRESH_TOKEN_FAILURE);
        }

        const replacedToken = await this.tokens.replace(discordID, {
            accessToken: newTokenInfo.accessToken,
            refreshToken: newTokenInfo.refreshToken,
            expiresAt: new Date(newTokenInfo.expiresAt),
        });

        if (replacedToken) {
            await this.discord.revokeToken(replacedToken);
        }

        const discordUser = await this.getUser(discordToken);
        if (!discordUser) {
            throw new AuthManagerError(AuthManagerErrorCode.JUST_REFRESHED_TOKEN_INVALID);
        }

        return { discordUser, discordToken };
    }

    public async createUserToken(discordID: string): Promise<string> {
        //  - accepts discord id
        //  - returns a signed jwt containing it
        return await this.signer.sign({ discordID });
    }

    private async getUser(token: string): Promise<APIUser | null> {
        const client = new UserClient(token, this.sentry);
        return await client.getUserInfo();
    }
}
