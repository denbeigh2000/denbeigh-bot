import {
    APIChatInputApplicationCommandGuildInteraction,
    APIMessageComponentSelectMenuInteraction,
    InteractionResponseType,
    InteractionType,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { BotClient } from "../../discord/client";
import verify from "../../discord/verify";
import { Env } from "../../env";
import { Sentry } from "../../sentry";
import { returnJSON, returnStatus } from "../../util/http";

import { handler as handleAuthorise } from "./authorise";
import { handler as handleGroup } from "./group";
import { handler as handleInvite } from "./invite";
import { handler as handleNoWork } from "./nowork";
import { handler as handlePromote } from "./promote";
import { handler as handlePing } from "./ping";
import { handler as handleHelp } from "./help";
import { genericEphemeral, genericError } from "../../discord/messages/errors";

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
                    data: genericError(`No such command: ${interaction.data.name}`),
                });
            }

            const resp = await handleCommand(type, interaction, env, ctx, sentry);
            let msg = resp
            if (!resp) {
                msg = genericEphemeral("OK");
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
    ctx: ExecutionContext,
    sentry: Sentry
) {
    const customId = interaction.data.custom_id;
    const [action] = customId.split("_", 1);
    switch (action) {
        case "authorise":
            await handleAuthorise(interaction, env, ctx, sentry);
            break;
        default:
            sentry.captureMessage(
                `Unhandled custom_id: ${customId}`,
                "warning"
            );
            return;
    }
}
