import { APIApplicationCommandSubcommandOption, ApplicationCommandOptionType, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";

import { GroupManager } from "@bot/group/manager";
import { genericEphemeral, genericError } from "@bot/discord/messages/errors";
import { Env } from "@bot/env";
import { idsToRole, Role } from "@bot/roles";

export const subcommand: APIApplicationCommandSubcommandOption = {
    type: ApplicationCommandOptionType.Subcommand,
    name: "create",
    description: "Create a new group (members only).",
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
    env: Env,
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> => {
    const user = await manager.getGuildMember(userId);
    if (!user) {
        return genericError("You are not in this guild (somehow??)");
    }

    const userRole = idsToRole(env, user.roles);
    if (!userRole || userRole < Role.Member) {
        return genericError("You are not authorised to create groups");
    }

    const [newGroup, existing] = await manager.createGroup(name);
    if (existing) {
        genericError(`Group already exists: <@&${newGroup.roleId}>`);
    }

    return genericEphemeral([
        `Created <@&${newGroup.roleId}>`,
        `Join it with \`/group join name:${newGroup.name}\``,
    ].join("\n"));
};

