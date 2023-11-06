import { MessageFlags, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing",
};

export const handler = () => {
    return { content: "Pong", flags: MessageFlags.Ephemeral };
};
