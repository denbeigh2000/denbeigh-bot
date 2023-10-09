import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { BotClient } from "../discord";
import {
    Env,
    getRoleFromRoleID,
    getRoleIDFromRole,
    Roles,
} from "../env";
import { Sentry } from "../sentry";

export async function handlePromote(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const ephFlags = { flags: MessageFlags.Ephemeral };
    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    const awarder = interaction.member!.user.id;
    let role: number | null = null;
    let userId: string | null = null;
    for (const option of options) {
        if (
            option.name === "user" &&
            option.type === ApplicationCommandOptionType.User
        ) {
            userId = option.value;
        } else if (
            option.name === "role" &&
            option.type === ApplicationCommandOptionType.Integer
        ) {
            role = option.value;
        }
    }

    if (!userId || !role) {
        const msg = `Missing one of user id (${userId}) or role id (${role})`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    const validUserRoles = interaction.member.roles.filter(
        (r) => getRoleFromRoleID(env, r) !== null
    );
    if (!validUserRoles) {
        return { content: "You have no valid roles", ...ephFlags };
    }
    const userRoleId = validUserRoles[0];
    const userRole = getRoleFromRoleID(env, userRoleId)!;
    if (userRole !== Roles.Moderator && role && userRole <= role) {
        return {
            content:
                "You do not have sufficient privileges for this promotion",
            ...ephFlags,
        };
    }

    const roleId = getRoleIDFromRole(env, role)!;
    await client.setManagedRole(
        interaction.guild_id!,
        [env.MOD_ROLE, env.MEMBER_ROLE, env.GUEST_ROLE],
        userId,
        roleId
    );
    await client.createMessage(env.LOG_CHANNEL, {
        content: `<@${awarder}> awarded <@${userId}> the <@&${roleId}> role`,
        allowed_mentions: {
            users: [userId, awarder],
        },
    });

    return {
        content: `OK, awarded <@${userId}> the <@&${roleId}> role.`,
        ...ephFlags,
    };
}
