import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

import { genericEphemeral } from "@bot/discord/messages/errors";
import { GroupManager } from "@bot/group/manager";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "list",
    description: "List all available groups.",
}

export const handler = async (manager: GroupManager): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const groups = await manager.listGroups();
    if (groups.length === 0) {
        return genericEphemeral("There are no groups yet!");
    }

    groups.sort((a, b) => (a.name > b.name ? 1 : -1));
    let content = "Groups:\n```\n";
    for (const group of groups) {
        content += `- ${group.name}\n`;
    }
    content += "```\n";

    return genericEphemeral(content);
}
