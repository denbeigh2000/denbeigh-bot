import {
    APIApplicationCommandSubcommandOption,
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import { Sentry } from "@bot/sentry";
import { BotClient } from "@bot/discord/client";
import { Env } from "@bot/env";
import { FlagCommandHandler } from "@bot/flag/handler";

const setCommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "set",
    description: "Pick a flag to show.",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "code",
            description: "ISO-3166-1 Country Code",
            required: true,
        },
    ],
};

const unsetCommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "unset",
    description: "Remove any flag you have set.",
}

// NOTE: this declaration will go away when all the commands implement the new
// standard, and the router uses that type.
export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "flag",
    description: "Manage the flag displayed next to your display name.",
    options: [
        setCommand,
        unsetCommand,
    ],
};

export async function handler(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    sentry: Sentry,
): Promise<APIInteractionResponse | null> {

    // NOTE: glue code until we write them all like this, and just make the
    // router use this type.
    const handler = new FlagCommandHandler(
        client,
        env.OAUTH_DB,
        env.GUILD_ID,
        sentry
    );

    // TODO: pass ctx everywhere. this isn't used here right now, anyway.
    const ctx = null as any as ExecutionContext;

    const inputParams = handler.mapInput(interaction);
    await handler.handle(ctx, inputParams);
    const msg = handler.mapOutput(inputParams);
    return msg;
}
