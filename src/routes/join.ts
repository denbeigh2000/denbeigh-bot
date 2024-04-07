import { RESTJSONErrorCodes } from "discord-api-types/v10";
import { getAuthToken } from "../auth";
import { TokenResponse } from "../auth/authManager";

import { BotClient } from "../discord/client";
import { authorisePendingUser } from "../discord/messages/join";
import { Env } from "../env";
import { roleToID } from "../roles";
import { Sentry } from "../sentry";
import { authManagerFromEnv, formatUser } from "../util";
import { returnStatus } from "../util/http";
import { StateStore } from "./interaction/authorise/statestore";

export async function handler(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
): Promise<Response> {

    const authManager = await authManagerFromEnv(env, sentry);
    const givenToken = getAuthToken(req);
    if (!givenToken) {
        return Response.redirect(await authManager.initAuthorisation());
    }

    let data: TokenResponse;
    try {
        data = await authManager.getFromToken(givenToken);
    } catch (e) {
        sentry.captureMessage("failed to validate session", "warning", {
            originalException: e,
        });

        // TODO: better verification, we're assuming this is a valid AuthManagerErrorCode
        if (e.code) {
            return Response.redirect(await authManager.initAuthorisation());
        }

        throw e;
    }

    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    let guildMember = await botClient.getGuildMember(env.GUILD_ID, data.discordUser.id);
    if (guildMember) {
        // We are already in this server
        return Response.redirect(
            `https://discord.com/channels/${env.GUILD_ID}/${env.GENERAL_CHANNEL}`
        );
    }

    const username = formatUser(data.discordUser);
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
            data.discordToken,
            data.discordUser.id,
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
        const existingMsg = await stateStore.getActionMessage(data.discordUser.id);
        if (!existingMsg) {
            const createdMsg = await botClient.createMessage(env.PENDING_CHANNEL, msg);
            await stateStore.insertActionMessage(data.discordUser.id, createdMsg.id);
        }
    }

    return Response.redirect(
        `https://discord.com/channels/${env.GUILD_ID}/${channel}`,
    );
}
