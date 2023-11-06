import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { GroupManager } from "../../groups";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "leave",
    description: "Leave a group you're currently in",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "name",
            description: "The name of the group to leave",
            required: true,
        },
    ],
};

export const handler = async (
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const group = await manager.leaveGroup(name, userId);
    if (!group) {
        return {
            content: `No group named \`${name}\``,
            flags: MessageFlags.Ephemeral & MessageFlags.Urgent,
        };
    }

    return {
        content: `Removed you from <@&${group.roleId}>`,
        flags: MessageFlags.Ephemeral,
    };
};
