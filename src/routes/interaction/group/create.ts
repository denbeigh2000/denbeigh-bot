import { GroupManager } from "./manager";
import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "create",
    description: "Create a new group",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "name",
            description: "The name of the group to create",
            required: true,
        },
    ],
}

export const handler = async (
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const user = await manager.getGuildMember(userId);
    const flags = MessageFlags.Ephemeral & MessageFlags.Urgent;
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
            content: "You are not authorised to create roles",
            flags,
        };
    }

    const [newGroup, existing] = await manager.createGroup(name);
    if (existing) {
        return {
            content: `Group already exists: <@&${newGroup.roleId}>`,
            flags,
        };
    }

    return {
        content: [
            `Created <@&${newGroup.roleId}>`,
            `Join it with \`/group join name:${newGroup.name}\``,
        ].join("\n"),
        flags: MessageFlags.Ephemeral
    };
};
