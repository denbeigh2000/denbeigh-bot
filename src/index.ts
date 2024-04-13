import { Env } from "./env";
import { router } from "./routes";
import { Sentry } from "./sentry";
import { returnStatus } from "./util/http";

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<Response> {
        const sentry = new Sentry(request, env, ctx);
        try {
            return await router.handle(request, env, ctx, sentry);
        } catch (e) {
            sentry.captureException(e);
            return returnStatus(500, "Internal Error");
        }
    },
};
