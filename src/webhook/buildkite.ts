import { Build, BuildState, IncomingBuild, TrackedBuild } from "../buildkite/common";
import { BotClient } from "../discord";
import { Sentry } from "../sentry";
import { respondNotFound } from "../http";
import { verify } from "../buildkite/verify";
import { Env } from "../env";
import { BuildTracker } from "../buildkite";
import { buildEmbed } from "../buildkite/embeds";

export async function handleBuildkiteWebhook(request: Request, env: Env, _ctx: FetchEvent, sentry: Sentry): Promise<Response> {
    if (!verify(request, env.BUILDKITE_HMAC_KEY, sentry)) {
        console.log("failed to verify buildkite's hmac key");
        console.log("BK's key is", env.BUILDKITE_HMAC_KEY.length, "characters long");
        return respondNotFound();
    }

    const resp = new Response("", {
        status: 201,
    });

    const data = await request.json();
    switch ((data as any).event as string) {
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
    sentry.setExtra("buildState", build.state);
    if (record) {
        // This is a build we've seen before
        record = { ...record, build };
        const shouldUpdate = await updateExistingMessage(bot, record, sentry);
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

async function updateExistingMessage(bot: BotClient, record: TrackedBuild, sentry: Sentry): Promise<boolean> {
    switch (record.source.type) {
        case "requestedBuild":
        case "build":
            const { channel, message } = record.source;
            const embed = buildEmbed(record.build, sentry);
            const resp = await bot.editMessage(channel, message, { embeds: [embed] });
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

async function createExternalBuildMessage(env: Env, bot: BotClient, build: Build, sentry: Sentry): Promise<IncomingBuild> {
    const embed = buildEmbed(build, sentry);
    const message = await bot.createMessage(env.BUILDS_CHANNEL, { embeds: [embed], });

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

