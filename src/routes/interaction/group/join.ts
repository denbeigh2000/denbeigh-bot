import { GroupManager } from "./manager";
import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { genericEphemeral, genericError } from "../../../discord/messages/errors";

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
        return genericError(`No group named \`${name}\``);
    }

    return genericEphemeral(`Added you to <@&${group.roleId}>`);
}

