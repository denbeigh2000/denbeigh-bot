import { RESTJSONErrorCodes } from "discord-api-types/v10";

import { BotClient, UserClient } from "../discord/client";
import { authorisePendingUser } from "../discord/messages/join";
import { getAuthToken, OAuthClient } from "../discord/oauth";
import { SessionManager } from "../discord/oauth/session";
import { Env, importJwtKey, importOauthKey } from "../env";
import { roleToID } from "../roles";
import { Sentry } from "../sentry";
import { formatUser } from "../util";
import { DEFAULT_HEADERS, returnStatus } from "../util/http";
import { StateStore } from "./interaction/authorise/statestore";

export async function handler(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
): Promise<Response> {

    const [tokenKey, jwtKey] = await Promise.all([
        importOauthKey(env.OAUTH_ENCRYPTION_KEY),
        importJwtKey(env.JWT_SIGNING_KEY),
    ]);

    const sessionManager = new SessionManager(jwtKey);
    const oauthClient = new OAuthClient({
        clientId: env.CLIENT_ID,
        clientSecret: env.CLIENT_SECRET,
        redirectUri: env.REDIRECT_URI,
        tokenKey,
        tokenDB: env.OAUTH_DB,
        stateKV: env.OAUTH,
        sentry,
    });

    const givenToken = getAuthToken(req);
    if (!givenToken) {
        // TODO: return redirect to auth
        // throw new Error("no auth token?")
        return oauthClient.authorise();
    }

    const info = await sessionManager.decode(givenToken);
    const token = await oauthClient.retrieveToken(info.discordID);
    if (!token) {
        return oauthClient.authorise();
    }

    const userClient = new UserClient(token, sentry);
    const user = await userClient.getUserInfo();
    if (!user) {
        // Just in case our token expires between those two calls...somehow
        return oauthClient.authorise();
    }

    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    let guildMember = await botClient.getGuildMember(env.GUILD_ID, user.id);
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
        const stateStore = new StateStore(env.OAUTH_DB, sentry);
        const msg = authorisePendingUser(env, guildMember!);
        // NOTE: don't create a new message (and conflicting DB entry) if the
        // user already has a pending entry in the server
        const existingMsg = await stateStore.getActionMessage(user.id);
        if (!existingMsg) {
            const createdMsg = await botClient.createMessage(env.PENDING_CHANNEL, msg);
            await stateStore.insertActionMessage(user.id, createdMsg.id);
        }
    }

    return Response.redirect(
        `https://discord.com/channels/${env.GUILD_ID}/${channel}`,
    );
}
