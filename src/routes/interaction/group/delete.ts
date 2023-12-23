import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { GroupManager } from "./manager";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "delete",
    description: "Delete an existing group",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "name",
            description:
                "The name of the group to delete",
            required: true,
        },
    ],
};

export const handler = async (
    manager: GroupManager,
    name: string,
    userId: string,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const flags = MessageFlags.Ephemeral & MessageFlags.Urgent;
    const user = await manager.getGuildMember(userId);
    if (!user) {
        return {
            content: "You are not in this guild (somehow??)",
            flags,
        };
    }

    if (
        !(
            user.roles.includes(manager.memberRole) ||
            user.roles.includes(manager.modRole)
        )
    ) {
        return {
            content: "You are not authorised to delete roles",
            flags,
        };
    }

    const deletedGroup = manager.deleteGroup(name);
    if (!deletedGroup) {
        return {
            content: `No group named \`${name}\``,
            flags,
        };
    }

    return {
        content: `Deleted group \`${name}\``,
        flags: MessageFlags.Ephemeral,
    };
}
