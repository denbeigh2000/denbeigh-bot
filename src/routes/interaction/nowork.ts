import { Snowflake } from "discord-api-types/globals";
import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import { BotClient } from "../../discord/client";
import { Env } from "../../env";
import { Sentry } from "../../sentry";

function buildMessage(user: Snowflake | null) {
    const formattedUser = user
        ? `<@${user}> `
        : "";
    return `${formattedUser}No Discord feedback/feature requests/bug reports in this server.

Official support channels:
- [User feedback](https://feedback.discord.com)
- [Submit a bug report](https://dis.gd/bugreport)
- [Report abuse/violations](https://discord.com/safety/360044103651-reporting-abusive-behavior-to-discord)
`;
}

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
    _ctx: ExecutionContext,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody | null> {
    const { options } = interaction.data;
    let user: Snowflake | null;
    if (!options) {
        user = null;
    } else if (options.length === 1) {
        const opt = options[0];
        if (opt.type !== ApplicationCommandOptionType.User) {
            const msg = `Bad option type: ${opt.type}`;
            sentry.captureMessage(msg, "warning");
            return { content: msg, flags: MessageFlags.Ephemeral & MessageFlags.Urgent };
        }

        user = opt.value;
    } else {
        const msg = "Too many options given";
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags: MessageFlags.Ephemeral & MessageFlags.Urgent };
    }

    const content = buildMessage(user);
    const mentions = user ? [user] : [];
    return {
        content,
        allowed_mentions: { users: mentions },
        flags: MessageFlags.SuppressEmbeds,
    };
}
