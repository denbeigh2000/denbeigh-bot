import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, ApplicationCommandOptionType, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import { Env } from "@bot/env";
import NoWorkCommandHandler from "@bot/nowork";
import { Sentry } from "@bot/sentry";
import { BotClient } from "@bot/discord/client";

// TODO: remove this when router is using CommandHandler subclass
export const command: RESTPostAPIChatInputApplicationCommandsJSONBody =
{
    name: "nowork",
    description: "Remind the chat of the no-work policy.",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "User to direct reminder to",
            required: false,
        },
    ],
};

export async function handler(
    _client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    _env: Env,
    _sentry: Sentry,
): Promise<APIInteractionResponse | null> {
    const handler = new NoWorkCommandHandler();
    // TODO: pass down ctx
    const ctx = null as any as ExecutionContext;
    const inputParams = handler.mapInput(interaction);
    const outputData = await handler.handle(ctx, inputParams);
    return handler.mapOutput(inputParams, outputData);
}
