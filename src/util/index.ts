import { APIUser } from "discord-api-types/v10";
import { AuthManager } from "@bot/auth/authManager";
import { Env, importJwtKey, importOauthKey } from "@bot/env";
import { Sentry } from "@bot/sentry";

export async function sha256sum(input: string): Promise<string> {
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#converting_a_digest_to_a_hex_string
    const tokenBuffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function formatUser(user: APIUser): string {
    // If the discriminator is zero/falsy (has moved), just return the username
    // Otherwise, format with the discriminator
    return (Number(user.discriminator || null) === 0)
        ? user.username
        : `${user.username}#${user.discriminator}`;
}

// NOTE: it's a bit weird to put this here, but i wanted to keep import
// namespaces a bit separate.
export async function authManagerFromEnv(env: Env, sentry: Sentry): Promise<AuthManager> {
    const [tokenKey, jwtKey] = await Promise.all([
        importOauthKey(env.OAUTH_ENCRYPTION_KEY),
        importJwtKey(env.JWT_SIGNING_KEY),
    ]);

    return new AuthManager({
        oauthParams: {
            clientID: env.CLIENT_ID,
            clientSecret: env.CLIENT_SECRET,
            redirectURI: env.REDIRECT_URI,
        },
        jwtKey,
        tokenKey,
        tokenDB: env.OAUTH_DB,
        stateKV: env.OAUTH,
        sentry,
    });
}
