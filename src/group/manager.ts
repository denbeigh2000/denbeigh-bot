import { APIRole, APIGuildMember } from "discord-api-types/v10";
import { BotClient } from "@bot/discord/client/bot";

const PREFIX = "group-";

const ROLE_COLOURS = [
    // Light cyan
    1752220,
    // Dark cyan
    1146986,
    // Light green
    3066993,
    // Dark green
    2067276,
    // Light blue
    3447003,
    // Dark blue
    2123412,
    // Light purple
    10181046,
    // Dark purple
    7419530,
    // Light red
    15277667,
    // Dark red
    11342935,
    // Light yellow
    15844367,
    // Dark yellow
    12745742,
    // Light gold
    15105570,
    // Dark gold
    11027200,
    // Light brown
    15158332,
    // Dark brown
    10038562,
    // Light gray
    9807270,
    // Dark gray
    9936031,
];

// https://css-tricks.com/snippets/javascript/random-hex-color/
function randomColour(): number {
    const idx = Math.floor(Math.random() * ROLE_COLOURS.length);
    return ROLE_COLOURS[idx];
}

export class Group {
    name: string;
    roleId: string;

    constructor(name: string, roleId: string) {
        this.name = name;
        this.roleId = roleId;
    }

    public roleName(): string {
        return `${PREFIX}${this.name}`;
    }
}

export class GroupManager {
    client: BotClient;
    guildId: string;

    constructor(
        discordClient: BotClient,
        guildId: string,
    ) {
        this.client = discordClient;
        this.guildId = guildId;
    }

    public async listGroups(): Promise<Group[]> {
        const roles = await this.client.listRoles(this.guildId);
        return roles
            .filter((role: APIRole) => role.name.startsWith(PREFIX))
            .map(
                (role: APIRole) =>
                    new Group(
                        role.name.substring(PREFIX.length),
                        role.id
                    )
            );
    }

    public async getGuildMember(
        userId: string
    ): Promise<APIGuildMember | null> {
        return await this.client.getGuildMember(this.guildId, userId);
    }

    public async createGroup(
        name: string
    ): Promise<[Group, boolean]> {
        const groups = await this.listGroups();
        const existing = groups.find((group) => group.name === name);
        if (existing) {
            return [existing, true];
        }

        const groupName = `${PREFIX}${name}`;
        const newRole = await this.client.createRole(
            this.guildId,
            groupName,
            true,
            randomColour()
        );
        const newGroup = new Group(name, newRole.id);
        return [newGroup, false];
    }

    public async deleteGroup(name: string): Promise<Group | null> {
        const groups = await this.listGroups();
        const group = groups.find((g) => g.name === name);
        if (!group) {
            return null;
        }

        await this.client.deleteRole(this.guildId, group.roleId);
        return group;
    }

    public async joinGroup(
        name: string,
        userId: string
    ): Promise<Group | null> {
        const groups = await this.listGroups();
        const group = groups.find((g) => g.name === name);
        if (!group) {
            return null;
        }

        await this.client.addRole(this.guildId, userId, group.roleId);
        return group;
    }

    public async leaveGroup(
        name: string,
        userId: string
    ): Promise<Group | null> {
        const groups = await this.listGroups();
        const group = groups.find((g) => g.name === name);
        if (!group) {
            return null;
        }

        await this.client.removeRole(
            this.guildId,
            userId,
            group.roleId
        );
        return group;
    }
}
