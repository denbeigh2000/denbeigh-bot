import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

import { genericEphemeral } from "../../discord/messages/errors";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing",
};

export const handler = () => {
    return genericEphemeral("Pong");
};
