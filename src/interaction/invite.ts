import {
    APIChatInputApplicationCommandGuildInteraction,
    APIMessageComponentSelectMenuInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import {
    Env,
    Roles,
    getRoleIDFromRole,
    getRoleFromRoleID,
} from "../env";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { BotClient, getUserRole } from "../discord";
import { Sentry } from "../sentry";

const USERNAME_PATTERN = /^^.+#[0-9]{4}$/;

export async function handleInvite(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    /* TODO: Most of this block should be factored out (by extracting params in
     * the layer above?
     */
    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in promote command";
        sentry.sendMessage(msg, "warning");
        return { content: msg };
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
        sentry.sendMessage(msg, "warning");
        return { content: msg };
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
    };
}

export async function handleInviteAction(
    client: BotClient,
    interaction: APIMessageComponentSelectMenuInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<void> {
    const fragments = interaction.data.custom_id.split("_");
    const confirmerId = interaction.member!.user.id;
    const userId = fragments[1];
    const action = interaction.data.values[0];

    let role: Roles | null = null;
    switch (action) {
        case "reject_ignore":
            break;
        case "accept_guest":
            role = Roles.Guest;
            break;
        case "accept_member":
            role = Roles.Member;
            break;
        case "accept_moderator":
            role = Roles.Moderator;
            break;
        default:
            sentry.sendMessage(
                `unhandled select value ${action}`,
                "warning"
            );
            return;
    }

    const userRole = getUserRole(env, interaction.member!.roles);
    if (!userRole) {
        await client.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content: "You have no valid roles",
                flags: MessageFlags.Ephemeral,
            }
        );
        return;
    }

    const isNotMod = userRole < Roles.Moderator;
    const isGuest = userRole < Roles.Member;
    const roleNotAboveAwarding = role && userRole <= role;
    if (isGuest || (isNotMod && roleNotAboveAwarding)) {
        await client.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content:
                    "You do not have sufficient privileges to grant this",
                flags: MessageFlags.Ephemeral,
            }
        );
        return;
    }

    let logMessage: string;
    if (role) {
        const applyRole = getRoleIDFromRole(env, role)!;
        await client.addRole(
            interaction.guild_id!,
            userId,
            applyRole
        );
        logMessage = `admitted <@${userId}> with the <@&${applyRole}> role`;
    } else {
        await client.kickUser(interaction.guild_id!, userId);
        logMessage = `kicked <@${userId}>`;
    }
    await client.createMessage(env.LOG_CHANNEL, {
        content: [
            `<@${confirmerId}> ${logMessage}`,
            `<@&${env.MOD_ROLE}>`,
        ].join("\n\n"),
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [userId, confirmerId],
        },
    });
    await client.deleteMessage(
        env.PENDING_CHANNEL,
        interaction.message.id
    );
}
