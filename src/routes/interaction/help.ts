import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

import { genericEphemeral } from "../../discord/messages/errors";

const HELP_TEXT = `
\`/group list\`: List open groups
\`/group join <name>\`: Join a group
\`/group leave <name>\`: Leave a group
\`/group create <name>\`: Create a new group
\`/group delete <name>\`: Delete a group

\`/invite <username> <role>\`: Pre-authorise a new member (role limits apply)
\`/promote <username> <role\`: Change a user's membership level (role limits apply)

\`/ping\`: Ping!
\`/help\`: Show this help information
`.trim();

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "help",
    description: "Show information about bot commands",
};


export const handler = () => {
    return genericEphemeral(HELP_TEXT);
};
