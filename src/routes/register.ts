import { getAuthToken } from "@bot/auth";
import { BotClient } from "@bot/discord/client";
import { getRouter } from "@bot/discord/interactionRouter/registry";
import { Env } from "@bot/env";
import { Sentry } from "@bot/sentry";
import { authManagerFromEnv } from "@bot/util";
import { DEFAULT_HEADERS, returnStatus } from "@bot/util/http";

export async function handler(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const authManager = await authManagerFromEnv(env, sentry);
    const givenJWT = getAuthToken(req);
    if (!givenJWT) {
        const uri = await authManager.initAuthorisation();
        return Response.redirect(uri);
    }

    const { discordUser } = await authManager.getFromToken(givenJWT);
    if (discordUser.id !== env.DENBEIGH_USER) {
        return returnStatus(403, "locals only\n");
    }

    await new BotClient(env.BOT_TOKEN, sentry).bulkRegisterCommands(
        env.CLIENT_ID,
        env.GUILD_ID,
        getRouter(env, sentry).getCommandSpec(),
    );

    return new Response("OK\n", { headers: DEFAULT_HEADERS });
}
