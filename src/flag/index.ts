import { Snowflake } from "discord-api-types/globals";
import { getName as getCountryName, toAlpha2 } from "i18n-iso-countries";
import { BotClient } from "../discord/client";
import { Sentry } from "../sentry";
import { FlagRole, FlagRoleStore } from "./store";

const LETTER_OFFSET = 127462;

function emojiLetter(letter: string): string {
    const distFromA = parseInt(letter[0], 36) - 10
    return String.fromCodePoint(LETTER_OFFSET + distFromA);
}

function emojiFromCode(code: string): string {
    if (code.length !== 2) {
        throw `bad code len ${code.length}`;
    }

    const [a, b] = [code[0], code[1]];
    return emojiLetter(a) + emojiLetter(b);
}

export class FlagManager {
    botClient: BotClient;
    guildID: Snowflake;
    roleStore: FlagRoleStore;
    sentry: Sentry;

    constructor(flagDB: D1Database, botClient: BotClient, guildID: Snowflake, sentry: Sentry) {
        this.guildID = guildID;
        this.botClient = botClient;
        this.roleStore = new FlagRoleStore(flagDB, sentry);
    }

    public async setFlag(userID: Snowflake, code: string) {
        const countryCode = toAlpha2(code);
        if (!countryCode) {
            // TODO: better handling
            throw `Invalid country code ${code}`;
        }

        const user = await this.botClient.getGuildMember(this.guildID, userID);
        if (!user) {
            // TODO: better handling
            throw `User <@${userID}> is not in this guild`;
        }

        const role = await this.getOrCreate(countryCode);
        const allRoles = await this.roleStore.listRoles();
        const toRemove = user.roles.filter(id => allRoles.has(id) && id !== role.roleID);

        await this.botClient.addRole(this.guildID, userID, role.roleID);
        await Promise.all(toRemove.map(id =>
            this.botClient.removeRole(this.guildID, userID, id)));
        await this.roleStore.linkUser(userID, countryCode);
    }

    public async unsetFlag(userID: Snowflake) {
        const user = await this.botClient.getGuildMember(this.guildID, userID);
        if (!user) {
            // TODO: better handling
            throw `User <@${userID}> is not in this guild`;
        }

        const allRoles = await this.roleStore.listRoles();
        const toRemove = user.roles.filter(id => allRoles.has(id));
        await Promise.all(toRemove.map(id =>
            this.botClient.removeRole(this.guildID, userID, id)));
        await this.roleStore.unlinkUser(userID);
    }

    public async flushUnusedFlags(): Promise<Snowflake[]> {
        const key = Math.round(Math.random() * 3600);
        const ids = await this.roleStore.markTombstoned(key);
        if (!ids) {
            console.info("no unused roles, returning early");
        }

        await Promise.all(ids.map(id => this.botClient.deleteRole(this.guildID, id)));
        await this.roleStore.sweepTombstoned(key);

        return ids;
    }

    private async getOrCreate(countryCode: string): Promise<FlagRole> {
        const role = await this.roleStore.get(countryCode);
        if (role) {
            return role;
        }
        // We should have a valid country name here, because we would have
        // thrown before otherwise.
        const name = getCountryName(countryCode, "en", { select: "alias" })!;
        const emoji = emojiFromCode(countryCode);
        const newRole = await this.botClient.createRole(this.guildID, name, false, undefined, emoji);
        const newNewRole = await this.roleStore.create({ roleID: newRole.id, countryCode: countryCode });
        // we raced somebody else...
        if (newNewRole.roleID !== newRole.id) {
            this.botClient.deleteRole(this.guildID, newRole.id);
        }

        return newNewRole;
    }
}
