import { Snowflake } from "discord-api-types/globals";
import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { BotClient } from "../discord";
import { Env } from "../env";
import { Sentry } from "../sentry";

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

export async function handleNoWork(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody | null> {
    const { options } = interaction.data;
    let user: Snowflake | null;
    if (!options) {
        user = null;
    } else if (options.length === 1) {
        const opt = options[0];
        if (opt.type !== ApplicationCommandOptionType.User) {
            return { content: `Bad option type: ${opt.type}`, flags: MessageFlags.Ephemeral & MessageFlags.Urgent };
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
