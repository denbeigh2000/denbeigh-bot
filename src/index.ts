import { serialize as serializeCookie } from "cookie";

import { Env } from "./env";
import { router } from "./routes";
import { Sentry } from "./sentry";
import { returnStatus } from "./util/http";

const A_LONG_TIME_AGO = new Date(0);
const OLD_AUTH_HEADER = "auth";

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<Response> {
        const sentry = new Sentry(request, env, ctx);
        try {
            const resp = await router.handle(request, env, ctx, sentry);
            if (!resp.headers) {
                resp.headers = new Headers();
            }

            // Clear old cookie to avoid leakage
            const cookie = serializeCookie(OLD_AUTH_HEADER, "deleted", { expires: A_LONG_TIME_AGO });
            resp.headers.append("Set-Cookie", cookie);
            return resp;
        } catch (e) {
            sentry.captureException(e);
            return returnStatus(500, "Internal Error");
        }
    },
};
