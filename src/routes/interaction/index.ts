import {
    APIChatInputApplicationCommandGuildInteraction,
    APIMessageComponentSelectMenuInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { BotClient } from "../../discord/client";
import verify from "../../discord/verify";
import { Env } from "../../env";
import { Sentry } from "../../sentry";
import { returnJSON, returnStatus } from "../../util/http";

import { handler as handleGroup } from "./group";
import { handler as handleInvite } from "./invite";
import { handler as handleNoWork } from "./nowork";
import { handler as handlePromote } from "./promote";
import { handler as handlePing } from "./ping";
import { handler as handleHelp } from "./help";
import { admittedUser } from "../../discord/messages/log";
import { idsToRole, Role, roleToID } from "../../roles";

export async function handler(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
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

            const resp = await handleCommand(type, interaction, env, ctx, sentry);
            let msg = resp
            if (!resp) {
                msg = { content: "OK", flags: MessageFlags.Ephemeral };
            }
            return returnJSON({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: msg,
            });
        default:
            sentry.captureMessage(
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
            sentry.captureMessage(
                `unhandled command ${name}`,
                "error"
            );
            return null;
    }
}

async function handleCommand(
    commandType: CommandType,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    ctx: ExecutionContext,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody | null> {
    const client = new BotClient(env.BOT_TOKEN, sentry);
    switch (commandType) {
        case CommandType.PROMOTE:
            return await handlePromote(client, interaction, env, ctx, sentry);
        case CommandType.INVITE:
            return await handleInvite(client, interaction, env, ctx, sentry);
        case CommandType.GROUP:
            return await handleGroup(client, interaction, env, ctx, sentry);
        case CommandType.NOWORK:
            return await handleNoWork(client, interaction, env, ctx, sentry);
        case CommandType.HELP:
            return handleHelp();
        case CommandType.PING:
            return handlePing();
    }
}

async function handleMessageComponent(
    interaction: APIMessageComponentSelectMenuInteraction,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const now = new Date();
    const customId = interaction.data.custom_id;
    if (!customId.startsWith("action_")) {
        sentry.captureMessage(
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

    const userId = fragments[1];
    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    const action = interaction.data.values[0];

    // TODO: need to change this to handle new interaction structure
    let role: Role | null = null;
    switch (action) {
        case "reject_ignore":
            break;
        case "accept_guest":
            role = Role.Guest;
            break;
        case "accept_member":
            role = Role.Member;
            break;
        case "accept_moderator":
            role = Role.Moderator;
            break;
        default:
            sentry.captureMessage(
                `unhandled select value ${action}`,
                "warning"
            );
            return;
    }

    // TODO: better defensiveness in case this was done in a dm...somehow?
    const member = await botClient.getGuildMember(interaction.guild_id!, userId);
    // TODO: this is going to change shortly to support bans, too
    if (action && !member) {
        await botClient.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content: "This user could not be found (did they leave?)",
                flags: MessageFlags.Ephemeral,
            }
        );
        await botClient.deleteMessage(
            env.PENDING_CHANNEL,
            interaction.message.id
        );

        return;
    }

    const userRole = idsToRole(env, interaction.member!.roles);
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

    const isNotMod = userRole < Role.Moderator;
    const isGuest = userRole < Role.Member;
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
        const applyRole = roleToID(env, role)!;
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
    const msg = admittedUser(env, interaction.member!, member!, now, role!, [])
    await botClient.createMessage(env.LOG_CHANNEL, msg);
    await botClient.deleteMessage(
        env.PENDING_CHANNEL,
        interaction.message.id
    );
}
