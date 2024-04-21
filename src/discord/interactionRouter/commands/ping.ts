import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    InteractionResponseType,
    MessageFlags,
    RESTPostAPIChatInputApplicationCommandsJSONBody

} from "discord-api-types/v10";
import { BotClient } from "@bot/discord/client/bot";
import { Env } from "@bot/env";
import { Sentry } from "@bot/sentry";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing.",
};

export const handler = async (_c: BotClient, _i: APIChatInputApplicationCommandGuildInteraction, _e: Env, _s: Sentry): Promise<(APIInteractionResponse | null)> => {
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
            flags: MessageFlags.Ephemeral,
            content: "Pong",
        },
    };
};
