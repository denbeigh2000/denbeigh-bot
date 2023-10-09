import { Snowflake } from "discord-api-types/globals";
import {
    APIUser,
    APIGuildMember,
    APIRole,
} from "discord-api-types/payloads/v10";
import {
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIChannelMessageJSONBody,
    RESTPutAPIApplicationGuildCommandsJSONBody,
    RESTPostAPIChannelMessageResult,
    RESTPostAPIInteractionFollowupJSONBody,
    RESTPatchAPIInteractionFollowupJSONBody,
    RESTPatchAPIChannelMessageResult,
} from "discord-api-types/rest/v10";
import { Env, Roles } from "./env";
import { Sentry } from "./sentry";

const API_BASE = "https://discord.com/api";
const API_IDENTITY = `${API_BASE}/users/@me`;

// Sample auth URL:
// https://discord.com/api/oauth2/authorize?response_type=code&client_id=157730590492196864&scope=identify%20guilds.join&state=15773059ghq9183habn&redirect_uri=https%3A%2F%2Fnicememe.website&prompt=consent
//
// Sample redirect URL:
// https://findingfakeurlsisprettyhard.tv/#access_token=RTfP0OK99U3kbRtHOoKLmJbOn45PjL&token_type=Bearer&expires_in=604800&scope=identify&state=15773059ghq9183habn

type HttpMethod =
    | "GET"
    | "PATCH"
    | "PUT"
    | "POST"
    | "DELETE"
    | "OPTIONS";

interface HeaderMap {
    [key: string]: string;
}

export function getUserRole(
    env: Env,
    userRoles: string[]
): Roles | null {
    // This code is very messy if we don't build this map
    const validRoles = new Map([
        [env.MOD_ROLE, Roles.Moderator],
        [env.MEMBER_ROLE, Roles.Member],
        [env.GUEST_ROLE, Roles.Guest],
    ]);

    const validUserRoles = userRoles
        .filter((i) => validRoles.has(i))
        .map((k) => validRoles.get(k)!);
    if (!validUserRoles) {
        return null;
    }
    validUserRoles.sort((a, b) => a - b);
    return validUserRoles[0];
}

export function renderUser(user: APIUser): string {
    return `<@${user.id}> (\`${user.username}#${user.discriminator}\`)`;
}

class Client {
    token: string;
    clientType = "";
    tokenType = "";
    sentry: Sentry;

    constructor(token: string, sentry: Sentry) {
        this.sentry = sentry;
        this.token = token;
    }

    protected getHeaders(): HeaderMap {
        return {
            Authorization: `${this.tokenType} ${this.token}`,
        };
    }

    protected async request(
        message: string,
        url: string,
        method: HttpMethod,
        body?: string,
        contentType?: string
    ): Promise<Response | null> {
        const headers = this.getHeaders();
        if (contentType) {
            headers["Content-Type"] = contentType;
        }
        const req = new Request(url, {
            body,
            headers,
            method,
        });

        const resp = await fetch(req);

        this.sentry.addBreadcrumb({
            timestamp: Date.now(),
            message: `Discord ${this.clientType} request: ${message}`,
            category: "discord",
            type: "http",
            data: {
                url: req.url,
                method: req.method,
                status_code: resp.status,
                reason: resp.statusText,
            },
        });

        if (!(await this.checkResponse(resp))) {
            return null;
        }

        return resp;
    }

    protected async checkResponse(
        response: Response
    ): Promise<Response | null> {
        const { status } = response;
        if (status >= 400) {
            const body = await response.text();
            this.sentry.setExtras({ status, body });

            if (status >= 500) {
                this.sentry.sendMessage(
                    "Discord internal error",
                    "error"
                );
                throw new Error(
                    `Discord error: status ${response.status} ${response.statusText} (${body})`
                );
            }

            if (status !== 404) {
                this.sentry.sendMessage(
                    "Bad Discord request",
                    "warning"
                );
            }

            return null;
        }

        return response;
    }
}

export class BotClient extends Client {
    clientType = "Bot";
    tokenType = "Bot";

    public async joinGuild(
        guildId: string,
        userToken: string,
        userId: string,
        roles?: string[]
    ): Promise<APIUser | null> {
        const data = JSON.stringify({
            access_token: userToken,
            roles,
        });
        const url = `${API_BASE}/guilds/${guildId}/members/${userId}`;
        const resp = await this.request(
            "Join guild",
            url,
            "PUT",
            data,
            "application/json"
        );
        if (!resp) {
            throw new Error("4xx error at joinGuild");
        }

        if (resp.status === 204) {
            return null;
        }

        const body = await resp.text();
        return JSON.parse(body);
    }

    public async getGuildMember(
        guildId: string,
        userId: string
    ): Promise<APIGuildMember | null> {
        const resp = await this.request(
            "Get guild members",
            `${API_BASE}/guilds/${guildId}/members/${userId}`,
            "GET"
        );
        if (!resp) {
            return null;
        }

        return JSON.parse(await resp.text());
    }

    public async createMessage(
        channelId: string,
        messageContent: RESTPostAPIChannelMessageJSONBody
    ): Promise<RESTPostAPIChannelMessageResult> {
        const data = JSON.stringify(messageContent);
        const resp = await this.request(
            "Create message",
            `${API_BASE}/channels/${channelId}/messages`,
            "POST",
            data,
            "application/json"
        );
        if (!resp) {
            throw new Error("Failed to post discord message");
        }

        return await resp.json();
    }

