import {
    APIChatInputApplicationCommandGuildInteraction,
    APIApplicationCommandInteraction,
    APIMessageComponentSelectMenuInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    APIMessageComponentInteraction,
    APIModalSubmitGuildInteraction,
    APIModalInteractionResponse,
} from "discord-api-types/payloads/v10";
import { isMessageComponentButtonInteraction, isMessageComponentSelectMenuInteraction } from "discord-api-types/utils/v10";
import { BotClient, getUserRole } from "../discord";
import { Env, getRoleIDFromRole, Roles } from "../env";
import { returnJSON, returnStatus } from "../http";
import { Sentry } from "../sentry";
import verify from "../verify";

import { handleGroup } from "./group";
import { handleInvite, handleInviteAction } from "./invite";
import { handlePollCreate } from "./poll";
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

    // NOTE: This model effectively means that we'll only be able to send the
    // appropriate response the server should expect _after_ we've finished
    // processing the event.
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

async function handleModalSubmit(
    interaction: APIModalSubmitGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<APIModalInteractionResponse | void> {
    const customId = interaction.data.custom_id
    const fragments = customId.split("_");
    const botClient = new BotClient(env.BOT_TOKEN, sentry);

    switch (fragments[0]) {
        case "pollcreate":
            return handlePollCreate(botClient, interaction, env, _ctx, sentry);
        default:
            sentry.sendMessage(
                `Unhandled custom_id: ${customId}`,
                "warning"
            );
            return;
    }
}

async function handleMessageComponent(
    interaction: APIMessageComponentInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
) {  // TODO: This should return a response type, instead of always assuming deferred message 
    const customId = interaction.data.custom_id;
    const fragments = customId.split("_");
    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    switch (fragments[0]) {
        case "action":
            if (fragments.length !== 2) {
                // TODO: Better validation
                throw new Error(`invalid fragments ${fragments}`);
            }

            if (!isMessageComponentSelectMenuInteraction(interaction)) {
                throw new Error("user_action interaction not selectMenu type");
            }

            await handleInviteAction(botClient, interaction, env, _ctx, sentry);
            return;

        case "poll":
            if (fragments.length !== 4) {
                // TODO: Better validation
                throw new Error(`invalid fragments ${fragments}`);
            }

            if (!isMessageComponentButtonInteraction(interaction)) {
                throw new Error("vote_poll interaction not button type");
            }
            return;

        case "pollcreate":
            if (fragments.length !== 1) {
                // TODO: Better validation
                throw new Error(`invalid fragments ${fragments}`);
            }

            if (interaction.type !== InteractionType.ModalSubmit) {
                throw new Error("createpoll interaction type not modal submit");
            }

        default:
            sentry.sendMessage(
                `Unhandled custom_id: ${customId}`,
                "warning"
            );
            return;
    }

}
