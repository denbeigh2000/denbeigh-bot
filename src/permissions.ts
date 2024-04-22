import { Role } from "@bot/roles";

export interface PermissionResult {
    allow: boolean,
    reason?: string,
}

function deny(reason: string): PermissionResult {
    return { allow: false, reason };
}

function allow(): PermissionResult {
    return { allow: true };
}

export function canPromote(promoter: Role, promotee: { from: Role, to: Role }): PermissionResult {
    if (promoter !== Role.Moderator)
        return deny("only moderators may change roles");
    if (promoter <= promotee.to)
        // Mods can't make more mods
        return deny("you may not promote somebody to the same level as/above yourself");
    if (promoter <= promotee.from)
        // Mods can't de-mod other mods
        return deny("you may not promote somebody who is of the same level as/above yourself");

    return allow();
}

export function canManageGroup(actor: Role): PermissionResult {
    if (actor < Role.Member)
        return deny("you must be a member or above to create/delete groups");

    return allow();
}
