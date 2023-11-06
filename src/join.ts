import { APIUser } from "discord-api-types/payloads/v10";

import { BotClient, UserClient } from "./discord";
import { Env, getRoleIDFromRole } from "./env";
import { respond400, returnStatus } from "./http";
import { OAuthClient } from "./oauth";
import { Sentry } from "./sentry";
import { formatUser } from "./util";

export async function handleJoin(
    req: Request,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<Response> {
    const oauthClient = new OAuthClient(
        env.CLIENT_ID,
        env.CLIENT_SECRET,
        env.REDIRECT_URI,
        env.OAUTH_DB,
        env.OAUTH,
        sentry
    );
    const token = await oauthClient.getRefreshOrAuthorise(req);
    if (token instanceof Response) {
        return token;
    }

    const userClient = new UserClient(token, sentry);

    const user = await userClient.getUserInfo();
    if (!user) {
        // Just in case our token expires between those two calls...somehow
        return oauthClient.authorise();
    }

    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    const guildMember = await botClient.getGuildMember(
        env.GUILD_ID,
        user.id
    );
    if (guildMember) {
        // We are already in this server
        return Response.redirect(
            `https://discord.com/channels/${env.GUILD_ID}/${env.GENERAL_CHANNEL}`
        );
    }

    const username = formatUser(user);
    let applyRole: string | null = null;

    const preauthKey = `preauth:${username}`;
    const preauth = await env.OAUTH.get(preauthKey);
    if (preauth) {
        applyRole = getRoleIDFromRole(env, parseInt(preauth))!;
        await env.OAUTH.delete(preauthKey);
    }

    const applyRoles = applyRole ? [applyRole] : [];
    try {
        await botClient.joinGuild(
            env.GUILD_ID,
            token,
            user.id,
            applyRoles
        );
    } catch (e) {
        return returnStatus(403, "either discord is down, or you're banned");
    }

    let channel = env.GENERAL_CHANNEL;
    if (!applyRole) {
        channel = env.HOLDING_CHANNEL;
        await postPendingMessage(botClient, env, user);
    }

    return Response.redirect(
        `https://discord.com/channels/${env.GUILD_ID}/${channel}`
    );
}

async function postPendingMessage(
    botClient: BotClient,
    env: Env,
    user: APIUser
) {
    await botClient.createMessage(env.PENDING_CHANNEL, {
        content: [
            `\`${formatUser(user)}\` has joined the waiting room.`,
            `What would you like to do?`,
            `<@&${env.MOD_ROLE}>`,
        ].join("\n\n"),
        components: [
            {
                type: 1,
                components: [
                    {
                        custom_id: `action_${user.id}`,
                        options: [
                            {
                                label: `Accept as Guest`,
                                value: `accept_guest`,
                                description: `Add the user with the Guest role`,
                                default: false,
                            },
                            {
                                label: `Accept as Member`,
                                value: `accept_member`,
                                description: `Add the user with the Member role`,
                                default: false,
                            },
                            {
                                label: `Accept as Moderator`,
                                value: `accept_moderator`,
                                description: `Add the user with the Moderator role`,
                                default: false,
                            },
                            {
                                label: `Ignore`,
                                value: `reject_ignore`,
                                description: `Do not add the user`,
                                default: false,
                            },
                            // TODO
                            // {
                            //     label: `Ban`,
                            //     value: `reject_ban`,
                            //     djscription: `Do not add the user, and ban them from the server`,
                            //     default: false
                            // }
                        ],
                        min_values: 1,
                        max_values: 1,
                        type: 3,
                    },
                ],
            },
        ],
    });
}

export async function handleRedirect(
    req: Request,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<Response> {
    const url = new URL(req.url);
    const params = new URLSearchParams(url.search);

    const code = params.get("code");
    if (!code) {
        return respond400();
    }

    const state = params.get("state");
    if (!state) {
        return respond400();
    }

    const oauthClient = new OAuthClient(
        env.CLIENT_ID,
        env.CLIENT_SECRET,
        env.REDIRECT_URI,
        env.OAUTH_DB,
        env.OAUTH,
        sentry
    );
    const ok = await oauthClient.checkState(state);
    if (!ok) {
        return respond400();
    }

    const token = await oauthClient.getToken(code);
    if (!token) {
        return respond400();
    }

    return new Response("", {
        status: 302,
        headers: new Headers({
            Location: "/join",
            "Set-Cookie": `auth=${token.accessToken}; Secure`,
        }),
    });
}
