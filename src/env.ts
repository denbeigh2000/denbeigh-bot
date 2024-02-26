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
}
