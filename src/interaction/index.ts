import {
    APIChatInputApplicationCommandGuildInteraction,
    APIMessageComponentSelectMenuInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    APIChatInputApplicationCommandInteraction,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { BuildkiteClient, BuildTracker } from "../buildkite";
import { BotClient, getUserRole } from "../discord";
import { Env, getRoleIDFromRole, Roles } from "../env";
import { returnJSON, returnStatus } from "../http";
import { Sentry } from "../sentry";
import verify from "../verify";
import { handleBuild } from "./build";

import { handleGroup } from "./group";
import { handleInvite } from "./invite";
import { handleNoWork } from "./nowork";
import { handlePromote } from "./promote";

const HELP_TEXT = `
\`/group list\`: List open groups
\`/group join <name>\`: Join a group
\`/group leave <name>\`: Leave a group
\`/group create <name>\`: Create a new group
\`/group delete <name>\`: Delete a group

\`/invite <username> <role>\`: Pre-authorise a new member (role limits apply)
\`/promote <username> <role\`: Change a user's membership level (role limits apply)

\`/ping\`: Ping!
\`/help\`: Show this help information
`.trim();

export async function handleInteraction(
    request: Request,
    env: Env,
    ctx: FetchEvent,
    sentry: Sentry
) {
    const body = await request.text();
    if (!(await verify(env.CLIENT_PUBLIC_KEY, request, body))) {
        return new Response(
            "my mother taught me never to talk to strangers",
            {
                status: 401,
            }
        );
    }

    const interaction = JSON.parse(body);
    sentry.setExtras({
        type: "interaction",
        interactionType: interaction.type,
    });

    switch (interaction.type) {
        case InteractionType.Ping:
            return returnJSON({ type: InteractionResponseType.Pong });
        case InteractionType.MessageComponent:
            ctx.waitUntil(
                handleMessageComponent(interaction, env, ctx, sentry)
            );
            return returnJSON({
                type: InteractionResponseType.DeferredMessageUpdate,
            });
        case InteractionType.ApplicationCommand:
            const type = identifyCommand(interaction.data.name, sentry);
            if (!type) {
                return returnJSON({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: {
                        flags: MessageFlags.Ephemeral,
                        content: `No such command: ${interaction.data.name}`,
                    },
                });
            }

            const resp = await handleCommand(interaction, env, ctx, sentry);
            let msg = resp
            if (!resp) {
                msg = { content: "OK", flags: MessageFlags.Ephemeral };
            }
            return returnJSON({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: msg,
            });
        default:
            sentry.sendMessage(
                `Unhandled interaction type ${interaction.type}`,
                "warning"
            );
            return returnStatus(204, "");
    }
}

export enum CommandType {
    PROMOTE = "promote",
    INVITE = "invite",
    GROUP = "group",
    NOWORK = "nowork",
    HELP = "help",
    PING = "ping",
}

export function identifyCommand(
    name: string,
    sentry: Sentry
): CommandType | null {
    sentry.setExtra("command", name);

    switch (name) {
        case CommandType.PROMOTE:
        case CommandType.INVITE:
        case CommandType.GROUP:
        case CommandType.NOWORK:
        case CommandType.HELP:
        case CommandType.PING:
            return name;
        default:
            sentry.sendMessage(
                `unhandled command ${name}`,
                "error"
            );
            return null;
    }
}

function addEphemeral(msg: RESTPostAPIWebhookWithTokenJSONBody | null): RESTPostAPIWebhookWithTokenJSONBody | null {
    if (msg) {
        const flags = msg.flags || 0;
        msg.flags = (flags & MessageFlags.Ephemeral);
    };
    return msg;
}

async function handleCommand(
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody | null> {
    const { name } = interaction.data;
    const client = new BotClient(env.BOT_TOKEN, sentry);
    switch (name) {
        case "promote":
            return await handlePromote(client, interaction, env, ctx, sentry);
        case "invite":
            return await handleInvite(client, interaction, env, ctx, sentry);
        case "group":
            return await handleGroup(client, interaction, env, ctx, sentry);
        case "nowork":
            return await handleNoWork(client, interaction, env, ctx, sentry);
        case "build":
            const tracker = new BuildTracker(env.BUILDS);
            const bk = new BuildkiteClient(env.BUILDKITE_ORGANIZATION, env.BUILDKITE_TOKEN);
            return await handleBuild(client, bk, tracker, interaction, env, sentry);
        case "help":
            return { content: HELP_TEXT, flags: MessageFlags.Ephemeral };
        case "ping":
            return { content: "Pong", flags: MessageFlags.Ephemeral };
        default:
            sentry.sendMessage(`unhandled command ${name}`, "warning");
            return {
                content: `Unknown command \`/${name}\``,
                flags: MessageFlags.Ephemeral,
            };
    }
}

async function handleMessageComponent(
    interaction: APIMessageComponentSelectMenuInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
) {
    const customId = interaction.data.custom_id;
    if (!customId.startsWith("action_")) {
        sentry.sendMessage(
            `Unhandled custom_id: ${customId}`,
            "warning"
        );
        return;
    }

    const fragments = customId.split("_");
    if (fragments.length !== 2) {
        // TODO: Better validation
        throw new Error(`invalid fragments ${fragments}`);
    }

    const confirmerId = interaction.member!.user.id;
    const userId = fragments[1];
    const botClient = new BotClient(env.BOT_TOKEN, sentry);
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
        await botClient.sendFollowup(
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
        await botClient.sendFollowup(
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
        await botClient.addRole(
            interaction.guild_id!,
            userId,
            applyRole
        );
        logMessage = `admitted <@${userId}> with the <@&${applyRole}> role`;
    } else {
        await botClient.kickUser(interaction.guild_id!, userId);
        logMessage = `kicked <@${userId}>`;
    }
    await botClient.createMessage(env.LOG_CHANNEL, {
        content: [
            `<@${confirmerId}> ${logMessage}`,
            `<@&${env.MOD_ROLE}>`,
        ].join("\n\n"),
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [userId, confirmerId],
        },
    });
    await botClient.deleteMessage(
        env.PENDING_CHANNEL,
        interaction.message.id
    );
}
