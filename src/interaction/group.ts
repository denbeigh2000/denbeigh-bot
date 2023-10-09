import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { BotClient } from "../discord";
import { Env } from "../env";
import { Sentry } from "../sentry";

import { GroupManager } from "../groups";

const EPH_FLAGS = { flags: MessageFlags.Ephemeral };

export async function handleGroup(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const manager = new GroupManager(
        client,
        env.GUILD_ID,
        env.MOD_ROLE,
        env.MEMBER_ROLE,
        env.GUEST_ROLE
    );

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in group command";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }

    const user = interaction.member!.user.id;
    if (options.length !== 1) {
        const msg = `Unexpected number of elements ${options.length}`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }

    const option = options[0];
    if (option.type !== ApplicationCommandOptionType.Subcommand) {
        const msg = `Unexpected option type${option.type}`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }

    if (!option.options) {
        const msg = "No options in subcommand";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }

    const subcommandName = option.name;
    if (subcommandName === "list") {
        return await handleListGroups(manager);
    }

    if (option.options.length !== 1) {
        const msg = `Expected exactly 1 option, got ${option.options.length}`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }
    const subOption = option.options[0];
    if (
        subOption.type !== ApplicationCommandOptionType.String ||
        subOption.name !== "name"
    ) {
        const msg = `Unexpected option ${subOption}, expected a string with name "name"`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...EPH_FLAGS };
    }

    const groupName = subOption.value;

    switch (option.name) {
        case "create":
            return await handleCreateGroup(manager, groupName, user);
        case "join":
            return await handleJoinGroup(manager, groupName, user);
        case "leave":
            return await handleLeaveGroup(manager, groupName, user);
        case "delete":
            return await handleDeleteGroup(manager, groupName, user);
        default:
            return {
                content: `Unknown command ${option.name}`,
                ...EPH_FLAGS,
            };
    }
}

async function handleCreateGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const user = await manager.getGuildMember(userId);
    if (!user) {
        return {
            content: "You are not in this guild (somehow??)",
            ...EPH_FLAGS,
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
            ...EPH_FLAGS,
        };
    }

    const [newGroup, existing] = await manager.createGroup(name);
    if (existing) {
        return {
            content: `Group already exists: <@&${newGroup.roleId}>`,
            ...EPH_FLAGS,
        };
    }

    return {
        content: [
            `Created <@&${newGroup.roleId}>`,
            `Join it with \`/group join name:${newGroup.name}\``,
        ].join("\n"),
        ...EPH_FLAGS,
    };
}

async function handleJoinGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const group = await manager.joinGroup(name, userId);
    if (!group) {
        return {
            content: `No group named \`${name}\``,
            ...EPH_FLAGS,
        };
    }

    return {
        content: `Added you to <@&${group.roleId}>`,
        ...EPH_FLAGS,
    };
}

async function handleLeaveGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const group = await manager.leaveGroup(name, userId);
    if (!group) {
        return {
            content: `No group named \`${name}\``,
            ...EPH_FLAGS,
        };
    }

    return {
        content: `Removed you from <@&${group.roleId}>`,
        ...EPH_FLAGS,
    };
}

async function handleDeleteGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const user = await manager.getGuildMember(userId);
    if (!user) {
        return {
            content: "You are not in this guild (somehow??)",
            ...EPH_FLAGS,
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
            ...EPH_FLAGS,
        };
    }

    const deletedGroup = manager.deleteGroup(name);
    if (!deletedGroup) {
        return {
            content: `No group named \`${name}\``,
            ...EPH_FLAGS,
        };
    }

    return {
        content: `Deleted group \`${name}\``,
        ...EPH_FLAGS,
    };
}

async function handleListGroups(
    manager: GroupManager
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const groups = await manager.listGroups();
    if (groups.length === 0) {
        return {
            content: "There are no groups yet!",
            ...EPH_FLAGS,
        };
    }

    groups.sort((a, b) => (a.name > b.name ? 1 : -1));
    let msg = "Groups:\n```\n";
    for (const group of groups) {
        msg += `- ${group.name}\n`;
    }
    msg += "```\n";

    return { content: msg, ...EPH_FLAGS };
}
