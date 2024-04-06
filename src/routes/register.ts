import { Env, importOauthKey } from "../env";
import { BotClient } from "../discord/client";
import { getAuthToken } from "../discord/oauth";
import { Sentry } from "../sentry";
import { returnStatus } from "../util/http";

import { command as InviteCommand } from "./interaction/invite";
import { command as GroupCommand } from "./interaction/group";
import { command as PromoteCommand } from "./interaction/promote";
import { command as NoWorkCommand } from "./interaction/nowork";
import { command as PingCommand } from "./interaction/ping";
import { command as HelpCommand } from "./interaction/help";
import { SessionManager } from "../discord/oauth/session";

const ALL_COMMANDS = [
    InviteCommand,
    GroupCommand,
    PromoteCommand,
    PingCommand,
    NoWorkCommand,
    HelpCommand,
];

export async function handler(
    req: Request,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const tokenKey = await importOauthKey(env.OAUTH_ENCRYPTION_KEY);
    const sessionManager = new SessionManager(tokenKey);
    const givenJWT = getAuthToken(req);
    if (!givenJWT) {
        // TODO: this.authorise()?
        throw new Error("no auth?");
    }

    const { discordID } = await sessionManager.decode(givenJWT);
    // TODO: should we re-check this token here?
    if (discordID !== env.DENBEIGH_USER) {
        return returnStatus(403, "locals only\n");
    }

    const client = new BotClient(env.BOT_TOKEN, sentry);
    await client.bulkRegisterCommands(
        env.CLIENT_ID,
        env.GUILD_ID,
        ALL_COMMANDS
    );

    return new Response("OK\n");
}
