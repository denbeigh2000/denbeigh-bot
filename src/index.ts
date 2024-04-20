import { Env } from "./env";
import { router } from "./routes";
import buildScheduler from "./scheduler/registry";
import { Sentry } from "./sentry";
import { returnStatus } from "./util/http";

export default {
    async fetch(
        request: Request,
        env: Env,
        context: ExecutionContext,
    ): Promise<Response> {
        const sentry = new Sentry({ request, env, context });
        try {
            return await router.handle(request, env, context, sentry);
        } catch (e) {
            sentry.captureException(e);
            return returnStatus(500, "Internal Error");
        }
    },

    async scheduled(controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
        const sentry = new Sentry({ controller, env, context });
        const scheduler = buildScheduler(sentry);
        try {
            await scheduler.execute(controller, env, context);
        } catch (e) {
            sentry.captureException(e);
            console.error(`error running scheduled task: ${e}`);
        }
    }
};
