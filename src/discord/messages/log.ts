import { APIGuildMember, RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";
import { avatarURL, COLOURS, convertSnowflakeToDate, formatMultiUser, getMultiUserAvatar, getMultiUserId, GuildMemberUser, NonGuildMemberUser, SnowflakeUser } from "..";

import { Env, } from "../../env";
import { AuxRole, AUX_ROLE_META, Role, RoleMeta, ROLE_META } from "../../roles";
import { formatUser } from "../../util";

function renderRoleList(meta: RoleMeta): string {
    return `- ${meta.emoji} ${meta.friendlyName}`;
}

function renderRole(meta: RoleMeta): string {
    return `${meta.emoji} ${meta.friendlyName}`;
}

function toEpoch(d: Date): number {
    return Math.round(Number(d) / 1000);
}

export function bannedUser(
    env: Env,
    banner: APIGuildMember,
    bannee: GuildMemberUser | NonGuildMemberUser | SnowflakeUser,
    bannedAt: Date,
): RESTPostAPIChannelMessageJSONBody {
    const banneeID = getMultiUserId(bannee);
    const joinTS = toEpoch(convertSnowflakeToDate(banneeID));
    const banTS = toEpoch(bannedAt);
    const avatar = getMultiUserAvatar(bannee);

    const bannerUser = banner.user!;
    const bannerID = bannerUser.id;

    const thumbnail = avatar ? {
        url: avatar, height: 0, width: 0
    } : undefined;


    return {
        content: `<@&${env.MOD_ROLE}>`,
        embeds: [
            {
                title: "User banned",
                description: formatMultiUser(bannee),
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
                thumbnail,
                author: {
                    name: formatUser(bannerUser),
                    icon_url: avatar,
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
    const admitTS = toEpoch(admittedAt);

    const admitterUser = admitter.user!;
    const admitterID = admitterUser.id;

    const admitteeUser = admittee.user!;
    const admitteeID = admitteeUser.id;

    const thumbnail = admitteeUser.avatar ? {
        url: avatarURL(admitteeID, admitteeUser.avatar),
        height: 0,
        width: 0
    } : undefined;
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
                        value: auxRoles.map(r => renderRoleList(AUX_ROLE_META[r])).join('\n'),
                    },
                    {
                        name: "Admitted",
                        value: `<t:${admitTS}:R>`,
                    },
                ],
                timestamp: admittedAt.toISOString(),
                thumbnail,
                author: {
                    name: formatUser(admitterUser),
                    icon_url: admitterUser.avatar ? avatarURL(admitterID, admitterUser.avatar) : undefined,
                }
            }
        ],
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [admitteeID, admitterID],
        },
    };
}

export function changedRole(
    env: Env,
    actor: APIGuildMember,
    target: APIGuildMember,
    changedAt: Date,
    newRole: Role,
): RESTPostAPIChannelMessageJSONBody {
    const changeTS = toEpoch(changedAt);

    const actorID = actor.user!.id;
    const actorUser = actor.user!;
    const targetUser = target.user!;

    const thumbnail = targetUser.avatar ? {
        url: avatarURL(targetUser.id, targetUser.avatar),
        height: 0,
        width: 0
    } : undefined;

    // Use either the user's accent colour, or blurple
    const colour = targetUser.accent_color || COLOURS.BLURPLE;
    return {
        content: `<@&${env.MOD_ROLE}>`,
        embeds: [
            {
                title: "User role changed",
                description: `<@${targetUser.id}>`,
                color: colour,
                fields: [
                    {
                        name: "Changed by",
                        value: `<@${actorID}>`
                    },
                    {
                        name: "New Role",
                        value: renderRole(ROLE_META[newRole]),
                    },
                    {
                        name: "Changed at",
                        value: `<t:${changeTS}:R>`,
                    },
                ],
                timestamp: changedAt.toISOString(),
                thumbnail,
                author: {
                    name: formatUser(actorUser),
                    icon_url: actorUser.avatar ? avatarURL(actorID, actorUser!.avatar) : undefined,
                }
            }
        ],
        allowed_mentions: {
            roles: [env.MOD_ROLE],
            users: [targetUser.id, actorID],
        },
    };
}
