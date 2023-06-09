import { Router } from "itty-router";

import { Env } from "./env";
import { returnStatus } from "./http";
import { handleJoin, handleRedirect } from "./join";
import { handleInteraction } from "./interaction";
import { handleRegister } from "./commands";
import { Sentry } from "./sentry";

const ROUTER = Router();

ROUTER.get("/join", handleJoin);
ROUTER.get("/redirect", handleRedirect);
ROUTER.get("/register", handleRegister);
ROUTER.post("/interaction", handleInteraction);
ROUTER.all("*", () => returnStatus(418, "get lost"));

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: FetchEvent
    ): Promise<Response> {
        const sentry = new Sentry(request, env, ctx);
        try {
            return await ROUTER.handle(request, env, ctx, sentry);
        } catch (e) {
            sentry.sendException(e as Error);
            return returnStatus(500, "Internal Error");
        }
    },
};
