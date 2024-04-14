import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, ApplicationCommandOptionType, InteractionResponseType, MessageFlags, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIWebhookWithTokenJSONBody, Snowflake } from "discord-api-types/v10";
import { Env } from "../../../env";
import { Sentry } from "../../../sentry";
import { BotClient } from "../../client";
import { genericError } from "../../messages/errors";

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

function buildMessage(user: Snowflake | null) {
    const formattedUser = user
        ? `<@${user}> `
        : "";
    return `${formattedUser}No Discord feedback/feature requests/bug reports in this server.

Official support channels:
- [User feedback](https://feedback.discord.com)
- [Submit a bug report](https://dis.gd/bugreport)
- [Report abuse/violations](https://discord.com/safety/360044103651-reporting-abusive-behavior-to-discord)
- [Discord Support on Twitter](https://twitter.com/discord_support)
`;
}

async function inner(
    _client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    _env: Env,
    sentry: Sentry,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const { options } = interaction.data;
    let user: Snowflake | null;
    if (!options) {
        user = null;
    } else if (options.length === 1) {
        const opt = options[0];
        if (opt.type !== ApplicationCommandOptionType.User) {
            const msg = `Bad option type: ${opt.type}`;
            sentry.captureMessage(msg, "warning");
            return genericError(msg);
        }

        user = opt.value;
    } else {
        const msg = "Too many options given";
        sentry.captureMessage(msg, "warning");
        return genericError(msg);
    }

    const content = buildMessage(user);
    const mentions = user ? [user] : [];
    return {
        content,
        allowed_mentions: { users: mentions },
        flags: MessageFlags.SuppressEmbeds,
    };
}
