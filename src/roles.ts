import { Snowflake } from "discord-api-types/globals";
import { Env } from "./env";

export enum Role {
    Guest = 10,
    Member = 20,
    Moderator = 30,
}

export interface RoleMeta {
    id: string
    friendlyName: string
    emoji: string
    description: string
}

export const ID_TO_ROLE = {
    guest: Role.Guest,
    member: Role.Member,
    mod: Role.Moderator,
}

export const ROLE_META = {
    [Role.Guest]: {
        id: "guest",
        friendlyName: "Guest",
        emoji: "👋",
        description: "Welcome, stranger!",
    },
    [Role.Member]: {
        id: "member",
        friendlyName: "Member",
        emoji: "✅",
        description: "You seem pretty legit.",
    },
    [Role.Moderator]: {
        id: "mod",
        friendlyName: "Moderator",
        emoji: "✅",
        description: "👀",
    },
};

export function roleToID(env: Env, role: Role): Snowflake {
    switch (role) {
        case Role.Guest:
            return env.GUEST_ROLE;
        case Role.Member:
            return env.MEMBER_ROLE;
        case Role.Moderator:
            return env.MOD_ROLE;
        default:
            throw new Error(`no such role: ${role}`);
    }
};

export function idToRole(env: Env, roleID: Snowflake): Role {
    switch (roleID) {
        case env.GUEST_ROLE:
            return Role.Guest;
        case env.MEMBER_ROLE:
            return Role.Member;
        case env.MOD_ROLE:
            return Role.Moderator;
        default:
            throw new Error(`no such role for id: ${roleID}`);
    }
};

export function idsToRole(env: Env, roles: Snowflake[]): Role | null {
    // This code is very messy if we don't build this map
    const validRoles = new Map([
        [env.MOD_ROLE, Role.Moderator],
        [env.MEMBER_ROLE, Role.Member],
        [env.GUEST_ROLE, Role.Guest],
    ]);

    const validUserRoles = roles
        .filter((i) => validRoles.has(i))
        .map((k) => validRoles.get(k)!);
    if (!validUserRoles) {
        return null;
    }
    validUserRoles.sort((a, b) => a - b);
    return validUserRoles[0];

}

export enum AuxRole {
    Irl,
    Work,
}

export const ID_TO_AUX_ROLE = {
    irl: AuxRole.Irl,
    work: AuxRole.Work,
};

export const AUX_ROLE_META = {
    [AuxRole.Irl]: {
        id: "irl",
        friendlyName: "IRL",
        emoji: "🤝",
        description: "Welcome, stranger!",
    },
    [AuxRole.Work]: {
        id: "work",
        friendlyName: "Work",
        emoji: "🧑",
        description: "I've worked with you.",
    },
};

export function auxRoleToID(env: Env, role: AuxRole): Snowflake {
    switch (role) {
        case AuxRole.Irl:
            return env.IRL_ROLE;
        case AuxRole.Work:
            return env.WORK_ROLE;
        default:
            throw new Error(`no such role: ${role}`);
    }
}

export function idToAuxRole(env: Env, roleID: Snowflake): AuxRole {
    switch (roleID) {
        case env.IRL_ROLE:
            return AuxRole.Irl;
        case env.WORK_ROLE:
            return AuxRole.Work;
        default:
            throw new Error(`no such role for id: ${roleID}`);
    }
}

export function idsToAuxRoles(env: Env, roles: Snowflake[]): AuxRole[] {
    const validRoles = new Map([
        [env.IRL_ROLE, AuxRole.Irl],
        [env.WORK_ROLE, AuxRole.Work],
    ]);

    return roles
        .filter((i) => validRoles.has(i))
        .map((k) => validRoles.get(k)!);
}
