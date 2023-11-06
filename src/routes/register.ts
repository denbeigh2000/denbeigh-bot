import { Env } from "../env";
import { BotClient, UserClient } from "../discord/client";
import { OAuthClient } from "../discord/oauth";
import { Sentry } from "../sentry";
import { returnStatus } from "../util/http";

import { command as InviteCommand } from "./interaction/invite";
import { command as GroupCommand } from "./interaction/group";
import { command as PromoteCommand } from "./interaction/promote";
import { command as NoWorkCommand } from "./interaction/nowork";
import { command as PingCommand } from "./interaction/ping";
import { command as HelpCommand } from "./interaction/help";

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
        return oauthClient.authorise();
    }

    if (user.id !== env.DENBEIGH_USER) {
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
