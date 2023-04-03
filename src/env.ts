export interface Env {
    OAUTH: KVNamespace;

    BOT_TOKEN: string;
    CLIENT_SECRET: string;
    SENTRY_DSN: string;

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