    public async editMessage(
        channelId: Snowflake,
        messageId: Snowflake,
        content: RESTPostAPIChannelMessageJSONBody,
    ): Promise<RESTPatchAPIChannelMessageResult> {
        const data = JSON.stringify(content);
        const resp = await this.request(
            "Edit message",
            `${API_BASE}/channels/${channelId}/messages/${messageId}`,
            "PATCH",
            data,
            "application/json"
        );
        if (!resp) {
            throw new Error("Failed to edit discord message");
        }

        return await resp.json();
    }

    public async setManagedRole(
        guildId: string,
        managedRoles: string[],
        userId: string,
        role: string
    ) {
        await Promise.all(
            managedRoles.map((r) =>
                this.removeRole(guildId, userId, r)
            )
        );

        await this.addRole(guildId, userId, role);
    }

    public async listRoles(guildId: string): Promise<APIRole[]> {
        const resp = await this.request(
            "List roles",
            `${API_BASE}/guilds/${guildId}/roles`,
            "GET"
        );
        if (!resp) {
            throw new Error("Failed to list guild roles");
        }
        return await resp.json();
    }

    public async createRole(
        guildId: string,
        name: string,
        mentionable?: boolean,
        colour?: number
    ): Promise<APIRole> {
        const data = JSON.stringify({
            name,
            mentionable,

            // NOTE: Discord require the wrong spelling
            color: colour,
        });

        const resp = await this.request(
            "Create role",
            `${API_BASE}/guilds/${guildId}/roles`,
            "POST",
            data,
            "application/json"
        );
        if (!resp) {
            throw new Error("Failed to create guild role");
        }
        return resp.json();
    }

    public async deleteRole(guildId: string, roleId: string) {
        await this.request(
            "Delete role",
            `${API_BASE}/guilds/${guildId}/roles/${roleId}`,
            "DELETE"
        );
    }

    public async addRole(
        guildId: string,
        userId: string,
        roleId: string
    ) {
        const resp = await this.request(
            "Add role",
            `${API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
            "PUT"
        );
        if (!resp) {
            throw new Error("Failed to add role");
        }
    }

    public async removeRole(
        guildId: string,
        userId: string,
        roleId: string
    ) {
        const resp = await this.request(
            "Remove role",
            `${API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
            "DELETE"
        );
        if (!resp) {
            throw new Error("Failed to remove role");
        }
    }

    public async kickUser(guildId: string, userId: string) {
        const resp = await this.request(
            "Kick user",
            `${API_BASE}/guilds/${guildId}/members/${userId}`,
            "DELETE"
        );
        if (!resp) {
            throw new Error("Failed to kick user");
        }
    }

    public async deleteMessage(channelId: string, messageId: string) {
        const resp = await this.request(
            "Delete message",
            `${API_BASE}/channels/${channelId}/messages/${messageId}`,
            "DELETE"
        );
        if (!resp) {
            throw new Error("Failed to delete message");
        }
    }

    public async sendFollowup(
        applicationId: string,
        interactionToken: string,
        data: RESTPostAPIInteractionFollowupJSONBody,
    ) {
        const url = `${API_BASE}/webhooks/${applicationId}/${interactionToken}`;
        const resp = await this.request(
            "Send interaction followup",
            url,
            "POST",
            JSON.stringify(data),
            "application/json"
        );
        if (!resp) {
            throw new Error("Failed to send followup");
        }
    }

    public async editFollowup(
        applicationId: string,
        interactionToken: string,
        data: RESTPatchAPIInteractionFollowupJSONBody,
    ) {
        const rawData = JSON.stringify(data);
        const url = `${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
        const resp = await this.request(
            "Edit interaction followup",
            url,
            "PATCH",
            rawData,
            "application/json"
        );
        if (!resp) {
            throw new Error("Failed to edit followup");
        }
    }

    public async registerCommand(
        clientId: string,
        guildId: string,
        data: RESTPostAPIChatInputApplicationCommandsJSONBody
    ) {
        const rawData = JSON.stringify(data);
        const url = `${API_BASE}/applications/${clientId}/guilds/${guildId}/commands`;
        const resp = await this.request(
            "Register command",
            url,
            "POST",
            rawData,
            "application/json"
        );
        if (!resp) {
            throw new Error("application registering failed");
        }
    }

    public async bulkRegisterCommands(
        clientId: string,
        guildId: string,
        data: RESTPutAPIApplicationGuildCommandsJSONBody
    ) {
        const rawData = JSON.stringify(data);
        const url = `${API_BASE}/applications/${clientId}/guilds/${guildId}/commands`;
        const resp = await this.request(
            "Register commands (bulk)",
            url,
            "PUT",
            rawData,
            "application/json"
        );
        if (!resp) {
            throw new Error("application registering failed");
        }
    }
}

export class UserClient extends Client {
    clientType = "User";
    tokenType = "Bearer";

    public async getUserInfo(): Promise<APIUser | null> {
        const response = await this.request(
            "Get user info",
            API_IDENTITY,
            "GET"
        );
        if (!response) {
            return null;
        }

        const body = await response.text();
        const user = JSON.parse(body);
        this.sentry.setUser(user);
        return user;
    }
}
