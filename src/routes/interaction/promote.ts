import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

import { BotClient } from "../../discord/client";
import { genericEphemeral } from "../../discord/messages/errors";
import { Env } from "../../env";
import { idsToRole, idToRole, Role, roleToID } from "../../roles";
import { Sentry } from "../../sentry";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody =
{
    name: "promote",
    description: "Sets the role of another user",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "User to apply role to",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "role",
            description: "New role to set",
            choices: [
                {
                    name: "Guest",
                    value: 10,
                },
                {
                    name: "Member",
                    value: 20,
                },
                {
                    name: "Moderator",
                    value: 30,
                },
            ],
            required: true,
        },
    ],
}

export async function handler(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.captureMessage(msg, "warning");
        return genericEphemeral(msg);
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
        sentry.captureMessage(msg, "warning");
        return genericEphemeral(msg);
    }

    const userRole = idsToRole(env, interaction.member.roles);
    if (!userRole) {
        return genericEphemeral("You have no valid roles");
    }
    if (userRole !== Role.Moderator && role && userRole <= role) {
        return genericEphemeral("You do not have sufficient privileges for this promotion");
    }

    const roleId = roleToID(env, role)!;
    await client.setManagedRole(
        interaction.guild_id!,
        [env.MOD_ROLE, env.MEMBER_ROLE, env.GUEST_ROLE],
        userId,
        roleId
    );

    // TODO: Replace this with a newer, fancier message that fits our theme
    await client.createMessage(env.LOG_CHANNEL, {
        content: `<@${awarder}> awarded <@${userId}> the <@&${roleId}> role`,
        allowed_mentions: {
            users: [userId, awarder],
        },
    });

    return genericEphemeral(`OK, awarded <@${userId}> the <@&${roleId}> role.`);
}
