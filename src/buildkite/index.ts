import { Environment, BuildParams, BuildkiteClient, Attribution } from "./client";
import { BuildRequest, BuildSource, TrackedBuild, BuildState, Pipeline, Build, IncomingBuild } from "./common";
import { Tracker as BuildTracker } from "./tracker";
import { verify as verifyRequest } from "./verify";

import { BotClient } from "../discord";
import { Env } from "../env";
import { respondNotFound } from "../http";
import { Sentry } from "../sentry";
import { Snowflake } from "discord-api-types/globals";

interface MessageParams {
    channel: Snowflake,
    message: Snowflake,
}

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
        case "build.running":
        case "build.finished":
        case "build.blocked":
            // TODO: Anything else here? This field isn't used for any state
            // gathering anyway.
            break;
        default:
            // incl ping
            return resp;
    }

    const bot = new BotClient(env.BOT_TOKEN, sentry);
    const tracker = new BuildTracker(env.BUILDS);
    const build = buildFromWebhook(data);
    let record = await tracker.get(build.id);
    sentry.setExtra("buildID", build.id);
    if (record) {
        // This is a build we've seen before
        record = { ...record, build };
        const shouldUpdate = await updateExistingMessage(bot, env.CLIENT_ID, record, sentry);
        if (shouldUpdate) {
            await tracker.upsert(record);
        }
    } else {
        // This is a build we haven't seen before
        const source = await createExternalBuildMessage(env, bot, build, sentry);
        await tracker.upsert({ build, source });
    }

    return resp;
}

async function updateExistingMessage(bot: BotClient, clientId: Snowflake, record: TrackedBuild, sentry: Sentry): Promise<boolean> {
    switch (record.source.type) {
        case "requestedBuild":
        case "build":
            const { channel, message } = record.source;
            // TODO generate embeds
            // const.resp = await bot.editMessage(source.channel, source.message, { embeds: [] });
            const resp = await bot.editMessage(channel, message, { embeds: [] });
            if (!resp) {
                sentry.sendException(new Error("Failed to update buildkite -> discord message"));
            }
            break;
        default:
            // @ts-ignore dealing with real-world input, sometimes the
            // type system doesn't reflect reality anymore
            sentry.setExtra("key", record.source.type)
            sentry.sendMessage("unknown key, aborting", "warning");
            return false;
    }

    return true;
}

// TODO: Move to new top-level builds module
async function createExternalBuildMessage(env: Env, bot: BotClient, build: Build, sentry: Sentry): Promise<IncomingBuild> {
    // TODO generate embeds
    const message = await bot.createMessage(env.BUILDS_CHANNEL, { embeds: [], });

    if (!message) {
        sentry.sendException(new Error("Failed to create buildkite -> discord message"));
    }

    return {
        type: "build",
        message: message.id,
        channel: message.channel_id,
        buildID: build.id,
    };
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
