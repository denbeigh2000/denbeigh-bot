// https://discord.com/developers/docs/reference#image-formatting-cdn-endpoints

import { APIGuildMember, APIUser, Snowflake } from "discord-api-types/v10";
import { formatUser } from "../util";

const IMAGE_BASE = "https://cdn.discordapp.com";
const DISCORD_EPOCH = 1420070400000

export const COLOURS = {
    RED: 0xED4245,
    GREEN: 0x57F287,
    BLURPLE: 0xc9a2d7,
};


export function avatarURL(userID: string, avatarID: string): string {
    return `${IMAGE_BASE}/avatars/${userID}/${avatarID}.png`;
}

export function bannerURL(userID: string, bannerID: string): string {
    return `${IMAGE_BASE}/banners/${userID}/${bannerID}.png`;
}

// https://github.com/vegeta897/snow-stamp/blob/8908d48bcee4883a7c4146bb17aa73b73a9009ba/src/convert.js
export function convertSnowflakeToDate(snowflake: string): Date {
    // https://discord.com/developers/docs/reference#snowflakes
    const milliseconds = BigInt(snowflake) >> 22n
    return new Date(Number(milliseconds) + DISCORD_EPOCH)
}

export type GuildMemberUser = {
    type: "guildMember",
    data: APIGuildMember,
}

export type NonGuildMemberUser = {
    type: "user",
    data: APIUser,
}

export type SnowflakeUser = {
    type: "snowflake",
    data: Snowflake,
}

export type MultiUser = GuildMemberUser | NonGuildMemberUser | SnowflakeUser;

export function getMultiUserId(user: MultiUser): Snowflake {
    switch (user.type) {
        case "guildMember":
            return user.data.user!.id;
        case "user":
            return user.data.id;
        case "snowflake":
            return user.data;
    }
}

export function formatMultiUser(user: MultiUser): string {
    switch (user.type) {
        case "guildMember":
            return formatUser(user.data.user!);
        case "user":
            return formatUser(user.data);
        case "snowflake":
            return `<@${user.data}}>`;
    }
}

export function getMultiUserAvatar(user: MultiUser): string | undefined {
    let u: APIUser;
    switch (user.type) {
        case "snowflake":
            return undefined;
        case "user":
            u = user.data;
            break;
        case "guildMember":
            u = user.data.user!;
            break;
    }

    return u.avatar ? avatarURL(u.id, u.avatar) : undefined;
}
