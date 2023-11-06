import { OAuthClient } from "../discord/oauth";
import { Env } from "../env";
import { Sentry } from "../sentry";
import { respond400 } from "../util/http";

export async function handler(
    req: Request,
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

