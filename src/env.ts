import { Snowflake } from "discord-api-types/globals";

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

    PENDING_CHANNEL: string;
    LOG_CHANNEL: string;
    GENERAL_CHANNEL: string;
    HOLDING_CHANNEL: string;

    ENVIRONMENT: string;
}

export enum Roles {
    Guest = 10,
    Member = 20,
    Moderator = 30,
}

export function getRoleIDFromRole(
    env: Env,
    role: Roles
): string | null {
    switch (role) {
        case Roles.Guest:
            return env.GUEST_ROLE;
        case Roles.Member:
            return env.MEMBER_ROLE;
        case Roles.Moderator:
            return env.MOD_ROLE;
    }
}

export function getRoleFromRoleID(
    env: Env,
    roleId: string
): Roles | null {
    switch (roleId) {
        case env.GUEST_ROLE:
            return Roles.Guest;
        case env.MEMBER_ROLE:
            return Roles.Member;
        case env.MOD_ROLE:
            return Roles.Moderator;
        default:
            return null;
    }
}

export function getUserRole(
    env: Env,
    userRoles: Snowflake[]
): Roles | null {
    // This code is very messy if we don't build this map
    const validRoles = new Map([
        [env.MOD_ROLE, Roles.Moderator],
        [env.MEMBER_ROLE, Roles.Member],
        [env.GUEST_ROLE, Roles.Guest],
    ]);

    const validUserRoles = userRoles
        .filter((i) => validRoles.has(i))
        .map((k) => validRoles.get(k)!);
    if (!validUserRoles) {
        return null;
    }
    validUserRoles.sort((a, b) => a - b);
    return validUserRoles[0];
}

