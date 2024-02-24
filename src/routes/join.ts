import { RESTJSONErrorCodes } from "discord-api-types/v10";

import { BotClient, UserClient } from "../discord/client";
import { authorisePendingUser } from "../discord/messages/join";
import { OAuthClient } from "../discord/oauth";
import { Env, getRoleIDFromRole } from "../env";
import { roleToID } from "../roles";
import { Sentry } from "../sentry";
import { formatUser } from "../util";
import { returnStatus } from "../util/http";

export async function handler(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
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
    let guildMember = await botClient.getGuildMember(
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
        applyRole = roleToID(env, parseInt(preauth))!;
        await env.OAUTH.delete(preauthKey);
    }

    const applyRoles = applyRole ? [applyRole] : [];
    try {
        guildMember = await botClient.joinGuild(
            env.GUILD_ID,
            token,
            user.id,
            applyRoles
        );
    } catch (e) {
        // TODO: Handle this within BotClient.joinGuild
        // (implement error class, reason enums, etc)
        if (e.code && e.code === RESTJSONErrorCodes.UserBannedFromThisGuild) {
            return returnStatus(403, "you are banned");
        }

        throw e;
    }

    let channel = env.GENERAL_CHANNEL;
    if (!applyRole) {
        channel = env.HOLDING_CHANNEL;
        const msg = authorisePendingUser(env, guildMember!);
        await botClient.createMessage(env.PENDING_CHANNEL, msg);
    }

    return Response.redirect(
        `https://discord.com/channels/${env.GUILD_ID}/${channel}`
    );
}
