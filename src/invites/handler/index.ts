import { Snowflake } from "discord-api-types/globals";
import {
    APIChatInputApplicationCommandGuildInteraction,
    APIGuildMember,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    InteractionResponseType,
    MessageFlags,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import { CommandHandler } from "@bot/plugin/command";
import { Role, RoleIDs } from "@bot/roles";
import { InviteHandlerError, InviteHandlerErrorType } from "./error";
import { BotClient } from "@bot/discord/client";

export interface InviteRequest {
    inviter: APIGuildMember,
    invitee: string,
    desiredRole: Role,
}

function structureErr(data: string): InviteHandlerError {
    return new InviteHandlerError({
        type: InviteHandlerErrorType.MIS_STRUCTURED_COMMAND,
        data,
    });
}

export interface InvitesHandlerParams {
    discord: BotClient,
    logChannel: Snowflake,
    db: KVNamespace,
    roleIDs: RoleIDs,
}

export class InvitesHandler extends CommandHandler<InviteRequest, null> {
    discord: BotClient;
    logChannel: Snowflake;
    db: KVNamespace;
    roleIDs: RoleIDs;

    constructor({ discord, logChannel, db, roleIDs }: InvitesHandlerParams) {
        super();

        this.discord = discord;
        this.logChannel = logChannel;
        this.db = db;
        this.roleIDs = roleIDs;
    }

    definition: RESTPostAPIChatInputApplicationCommandsJSONBody = {
        name: "invite",
        description: "Pre-authorise a new user (admission rules apply).",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "username",
                description:
                    "Username of the user to invite",
                required: true,
            },
            {
                type: ApplicationCommandOptionType.Integer,
                name: "role",
                description: "Role to give the new user",
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

    mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): InviteRequest {
        const { options } = interaction.data;
        if (!options) {
            throw structureErr("No options defined in promote command");
        }

        let username: string | null = null;
        let role: number | null = null;
        for (const option of options) {
            const isUsername =
                option.name === "username" &&
                option.type === ApplicationCommandOptionType.String;
            const isRole =
                option.name === "role" &&
                option.type === ApplicationCommandOptionType.Integer;

            if (isUsername)
                username = option.value;
            else if (isRole)
                role = option.value;
        }

        if (!username)
            throw structureErr("missing username");
        if (!role)
            throw structureErr("missing role");

        return {
            invitee: username,
            inviter: interaction.member,
            desiredRole: role,
        }
    }

    mapOutput({ invitee, desiredRole }: InviteRequest, _output: null): APIInteractionResponse {
        const roleID = this.roleIDs[desiredRole];
        const content = `OK, \`${invitee}\` will be given the <@&${roleID}> role when they join.
Send them this invite link: https://discord.denb.ee/join`;

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content, flags: MessageFlags.Ephemeral },
        };
    }

    async handle(_ctx: ExecutionContext, { inviter, invitee, desiredRole }: InviteRequest): Promise<null> {
        const idsToRoles = Object.entries(this.roleIDs).reduce<{ [id: Snowflake]: Role }>((ret, entry) => {
            const [key, value] = entry;
            // TODO: verify this isn't bogus, tsc thinks key is a string
            ret[value] = key as any as Role;
            return ret;
        }, {});

        // TODO: privilege confirmation use the DB instead of discord roles
        const userRoleID = inviter.roles.find(id => idsToRoles[id]);
        if (!userRoleID)
            throw new InviteHandlerError({ type: InviteHandlerErrorType.NO_VALID_ROLES });
        const userRole = idsToRoles[userRoleID];

        // TODO: does this work as i expect it does??
        // needs a review and a comment
        if (userRole !== Role.Moderator && userRole <= desiredRole)
            throw new InviteHandlerError({ type: InviteHandlerErrorType.INSUFFICIENT_PRIVILEGE });

        const inviterID = inviter.user!.id;
        const roleID = this.roleIDs[desiredRole];
        await this.db.put(`preauth:${invitee}`, desiredRole.toString());
        // TODO: move this entirely to a logger class, so formatting etc isn't
        // handled here
        // TODO: change to newer style with embeds
        await this.discord.createMessage(this.logChannel, {
            content: `<@${inviterID}> authorised \`${invitee}\` to join with the <@&${roleID}> role`,
            allowed_mentions: {
                users: [inviterID],
            },
        });

        return null;
    }
}
