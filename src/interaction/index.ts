import {
    APIChatInputApplicationCommandGuildInteraction,
    APIApplicationCommandInteraction,
    APIMessageComponentSelectMenuInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { BotClient, getUserRole } from "../discord";
import { Env, getRoleIDFromRole, Roles } from "../env";
import { returnJSON, returnStatus } from "../http";
import { Sentry } from "../sentry";
import verify from "../verify";

import { handleGroup } from "./group";
import { handleInvite } from "./invite";
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
            ctx.waitUntil(
                handleCommand(interaction, env, ctx, sentry)
            );
            return returnJSON({
                type: InteractionResponseType.DeferredChannelMessageWithSource,
                data: {
                    flags: MessageFlags.Ephemeral,
                },
            });
        default:
            sentry.sendMessage(
                `Unhandled interaction type ${interaction.type}`,
                "warning"
            );
            return returnStatus(204, "");
    }
}

async function handleCommand(
    interaction: APIApplicationCommandInteraction,
    env: Env,
    ctx: FetchEvent,
    sentry: Sentry
) {
    const { name } = interaction.data;
    sentry.setExtra("command", name);
    const client = new BotClient(env.BOT_TOKEN, sentry);
    let msg;
    switch (name) {
        case "promote":
            msg = await handlePromote(
                client,
                interaction as APIChatInputApplicationCommandGuildInteraction,
                env,
                ctx,
                sentry
            );
            break;
        case "invite":
            msg = await handleInvite(
                client,
                interaction as APIChatInputApplicationCommandGuildInteraction,
                env,
                ctx,
                sentry
            );
            break;
        case "group":
            msg = await handleGroup(
                client,
                interaction as APIChatInputApplicationCommandGuildInteraction,
                env,
                ctx,
                sentry
            );
            break;
        case "help":
            msg = { content: HELP_TEXT };
            break;
        case "ping":
            msg = { content: "Pong" };
            break;
        default:
            msg = {
                content: `Unknown command \`/${name}\``,
            };
            sentry.sendMessage(
                `unhandled command ${name}`,
                "warning"
            );
    }
    await client.sendFollowup(env.CLIENT_ID, interaction.token, msg);
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
