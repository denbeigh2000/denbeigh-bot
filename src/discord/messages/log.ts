import { APIGuildMember, RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import { avatarURL, convertSnowflakeToDate } from "..";

import { Env, } from "../../env";
import { AuxRole, AUX_ROLE_META, Role, RoleMeta, ROLE_META } from "../../roles";
import { formatUser } from "../../util";

function renderRole(meta: RoleMeta): string {
    return `- ${meta.emoji} ${meta.friendlyName}`;
}

const COLOURS = {
    RED: 0xED4245,
    GREEN: 0x57F287,
};

export function bannedUser(
    env: Env,
    banner: APIGuildMember,
    bannee: APIGuildMember,
    bannedAt: Date,
): RESTPostAPIChannelMessageJSONBody {
    const joinTS = Number(convertSnowflakeToDate(bannee.user!.id)) / 1000;
    const banTS = Number(bannedAt) / 1000;

    const banneeUser = bannee.user!;
    const banneeID = banneeUser.id;

    const bannerUser = banner.user!;
    const bannerID = bannerUser.id;

    return {
        content: `<@&${env.MOD_ROLE}>`,
        embeds: [
            {
                title: "User admitted",
                description: formatUser(banneeUser),
                color: COLOURS.RED,
                fields: [
                    {
                        name: "Banned by",
                        value: `<@${bannerID}>`
                    },
                    {
                        name: "Banned",
                        value: `<t:${banTS}:R>`,
                    },
                    {
                        name: "Joined discord",
                        value: `<t:${joinTS}:R>`,
                    }
                ],
                timestamp: bannedAt.toISOString(),
                thumbnail: {
                    // TODO: avatar id can be null?
                    url: avatarURL(banneeID, banneeUser.avatar!),
                    height: 0,
                    width: 0
                },
                author: {
                    name: formatUser(bannerUser),
                    // TODO: avatar id can be null?
                    icon_url: avatarURL(bannerID, bannerUser.avatar!),
                }
            }
        ],
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [bannerID],
        },
    };
}

export function admittedUser(
    env: Env,
    admitter: APIGuildMember,
    admittee: APIGuildMember,
    admittedAt: Date,
    role: Role,
    auxRoles: AuxRole[],
): RESTPostAPIChannelMessageJSONBody {
    const admitTS = Number(admittedAt) / 1000;

    const admitterUser = admitter.user!;
    const admitterID = admitterUser.id;

    const admitteeUser = admittee.user!;
    const admitteeID = admitteeUser.id;

    return {
        content: `<@&${env.MOD_ROLE}>`,
        embeds: [
            {
                title: "User admitted",
                description: formatUser(admitteeUser),
                color: COLOURS.GREEN,
                fields: [
                    {
                        name: "Admitted by",
                        value: `<@${admitterID}>`
                    },
                    {
                        name: "Role",
                        value: renderRole(ROLE_META[role]),
                    },
                    {
                        name: "Extra roles",
                        value: auxRoles.map(r => renderRole(AUX_ROLE_META[r])).join('\n'),
                    },
                    {
                        name: "Admitted",
                        value: `<t:${admitTS}:R>`,
                    },
                ],
                timestamp: admittedAt.toISOString(),
                thumbnail: {
                    // TODO: avatar id can be null?
                    url: avatarURL(admitteeID, admitteeUser.avatar!),
                    height: 0,
                    width: 0
                },
                author: {
                    name: formatUser(admitterUser),
                    // TODO: avatar id can be null?
                    icon_url: avatarURL(admitterID, admitterUser.avatar!),
                }
            }
        ],
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [admitteeID, admitterID],
        },
    };
}
