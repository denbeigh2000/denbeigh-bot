import { Env } from "../env";
import { Sentry } from "../sentry";

export type ExecutionFn = (time: Date, env: Env, ctx: ExecutionContext, sentry: Sentry) => Promise<void>;

export interface Registration {
    key: string,
    fn: ExecutionFn,
}

export class Scheduler {
    registrations: Record<string, Registration> = {};
    sentry: Sentry;

    constructor(sentry: Sentry) {
        this.sentry = sentry;
    }

    async execute(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        const registration = this.registrations[event.cron];
        this.sentry.setTag("source", "scheduled");
        this.sentry.setExtras({ cron_expr: event.cron });
        if (!registration) {
            // Hoping this will have the cron expr included from setExtras
            // above
            const msg = "found no event for cron expr";
            this.sentry.captureMessage(msg, "warning");
        }

        this.sentry.setTag("event_key", registration.key);
        const time = new Date(event.scheduledTime);
        await registration.fn(time, env, ctx, this.sentry);
    }

    register(cronExpr: string, key: string, fn: ExecutionFn) {
        if (this.registrations[cronExpr]) {
            throw `duplicate registration: ${cronExpr}`;
        }

        this.registrations[cronExpr] = { key, fn };
    }
}
