import { OAuthClient } from "../discord/oauth";
import { SessionManager } from "../discord/oauth/session";
import { Env, importJwtKey, importOauthKey } from "../env";
import { Sentry } from "../sentry";
import { respond400 } from "../util/http";

export async function handler(req: Request,
    env: Env,
    _ctx: ExecutionContext,
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

    const tokenKey = await importOauthKey(env.OAUTH_ENCRYPTION_KEY);
    const oauthClient = new OAuthClient({
        clientId: env.CLIENT_ID,
        clientSecret: env.CLIENT_SECRET,
        redirectUri: env.REDIRECT_URI,
        tokenKey,
        tokenDB: env.OAUTH_DB,
        stateKV: env.OAUTH,
        sentry
    });
    const ok = await oauthClient.checkState(state);
    if (!ok) {
        return respond400();
    }

    const token = await oauthClient.getToken(code);
    if (!token) {
        return respond400();
    }

    const jwtKey = await importJwtKey(env.JWT_SIGNING_KEY);
    const mgr = new SessionManager(jwtKey);

    const jwt = await mgr.sign({ discordID: token.user });

    return new Response("", {
        status: 302,
        headers: new Headers({
            // TODO: it'd be nice if we didn't hardcode this, and just
            // redirected to wherever the user wanted to go
            Location: "/join",
            "Set-Cookie": `auth=${jwt}; Secure`,
        }),
    });
}

