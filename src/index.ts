import { Router, IRequest } from "itty-router";

import { Env } from "./env";
import { handler as handleJoin } from "./routes/join";
import { handler as handleRedirect } from "./routes/redirect";
import { handler as handleInteraction } from "./routes/interaction";
import { handler as handleRegister } from "./routes/register";
import { Sentry } from "./sentry";
import { respondNotFound, returnStatus } from "./util/http";

type RequestType = [Env, ExecutionContext, Sentry];

const ROUTER = Router<IRequest, RequestType>();

ROUTER.get("/join", handleJoin);
ROUTER.get("/redirect", handleRedirect);
ROUTER.get("/register", handleRegister);
ROUTER.post("/interaction", handleInteraction);
ROUTER.all("*", respondNotFound);

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<Response> {
        const sentry = new Sentry(request, env, ctx);
        try {
            return await ROUTER.handle(request, env, ctx, sentry);
        } catch (e) {
            sentry.captureException(e);
            return returnStatus(500, "Internal Error");
        }
    },
};
