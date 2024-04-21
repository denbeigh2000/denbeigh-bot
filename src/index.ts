import { Env } from "@bot/env";
import { router } from "@bot/routes";
import { Sentry } from "@bot/sentry";
import { returnStatus } from "@bot/util/http";

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
