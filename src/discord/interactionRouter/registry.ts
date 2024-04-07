import { Env } from "../../env";
import { Sentry } from "../../sentry";

import { InteractionRouter } from ".";
import { handler as pingHandler, command as pingDesc, helpText as pingHelpText } from "./commands/ping";
import { handler as noworkHandler, command as noworkDesc, helpText as noworkHelpText } from "./commands/nowork";
import { handler as inviteHandler, command as inviteDesc, helpText as inviteHelpText } from "./commands/invite";
import { handler as promoteHandler, command as promoteDesc, helpText as promoteHelpText } from "./commands/promote";
import { handler as groupHandler, command as groupDesc, helpText as groupHelpText } from "./commands/group";

import { handler as authoriseHandler } from "./components/authorise";

export function getRouter(env: Env, sentry: Sentry): InteractionRouter {
    const router = new InteractionRouter(env, sentry);

    router.registerCommand("ping", pingHandler, pingDesc, pingHelpText);
    router.registerCommand("nowork", noworkHandler, noworkDesc, noworkHelpText);
    router.registerCommand("promote", promoteHandler, promoteDesc, promoteHelpText);
    router.registerCommand("group", groupHandler, groupDesc, groupHelpText);
    router.registerCommand("invite", inviteHandler, inviteDesc, inviteHelpText);

    router.registerComponent("authorise", authoriseHandler);

    return router;
}
