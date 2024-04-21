import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    RESTPostAPIChatInputApplicationCommandsJSONBody

} from "discord-api-types/v10";
import { BotClient } from "@bot/discord/client/bot";
import { Env } from "@bot/env";
import { Sentry } from "@bot/sentry";
import { PingCommandHandler } from "@bot/ping";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing.",
};

export const handler = async (_c: BotClient, i: APIChatInputApplicationCommandGuildInteraction, _e: Env, _s: Sentry): Promise<(APIInteractionResponse | null)> => {
    const handler = new PingCommandHandler();
    const cmdInput = handler.mapInput(i);
    const cmdOutput = await handler.handle(null as any as ExecutionContext, cmdInput);
    return handler.mapOutput(cmdInput, cmdOutput);
};
