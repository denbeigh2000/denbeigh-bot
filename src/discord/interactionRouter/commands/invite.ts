import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, ApplicationCommandOptionType, InteractionResponseType, MessageFlags, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIWebhookWithTokenJSONBody, Snowflake } from "discord-api-types/v10";
import { Env } from "../../../env";
import { idsToRole, Role, roleToID } from "../../../roles";
import { Sentry } from "../../../sentry";
import { BotClient } from "../../client";
import { genericEphemeral, genericError } from "../../messages/errors";

export const helpText = "`/invite <username> <role>`: Pre-authorise a new member (role limits apply)";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "invite",
    description: "Pre-approve a user to this server",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "username",
            description:
                "Username of the user to invite",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "role",
            description: "Role to give the new user",
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
    sentry: Sentry,
): Promise<APIInteractionResponse | null> {
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: await inner(client, interaction, env, sentry),
    };
}

async function inner(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    sentry: Sentry,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    /* TODO: Most of this block should be factored out */
    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    const awarder = interaction.member.user.id;
    let username: string | null = null;
    let role: number | null = null;
    for (const option of options) {
        if (
            option.name === "username" &&
            option.type === ApplicationCommandOptionType.String
        ) {
            username = option.value;
        } else if (
            option.name === "role" &&
            option.type === ApplicationCommandOptionType.Integer
        ) {
            role = option.value;
        }
    }

    if (!username || !role) {
        const msg = `Missing one of username (${username}) or role id (${role})`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, };
    }

    const userRole = idsToRole(env, interaction.member.roles);
    if (!userRole) {
        return { content: "You have no valid roles" };
    }

    // TODO: does this work as i expect it does??
    // needs a review and a comment
    if (userRole !== Role.Moderator && role && userRole <= role) {
        return genericError("You do not have sufficient privileges to award this role");
    }

    /* End TODO */

    const roleId = roleToID(env, role)!;
    await env.OAUTH.put(`preauth:${username}`, role.toString());
    // TODO: change to newer style with embeds
    await client.createMessage(env.LOG_CHANNEL, {
        content: `<@${awarder}> authorised \`${username}\` to join with the <@&${roleId}> role`,
        allowed_mentions: {
            users: [awarder],
        },
    });

    return genericEphemeral([
        `OK, \`${username}\` can join with the <@&${roleId}> role.`,
        "Send invite link: https://discord.denb.ee/join",
    ].join("\n\n"));
}
