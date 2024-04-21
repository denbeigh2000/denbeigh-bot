import { serialize as serializeCookie } from "cookie";
import { AUTH_COOKIE_NAME } from "@bot/auth";
import { Env } from "@bot/env";
import { Sentry } from "@bot/sentry";
import { authManagerFromEnv } from "@bot/util";
import { DEFAULT_HEADERS, respond400 } from "@bot/util/http";

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

    const authManager = await authManagerFromEnv(env, sentry);
    const exchange = await authManager.handleOAuthRedirect(code, state);
    const jwt = await authManager.createUserToken(exchange.user.id);

    return new Response("", {
        status: 302,
        headers: new Headers([
            // TODO: it'd be nice if we didn't hardcode this, and just
            // redirected to wherever the user wanted to go
            ["Location", "/join"],
            ["Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, jwt, { secure: true })],
            ...DEFAULT_HEADERS
        ]),
    });
}

