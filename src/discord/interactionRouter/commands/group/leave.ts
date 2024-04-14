import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

import { genericEphemeral, genericError } from "../../../../discord/messages/errors";
import { GroupManager } from "../../../../group/manager";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "leave",
    description: "Leave a group you're currently in.",
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
        return genericError(`No group named \`${name}\``);
    }

    return genericEphemeral(`Removed you from <@&${group.roleId}>`);
};
