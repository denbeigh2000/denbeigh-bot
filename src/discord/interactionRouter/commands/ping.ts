import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    InteractionResponseType,
    MessageFlags,
    RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord-api-types/v10";
import { Env } from "../../../env";
import { Sentry } from "../../../sentry";
import { BotClient } from "../../client/bot";

export const helpText = "`/ping`: Ping!";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing",
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
