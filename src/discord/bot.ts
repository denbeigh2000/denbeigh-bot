// This is fine, typescript is fine.
import { Snowflake } from "discord-api-types/globals";
import { Routes } from "discord-api-types/rest/v10";

import {
    APIApplicationCommand,
    APIGuildMember,
    APIMessage,
    APIRole,
} from "discord-api-types/payloads/v10";

import {
    RESTDeleteAPIChannelMessageResult,
    RESTPatchAPIChannelMessageJSONBody,
    RESTPatchAPIChannelMessageResult,
    RESTPostAPIChannelMessageJSONBody,
    RESTPostAPIChannelMessageResult,
} from "discord-api-types/rest/v10/channel";

import {
    RESTPatchAPIInteractionFollowupJSONBody,
    RESTPatchAPIInteractionFollowupResult,
    RESTPostAPIApplicationCommandsJSONBody,
    RESTPostAPIApplicationCommandsResult,
    RESTPostAPIInteractionFollowupJSONBody,
    RESTPostAPIInteractionFollowupResult,
    RESTPutAPIApplicationGuildCommandsJSONBody,
    RESTPutAPIApplicationGuildCommandsResult,
} from "discord-api-types/rest/v10/interactions";

import {
    RESTDeleteAPIGuildMemberResult,
    RESTDeleteAPIGuildMemberRoleResult,
    RESTDeleteAPIGuildRoleResult,
    RESTGetAPIGuildMemberResult,
    RESTGetAPIGuildRolesResult,
    RESTPostAPIGuildRoleJSONBody,
    RESTPostAPIGuildRoleResult,
    RESTPutAPIGuildMemberJSONBody,
    RESTPutAPIGuildMemberResult,
    RESTPutAPIGuildMemberRoleResult,
} from "discord-api-types/rest/v10/guild";

import { Client } from "./client";
import { Sentry } from "../../src/sentry";

export class BotClient extends Client {
    constructor(token: string, sentry: Sentry) {
        super("Bot", token, sentry);
    }

    public async joinGuild(
        guildId: Snowflake,
        userToken: string,
        userId: Snowflake,
        roles?: Snowflake[]
    ): Promise<APIGuildMember | null> {
        const body: RESTPutAPIGuildMemberJSONBody = {
            access_token: userToken,
            roles,
        }
        const url = Routes.guildMember(guildId, userId);
        const maybeUser = await this.rest.put(url, { body }) as RESTPutAPIGuildMemberResult;
        return maybeUser || null;
    }

    public async getGuildMember(
        guildId: Snowflake,
        userId: Snowflake
    ): Promise<APIGuildMember | null> {
        const route = Routes.guildMember(guildId, userId);
        const maybeUser = await this.rest.get(route) as RESTGetAPIGuildMemberResult;
        return maybeUser || null;
    }

    public async createMessage(
        channelId: Snowflake,
        messageContent: RESTPostAPIChannelMessageJSONBody
    ): Promise<APIMessage> {

        const route = Routes.channelMessages(channelId);
        const message = await this.rest.post(route, { body: messageContent }) as RESTPostAPIChannelMessageResult;

        return message;
    }

    public async editMessage(
        channelId: Snowflake,
        messageId: Snowflake,
        content: RESTPatchAPIChannelMessageJSONBody,
    ): Promise<APIMessage> {
        const route = Routes.channelMessage(channelId, messageId);
        return await this.rest.patch(route, { body: content }) as RESTPatchAPIChannelMessageResult;
    }

    public async setManagedRole(
        guildId: Snowflake,
        managedRoles: Snowflake[],
        userId: Snowflake,
        role: Snowflake
    ) {
        await Promise.all(managedRoles.map(r => this.removeRole(guildId, userId, r)));
        await this.addRole(guildId, userId, role);
    }

    public async listRoles(guildId: Snowflake): Promise<APIRole[]> {
        const route = Routes.guildRoles(guildId);
        return await this.rest.get(route) as RESTGetAPIGuildRolesResult;
    }

    public async createRole(
        guildId: Snowflake,
        name: string,
        mentionable?: boolean,
        colour?: number
    ): Promise<APIRole> {
        const route = Routes.guildRoles(guildId);
        const body: RESTPostAPIGuildRoleJSONBody = {
            name,
            mentionable,

            // NOTE: Discord require the wrong spelling
            color: colour,
        };

        const role = await this.rest.post(route, { body }) as RESTPostAPIGuildRoleResult;
        return role;
    }

    public async deleteRole(guildId: Snowflake, roleId: Snowflake) {
        const route = Routes.guildRole(guildId, roleId);
        await this.rest.delete(route) as RESTDeleteAPIGuildRoleResult;
    }

    public async addRole(
        guildId: Snowflake,
        userId: Snowflake,
        roleId: Snowflake
    ) {
        const route = Routes.guildMemberRole(guildId, userId, roleId);
        await this.rest.put(route) as RESTPutAPIGuildMemberRoleResult;
    }

    public async removeRole(
        guildId: Snowflake,
        userId: Snowflake,
        roleId: Snowflake
    ) {
        const route = Routes.guildMemberRole(guildId, userId, roleId);
        await this.rest.delete(route) as RESTDeleteAPIGuildMemberRoleResult;
    }

    public async kickUser(guildId: Snowflake, userId: Snowflake) {
        const route = Routes.guildMember(guildId, userId);
        await this.rest.delete(route) as RESTDeleteAPIGuildMemberResult;
    }

    public async deleteMessage(channelId: Snowflake, messageId: Snowflake) {
        const route = Routes.channelMessage(channelId, messageId);
        await this.rest.delete(route) as RESTDeleteAPIChannelMessageResult;
    }

    public async sendFollowup(
        applicationId: Snowflake,
        interactionToken: string,
        body: RESTPostAPIInteractionFollowupJSONBody,
    ): Promise<APIMessage> {
        const route = Routes.webhook(applicationId, interactionToken);
        return await this.rest.post(route, { body }) as RESTPostAPIInteractionFollowupResult;
    }

    public async editFollowup(
        applicationId: Snowflake,
        interactionToken: string,
        body: RESTPatchAPIInteractionFollowupJSONBody,
    ): Promise<APIMessage> {
        const route = Routes.webhookMessage(applicationId, interactionToken, "@original");
        return await this.rest.patch(route, { body }) as RESTPatchAPIInteractionFollowupResult;
    }

    public async registerCommand(
        clientId: Snowflake,
        guildId: Snowflake,
        body: RESTPostAPIApplicationCommandsJSONBody
    ): Promise<APIApplicationCommand> {
        const route = Routes.applicationGuildCommands(clientId, guildId);
        const resp = await this.rest.post(route, { body }) as RESTPostAPIApplicationCommandsResult;
        return resp;
    }

    public async bulkRegisterCommands(
        clientId: Snowflake,
        guildId: Snowflake,
        body: RESTPutAPIApplicationGuildCommandsJSONBody
    ): Promise<RESTPutAPIApplicationGuildCommandsResult> {
        const route = Routes.applicationGuildCommands(clientId, guildId);
        return await this.rest.put(route, { body }) as RESTPutAPIApplicationGuildCommandsResult;
    }
}
