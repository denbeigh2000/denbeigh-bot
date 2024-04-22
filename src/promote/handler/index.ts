import { BotClient } from "@bot/discord/client";
import { changedRole } from "@bot/discord/messages/log";
import { CommandHandler } from "@bot/plugin/command";
import { invertRoleIDs, Role, RoleIDs } from "@bot/roles";

import {
    APIChatInputApplicationCommandGuildInteraction,
    APIGuildMember,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    InteractionResponseType,
    MessageFlags,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    Snowflake,
} from "discord-api-types/v10";
import { PromoteHandlerError, PromoteHandlerErrorType } from "./error";

export interface PromoteRequest {
    promoter: APIGuildMember,
    promoteeID: Snowflake,
    role: Role,
}

export interface PromoteResponse {
    oldRole: Role,
}

const definition: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "promote",
    description: "Sets the role of another user (role limits apply).",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "User to apply role to",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "role",
            description: "New role to set",
            choices: [
                {
                    name: "Guest",
                    value: Role.Guest,
                },
                {
                    name: "Member",
                    value: Role.Member,
                },
                {
                    name: "Moderator",
                    value: Role.Moderator,
                },
            ],
            required: true,
        },
    ],
};

function structureErr(data: string) {
    return new PromoteHandlerError({
        type: PromoteHandlerErrorType.MIS_STRUCTURED_COMMAND,
        data,
    });
}

export interface PromoteHandlerParams {
    client: BotClient,
    denbeighUserID: Snowflake,
    guildID: Snowflake,
    logChannelID: Snowflake,
    roleIDs: RoleIDs,
}

export class PromoteHandler extends CommandHandler<PromoteRequest, PromoteResponse> {
    client: BotClient;
    denbeighUserID: Snowflake;
    guildID: Snowflake;
    logChannelID: Snowflake;
    roleIDs: RoleIDs;

    constructor({ client, denbeighUserID, guildID, logChannelID, roleIDs }: PromoteHandlerParams) {
        super(definition);

        this.client = client;
        this.denbeighUserID = denbeighUserID;
        this.guildID = guildID;
        this.roleIDs = roleIDs;
        this.logChannelID = logChannelID;
    }

    mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): PromoteRequest {
        const { options } = interaction.data;
        if (!options)
            throw structureErr("No options defined in promote command");

        const promoter = interaction.member;
        let role: number | null = null;
        let promoteeID: string | null = null;
        for (const option of options) {
            if (
                option.name === "user" &&
                option.type === ApplicationCommandOptionType.User
            ) {
                promoteeID = option.value;
            } else if (
                option.name === "role" &&
                option.type === ApplicationCommandOptionType.Integer
            ) {
                role = option.value;
            }
        }

        if (!promoteeID)
            throw structureErr("missing promotee user ID");
        if (!role)
            throw structureErr("missing promotee role");

        return { promoteeID, promoter, role };
    }

    mapOutput(input: PromoteRequest, output: PromoteResponse): APIInteractionResponse {
        const user = `<@${input.promoteeID}>`;
        const fromRole = `<@&${this.roleIDs[output.oldRole]}>`;
        const toRole = `<@&${this.roleIDs[input.role]}>`;

        // NOTE: if new role is the same/lower than the past role, user is only
        // sarcastically "promoted".
        const verb = toRole <= fromRole
            ? '"promoted"'
            : "promoted";

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: `OK, ${verb} ${user} from ${fromRole} to ${toRole}.`,
            },
        };
    }

    // TODO: most of this logic should be moved out into a dedicated Manager
    // class
    async handle(_ctx: ExecutionContext, input: PromoteRequest): Promise<PromoteResponse> {
        const now = new Date();

        const { promoteeID, promoter, role } = input;

        // Assuming user is still in the guild, because surely the call above would
        // have failed if they had left...
        const promotee = (await this.client.getGuildMember(this.guildID, promoteeID));
        if (!promotee)
            throw new PromoteHandlerError({ type: PromoteHandlerErrorType.TARGET_NOT_IN_GUILD });

        const roleIDs = new Set(Object.values(this.roleIDs));
        const oldRoleID = promotee.roles.find(role => roleIDs.has(role));
        const idsToRoles = invertRoleIDs(this.roleIDs);
        const oldRole = oldRoleID && idsToRoles[oldRoleID]!;

        if (!oldRoleID || !oldRole) {
            throw "TODO";
        }

        const promoterRoleID = promoter.roles.find(role => roleIDs.has(role));
        const promoterRole = promoterRoleID && idsToRoles[promoterRoleID];
        const isDenbeigh = promoter.user!.id == this.denbeighUserID;
        if (!promoterRole) {
            throw new PromoteHandlerError({
                type: PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE,
                data: "you have no permission roles",
            });
        }

        if (!isDenbeigh && promoterRole !== Role.Moderator)
            throw new PromoteHandlerError({
                type: PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE,
                data: "you must be a moderator to change roles.",
            });

        if (!isDenbeigh && promoterRole <= role) {
            throw new PromoteHandlerError({
                type: PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE,
                data: "you cannot promote somebody to the same level as/above yourself",
            });
        }

        if (!isDenbeigh && promoterRole <= oldRole) {
            throw new PromoteHandlerError({
                type: PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE,
                data: "to update the roles of somebody else, you must be of a higher role than them.",
            });
        }

        const roleID = this.roleIDs[role];
        await this.client.setManagedRole(
            this.guildID,
            Object.values(this.roleIDs),
            promoteeID,
            roleID,
        );

        const msg = changedRole(this.roleIDs[Role.Moderator], promoter, promotee, now, role);
        await this.client.createMessage(this.logChannelID, msg);

        return { oldRole };
    }
}
