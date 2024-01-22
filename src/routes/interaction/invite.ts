import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import {
    Env,
    Roles,
    getRoleIDFromRole,
    getRoleFromRoleID,
} from "../../env";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { BotClient } from "../../discord/client";
import { Sentry } from "../../sentry";
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

const USERNAME_PATTERN = /^^.+#[0-9]{4}$/;

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "invite",
    description: "Pre-approve a user to this server",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "username",
            description:
                "Username of the user to invite (e.g., User#0001)",
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
    _ctx: ExecutionContext,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    /* TODO: Most of this block should be factored out */
    const errEphFlags = { flags: MessageFlags.Ephemeral & MessageFlags.Urgent };
    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.captureMessage(msg, "warning");
        return { content: msg, ...errEphFlags };
    }

    const awarder = interaction.member!.user.id;
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

    if (!username.match(USERNAME_PATTERN)) {
        return {
            content: `${username} does not look like a valid username, expected something like \`User#0001\``,
        };
    }

    const validUserRoles = interaction.member.roles.filter(
        (r) => getRoleFromRoleID(env, r) !== null
    );
    if (!validUserRoles) {
        return { content: "You have no valid roles" };
    }
    const userRoleId = validUserRoles[0];
    const userRole = getRoleFromRoleID(env, userRoleId)!;
    if (userRole !== Roles.Moderator && role && userRole <= role) {
        return {
            content:
                "You do not have sufficient privileges to award this role",
            ...errEphFlags,
        };
    }

    /* End TODO */

    const roleId = getRoleIDFromRole(env, role)!;
    await env.OAUTH.put(`preauth:${username}`, role.toString());
    await client.createMessage(env.LOG_CHANNEL, {
        content: `<@${awarder}> authorised \`${username}\` to join with the <@&${roleId}> role`,
        allowed_mentions: {
            users: [awarder],
        },
    });

    return {
        content: [
            `OK, \`${username}\` can join with the <@&${roleId}> role.`,
            "Send invite link: https://discord.denb.ee/join",
        ].join("\n\n"),
        flags: MessageFlags.Ephemeral,
    };
}