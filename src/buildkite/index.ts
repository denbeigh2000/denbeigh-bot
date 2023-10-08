import { Environment, BuildParams, BuildkiteClient, Attribution } from "./client";
import { BuildRequest, BuildSource, TrackedBuild, BuildState, Pipeline, Build } from "./common";
import { Tracker as BuildTracker } from "./tracker";
import { verify as verifyRequest } from "./verify";

import { Env } from "../env";
import { respondNotFound } from "../http";
import { Sentry } from "../sentry";

export async function handleBuildkiteWebhook(env: Env, request: Request, sentry: Sentry): Promise<Response> {
    if (!verifyRequest(request, env, sentry)) {
        return respondNotFound();
    }

    const resp = new Response("", {
        status: 201,
    });

    const data = await request.json() as any;
    switch (data.event as string) {
        case "build.scheduled":
            // TODO
            break;
        case "build.running":
            // TODO
            break;
        case "build.finished":
            // TODO
            break;
        case "build.blocked":
            // TODO
            break;
        default:
            // incl ping
            return resp;
    }

    const tracker = new BuildTracker(env.BUILDS);
    const build = buildFromWebhook(data);
    let record = tracker.get(build.id);
    if (!record) {
        // TODO
        // - Post to builds channel
        // - Construct IncomingBuild
        // - Create record in tracker
    } else {
        // TODO
        // - Generate new embed, depending on its' source
        // - Update original message
    }

    // TODO
    // - Merge and upsert data into KV

    // const record = tracker.get(data.

    return resp;
}

function buildFromWebhook(payload: any): Build {
    return {
        id: payload.build.id as string,
        url: payload.build.web_url as string,
        number: payload.build.number as number,
        branch: payload.build.branch as string,
        commitHash: payload.build.commit as string,
        state: payload.build.state as BuildState,
    };
}

function pipelineFromWebhook(payload: any): Pipeline {
    return {
        id: payload.build.pipeline.id as string,
        name: payload.build.pipeline.name as string,
        slug: payload.build.pipeline.slug as string,
    };
}

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
    TrackedBuild as BuildInfo,
    BuildParams,
    BuildTracker,
    BuildkiteClient,
    Environment,
};
