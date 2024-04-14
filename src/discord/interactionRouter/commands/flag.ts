import { FlagManager } from "../../../flag";

import {
    APIApplicationCommandSubcommandOption,
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    InteractionResponseType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIWebhookWithTokenJSONBody
} from "discord-api-types/v10";
import { Sentry } from "../../../sentry";
import { Env } from "../../../env";
import { BotClient } from "../../client";
import { genericEphemeral, genericError } from "../../messages/errors";

export const helpText = `\`/flag help\`: Help setting your flag
\`/flag set <country code>\`: Set your flag
\`/flag unset\`: Remove any flag you have set`

const setCommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "set",
    description: "Set a flag next to your display name.",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "code",
            description: "ISO-3166-1 Country Code",
        },
    ],
};

const unsetCommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "unset",
    description: "Remove any flag you have set.",
}

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "flag",
    description: "Set a flag next to your display name",
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
    return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: await inner(client, interaction, env, sentry),
    };
}

async function inner(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    sentry: Sentry,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const flagManager = new FlagManager(env.OAUTH_DB, client, env.GUILD_ID, sentry);
    const userID = interaction.member.user.id;
    const options = interaction.data.options;
    if (!options) {
        const msg = "missing options";
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    const subc = options[0];
    if (subc.type !== ApplicationCommandOptionType.Subcommand) {
        const msg = "1st option not subcommand";
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    if (subc.name === "unset") {
        await flagManager.unsetFlag(userID);
        return genericEphemeral("OK, unset your flag.");
    }

    if (subc.name !== "set") {
        const msg = `Invalid option ${subc.name}`;
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    if (!subc.options) {
        const msg = "Missing country code";
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    const setOpt = subc.options[0];
    if (setOpt.name !== "code") {
        const msg = `Unexpected sub-option ${setOpt.name}`;
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    if (setOpt.type !== ApplicationCommandOptionType.String) {
        const msg = `Unexpected sub-option type ${setOpt.type}`;
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    await flagManager.setFlag(userID, setOpt.value);
    return genericEphemeral("Flag updated");
}
