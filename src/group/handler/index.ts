import { CommandHandler } from "@bot/plugin/command";
import { APIChatInputApplicationCommandGuildInteraction, APIGuildMember, APIInteractionResponse, ApplicationCommandOptionType, InteractionResponseType, MessageFlags, Snowflake } from "discord-api-types/v10";
import { GroupManager } from "../manager";

import { command } from "@bot/discord/interactionRouter/commands/group/index";
import { BotClient } from "@bot/discord/client";
import { Group } from "@bot/group/manager";
import { GroupCommandHandlerError, GroupCommandHandlerErrorType } from "./error";

export enum GroupRequestType {
    LIST = "list",
    JOIN = "join",
    LEAVE = "leave",
    CREATE = "create",
    DELETE = "delete",
}

export interface GroupRequest {
    type: GroupRequestType,
    requester: APIGuildMember,
    name?: string
}

export interface GroupJoinRequest extends GroupRequest {
    type: GroupRequestType.JOIN,
    name: string,
}

export function isGroupJoin(req: GroupRequest): req is GroupJoinRequest {
    return req.type === GroupRequestType.JOIN && typeof req.name === "string";
}

export interface GroupListRequest extends GroupRequest {
    type: GroupRequestType.LIST,
    name: undefined,
}

export function isGroupList(req: GroupRequest): req is GroupListRequest {
    return req.type === GroupRequestType.LEAVE && typeof req.name === "undefined";
}

export interface GroupLeaveRequest extends GroupRequest {
    type: GroupRequestType.LEAVE,
    name: string,
}

export function isGroupLeave(req: GroupRequest): req is GroupLeaveRequest {
    return req.type === GroupRequestType.LEAVE && typeof req.name === "string";
}

export interface GroupDeleteRequest extends GroupRequest {
    type: GroupRequestType.DELETE,
    name: string,
}

export function isGroupDelete(req: GroupRequest): req is GroupDeleteRequest {
    return req.type === GroupRequestType.DELETE && typeof req.name === "string";
}

export interface GroupResponse {
    groups?: Group[],
    group?: Group,
}

export class GroupCommandHandler extends CommandHandler<GroupRequest, GroupResponse> {
    manager: GroupManager;

    constructor(client: BotClient, guildID: Snowflake) {
        super(command);
        this.manager = new GroupManager(client, guildID);
    }

    mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): GroupRequest {
        const { options } = interaction.data;
        if (!options) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: "group command missing options",
            });
        }

        if (options.length !== 1) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: `unexpected number of elements ${options.length}`,
            });
        }

        const option = options[0];
        if (option.type !== ApplicationCommandOptionType.Subcommand) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: `unexpected option type${option.type}`,
            });
        }

        if (!option.options) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: "No options in subcommand",
            });
        }

        const requester = interaction.member;
        const subcommandName = option.name;
        if (subcommandName === "list") {
            return {
                type: GroupRequestType.LIST,
                requester,
            };
        }

        if (option.options.length !== 1) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: `expected exactly 1 option, got ${option.options.length}`,
            });
        }

        const subOption = option.options[0];
        if (
            subOption.type !== ApplicationCommandOptionType.String ||
            subOption.name !== "name"
        ) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: `Unexpected option ${subOption}, expected a string with name "name"`,
            });
        }

        const name = subOption.value;
        let type: GroupRequestType;
        switch (subcommandName) {
            case "join": type = GroupRequestType.JOIN; break;
            case "leave": type = GroupRequestType.LEAVE; break;
            case "create": type = GroupRequestType.CREATE; break;
            case "delete": type = GroupRequestType.DELETE; break;
            default:
                throw new GroupCommandHandlerError({
                    type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                    opDesc: `unexpected subcommand name ${subcommandName}`,
                });
        }

        return { type, requester, name };
    }

    mapOutput(input: GroupRequest, output: GroupResponse): APIInteractionResponse {
        let content: string;

        if (isGroupList(input)) {
            content = formatList(output.groups!);
        } else if (isGroupJoin(input)) {
            content = `Added you to <@&${output.group!}>`;
        } else if (isGroupLeave(input)) {
            content = `Removed you from <@&${output.group!}>`;
        } else if (isGroupDelete(input)) {
            content = `Deleted group \`${input.name}\``;
        } else {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: "command was neight list, join, leave, nor delete",
            });
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content, flags: MessageFlags.Ephemeral },
        };
    }

    async handle(_ctx: ExecutionContext, input: GroupRequest): Promise<GroupResponse> {
        const userID = input.requester.user!.id;
        // TODO: need to check permissions first(??)
        if (isGroupList(input)) {
            const groups = await this.manager.listGroups();
            return { groups };
        }

        let group: Group | null;
        if (isGroupJoin(input)) {
            group = await this.manager.joinGroup(input.name, userID);
        } else if (isGroupLeave(input)) {
            group = await this.manager.leaveGroup(input.name, userID);
        } else if (isGroupDelete(input)) {
            group = await this.manager.deleteGroup(input.name);
        } else {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND,
                opDesc: "command was neight list, join, leave, nor delete",
            });
        }

        // TODO: need to make sure this doesn't also return null when e.g.,
        // trying to leave a group one is not in
        if (!group) {
            throw new GroupCommandHandlerError({
                type: GroupCommandHandlerErrorType.NO_SUCH_GROUP,
                userDesc: input.name,
            });
        }

        return { group };
    }
}

function formatList(groups: Group[]): string {
    if (groups.length === 0) {
        return "There are no groups yet!";
    }

    groups.sort((a, b) => (a.name > b.name ? 1 : -1));
    let content = "Groups:\n```\n";
    for (const group of groups) {
        content += `- ${group.name}\n`;
    }
    content += "```\n";

    return content;
}
