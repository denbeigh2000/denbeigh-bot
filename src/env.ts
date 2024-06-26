export interface Env {
    OAUTH: KVNamespace;
    BUILDS: KVNamespace;

    OAUTH_DB: D1Database;

    BOT_TOKEN: string;
    CLIENT_SECRET: string;
    SENTRY_DSN: string;

    BUILDKITE_HMAC_KEY: string;
    BUILDKITE_ORGANISATION: string;
    BUILDKITE_TOKEN: string;
    BUILDS_CHANNEL: string;
    BUILD_CURIOSITY_ROLE: string;

    CLIENT_ID: string;
    CLIENT_PUBLIC_KEY: string;
    REDIRECT_URI: string;
    GUILD_ID: string;

    DENBEIGH_USER: string;

    MOD_ROLE: string;
    MEMBER_ROLE: string;
    GUEST_ROLE: string;
    IRL_ROLE: string;
    WORK_ROLE: string;

    PENDING_CHANNEL: string;
    LOG_CHANNEL: string;
    GENERAL_CHANNEL: string;
    HOLDING_CHANNEL: string;

    ENVIRONMENT: string;

    OAUTH_ENCRYPTION_KEY: string;
    JWT_SIGNING_KEY: string;
}

export async function importOauthKey(b64key: string): Promise<CryptoKey> {
    return await importKey(
        b64key,
        { name: "AES-GCM", length: 256 },
        ["encrypt", "decrypt"],
    );
}

export async function importJwtKey(b64key: string): Promise<CryptoKey> {
    return await importKey(
        b64key,
        { name: "HMAC", hash: { name: "SHA-256" } },
        ["sign", "verify"],
    );
}

type Feature = "sign" | "verify" | "encrypt" | "decrypt";

async function importKey(b64key: string, algorithm: CryptoKeyAlgorithmVariant, features: Feature[]) {
    const rawKey = atob(b64key);
    const key = new Uint8Array(rawKey.length);
    for (let i = 0, c = 0; c = rawKey.charCodeAt(i); i++) {
        key[i] = c;
    }

    return await crypto.subtle.importKey("raw", key, algorithm, false, features);
}
