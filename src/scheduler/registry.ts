import { Scheduler } from ".";
import { Sentry } from "../sentry";

export default function buildScheduler(sentry: Sentry): Scheduler {
    const sched = new Scheduler(sentry);
    // sched.register("* * * * *", "test-task", () => console.log("hello world"));
    return sched;
}
