import { GroupManager } from "../../groups";
import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "join",
    description: "Join an existing group",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "name",
            description: "The name of the group to join",
            required: true,
        },
    ],
};


export const handler = async (
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const group = await manager.joinGroup(name, userId);
    if (!group) {
        return {
            content: `No group named \`${name}\``,
            flags: MessageFlags.Ephemeral & MessageFlags.Urgent,
        };
    }

    return {
        content: `Added you to <@&${group.roleId}>`,
        flags: MessageFlags.Ephemeral,
    };
}

