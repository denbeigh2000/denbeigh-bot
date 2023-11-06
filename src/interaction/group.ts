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

    const flags = MessageFlags.Ephemeral & MessageFlags.Urgent;

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in group command";
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const user = interaction.member!.user.id;
    if (options.length !== 1) {
        const msg = `Unexpected number of elements ${options.length}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const option = options[0];
    if (option.type !== ApplicationCommandOptionType.Subcommand) {
        const msg = `Unexpected option type${option.type}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    if (!option.options) {
        const msg = "No options in subcommand";
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const subcommandName = option.name;
    if (subcommandName === "list") {
        return await handleListGroups(manager);
    }

    if (option.options.length !== 1) {
        const msg = `Expected exactly 1 option, got ${option.options.length}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }
    const subOption = option.options[0];
    if (
        subOption.type !== ApplicationCommandOptionType.String ||
        subOption.name !== "name"
    ) {
        const msg = `Unexpected option ${subOption}, expected a string with name "name"`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
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
            return { content: `Unknown command ${option.name}`, flags };
    }
}

async function handleCreateGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
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
            flags: MessageFlags.Ephemeral & MessageFlags.Urgent,
        };
    }

    return {
        content: `Added you to <@&${group.roleId}>`,
        flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral & MessageFlags.Urgent,
        };
    }

    return {
        content: `Removed you from <@&${group.roleId}>`,
        flags: MessageFlags.Ephemeral,
    };
}

async function handleDeleteGroup(
    manager: GroupManager,
    name: string,
    userId: string
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
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

async function handleListGroups(
    manager: GroupManager
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
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
