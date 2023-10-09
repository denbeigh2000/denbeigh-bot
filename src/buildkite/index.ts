import { Environment, BuildParams, BuildkiteClient, Attribution } from "./client";
import { BuildRequest, BuildSource, TrackedBuild, BuildState, Pipeline, Build, IncomingBuild, BuildInfo } from "./common";
import { Tracker as BuildTracker } from "./tracker";

import { Sentry } from "../sentry";

function discordUserFromWebhook(payload: any, sentry: Sentry): Attribution | null {
    const meta = payload.build.meta_data as any;
    const { discord_requester_id: user, discord_message_id: message } = meta;
    if (user && message) {
        return { user, message };
    } else if (!user && !message) {
        return null;
    } else {
        // Only partial info here, ideally this shouldn't occur
        sentry.setExtra("user", user);
        sentry.setExtra("message", message);
        sentry.sendMessage("inconsistent user/message in build event", "warning");
        return null;
    }
}

export {
    BuildSource as Associations,
    BuildRequest,
    BuildInfo,
    BuildParams,
    BuildTracker,
    BuildkiteClient,
    Environment,
    TrackedBuild,
};
