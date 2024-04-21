import { Env } from "@bot/env";
import { Sentry } from "@bot/sentry";

import { InteractionRouter } from ".";
import { handler as pingHandler, command as pingDesc } from "./commands/ping";
import { handler as noworkHandler, command as noworkDesc } from "./commands/nowork";
import { handler as inviteHandler, command as inviteDesc } from "./commands/invite";
import { handler as promoteHandler, command as promoteDesc } from "./commands/promote";
import { handler as groupHandler, command as groupDesc } from "./commands/group";
import { handler as flagHandler, command as flagDesc } from "./commands/flag";

import { handler as authoriseHandler } from "./components/authorise";

export function getRouter(env: Env, sentry: Sentry): InteractionRouter {
    const router = new InteractionRouter(env, sentry);

    router.registerCommand("ping", pingHandler, pingDesc);
    router.registerCommand("group", groupHandler, groupDesc);
    router.registerCommand("flag", flagHandler, flagDesc);
    router.registerCommand("nowork", noworkHandler, noworkDesc);
    router.registerCommand("promote", promoteHandler, promoteDesc);
    router.registerCommand("invite", inviteHandler, inviteDesc);

    router.registerComponent("authorise", authoriseHandler);

    return router;
}
