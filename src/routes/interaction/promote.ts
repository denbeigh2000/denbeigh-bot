import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

import { BotClient } from "../../discord/client";
import { genericEphemeral, genericError } from "../../discord/messages/errors";
import { changedRole } from "../../discord/messages/log";
import { Env } from "../../env";
import { idsToRole, Role, roleToID } from "../../roles";
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
    const now = new Date();

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.captureMessage(msg, "warning");
        return genericEphemeral(msg);
    }

    const changer = interaction.member;
    let role: number | null = null;
    let changeeUserId: string | null = null;
    for (const option of options) {
        if (
            option.name === "user" &&
            option.type === ApplicationCommandOptionType.User
        ) {
            changeeUserId = option.value;
        } else if (
            option.name === "role" &&
            option.type === ApplicationCommandOptionType.Integer
        ) {
            role = option.value;
        }
    }

    if (!changeeUserId || !role) {
        const msg = `Missing one of user id (${changeeUserId}) or role id (${role})`;
        sentry.captureMessage(msg, "warning");
        return genericEphemeral(msg);
    }

    // Assuming user is still in the guild, because surely the call above would
    // have failed if they had left...
    const changee = (await client.getGuildMember(env.GUILD_ID, changeeUserId));
    if (!changee) {
        return genericError(`<@${changeeUserId}> user no longer seems to be in the server?`);
    }

    const oldRole = idsToRole(env, changee.roles) || 0;
    const changerRole = idsToRole(env, interaction.member.roles);
    if (!changerRole) {
        return genericError("You have no valid roles");
    }
    if (changer.user.id !== env.DENBEIGH_USER && changerRole !== Role.Moderator) {
        return genericError("You must be a moderator to change roles.");
    }
    if (changer.user.id !== env.DENBEIGH_USER && changerRole <= role) {
        return genericError("You cannot promote somebody to the same level as/above yourself");
    }
    if (changer.user.id !== env.DENBEIGH_USER && changerRole <= oldRole) {
        return genericError("To update the roles of somebody else, you must be of a higher role than them.");
    }

    const roleId = roleToID(env, role)!;
    await client.setManagedRole(
        interaction.guild_id!,
        [env.MOD_ROLE, env.MEMBER_ROLE, env.GUEST_ROLE],
        changeeUserId,
        roleId
    );

    const msg = changedRole(env, changer, changee, now, role);
    await client.createMessage(env.LOG_CHANNEL, msg);

    return genericEphemeral(`OK, awarded <@${changeeUserId}> the <@&${roleId}> role.`);
}
