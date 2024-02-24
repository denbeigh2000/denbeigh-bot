// https://discord.com/developers/docs/reference#image-formatting-cdn-endpoints

const IMAGE_BASE = "https://cdn.discordapp.com";
const DISCORD_EPOCH = 1420070400000


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
