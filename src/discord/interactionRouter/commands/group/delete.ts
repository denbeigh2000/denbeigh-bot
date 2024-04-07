import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

import { genericEphemeral, genericError } from "../../../../discord/messages/errors";
import { Env } from "../../../../env";
import { GroupManager } from "../../../../group/manager";
import { idsToRole, Role } from "../../../../roles";

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
    env: Env,
    manager: GroupManager,
    name: string,
    userId: string,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const user = await manager.getGuildMember(userId);
    if (!user) {
        return genericError("You are not in this guild (somehow??)");
    }

    const userRole = idsToRole(env, user.roles);

    if (userRole && userRole < Role.Member) {
        return genericError("You are not authorised to delete groups");
    }

    const deletedGroup = manager.deleteGroup(name);
    if (!deletedGroup) {
        return genericError(`No group named \`${name}\``);
    }

    return genericEphemeral(`Deleted group \`${name}\``)
}

