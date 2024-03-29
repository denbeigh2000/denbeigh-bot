import { MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

export function genericEphemeral(content: string): RESTPostAPIWebhookWithTokenJSONBody {
    return { content, flags: MessageFlags.Ephemeral };
}

export function genericError(content: string) {
    return { content, flags: MessageFlags.Ephemeral | MessageFlags.Urgent };
}
