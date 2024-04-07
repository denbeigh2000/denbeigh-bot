import { getAuthToken } from "../auth";
import { BotClient } from "../discord/client";
import { getRouter } from "../discord/interactionRouter/registry";
import { Env } from "../env";
import { Sentry } from "../sentry";
import { authManagerFromEnv } from "../util";
import { DEFAULT_HEADERS, returnStatus } from "../util/http";

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
