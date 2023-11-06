import { Env, Roles } from "../env";
import { BotClient } from "./bot";
import { UserClient } from "./user";

export function getUserRole(
    env: Env,
    userRoles: string[]
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


export { BotClient, UserClient };
