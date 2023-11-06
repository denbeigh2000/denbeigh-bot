import { GroupManager } from "./manager";
import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "list",
    description: "List all current groups",
}

export const handler = async (manager: GroupManager): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const groups = await manager.listGroups();
    if (groups.length === 0) {
        return {
            content: "There are no groups yet!",
            flags: MessageFlags.Ephemeral,
        };
    }

    groups.sort((a, b) => (a.name > b.name ? 1 : -1));
    let content = "Groups:\n```\n";
    for (const group of groups) {
        content += `- ${group.name}\n`;
    }
    content += "```\n";

    return { content, flags: MessageFlags.Ephemeral };
}
