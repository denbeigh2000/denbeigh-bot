import { Snowflake } from "discord-api-types/globals";
import { Env } from "../env";

import { Roles } from "./roles";
export { Roles };

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
