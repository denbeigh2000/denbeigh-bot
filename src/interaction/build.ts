import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { APIChatInputApplicationCommandInteraction, Snowflake } from "discord-api-types/v10";
import { BotClient } from "../discord";
import { Sentry } from "../sentry";
import { BuildkiteClient, BuildTracker } from "../buildkite";
import { Env } from "../env";

// /build pipeline:.dotfiles [branch:main] [commit:HEAD]

interface BuildSchema {
    pipeline: string,
    branch: string | undefined,
    commit: string | undefined,
}

export async function handleBuild(
    bot: BotClient,
    bkClient: BuildkiteClient,
    tracker: BuildTracker,
    interaction: APIChatInputApplicationCommandInteraction,
    env: Env,
    sentry: Sentry,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    let user: Snowflake;
    let message = interaction.id;
    if (interaction.member) {
        user = interaction.member.user.id;
    } else if (interaction.user) {
        user = interaction.user.id;
    } else {
        const msg = "Build command sent without a user";
        sentry.sendMessage(msg, "warning");
        return { content: msg };
    }

    if (user !== env.DENBEIGH_USER) {
        // TODO: Zippy response, curiosity role, etc
        return {
            content: "...",
        };
    }

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in build command";
        sentry.sendMessage(msg, "warning");
        return { content: msg };
    }

    if (options.length > 3) {
        const msg = `Unexpected number of elements ${options.length}`;
        sentry.sendMessage(msg, "warning");
        return { content: msg };
    }

    const optionMap = options.reduce((memo, cur) => {
        memo[cur.name] = cur;
        return memo;
    }, {}) as BuildSchema;

    const { pipeline, branch, commit } = optionMap;
    if (!pipeline) {
        const msg = "Build command missing pipeline";
        sentry.sendMessage(msg, "warning");
        return { content: msg };
    }

    const params = { branch, commit };
    const attr = { user, message };
    const build = await bkClient.startBuild(env, pipeline, params, attr);

    const msg = await bot.createMessage(env.BUILDS_CHANNEL, {
        content: `<@${user}>`,
        // TODO: generate embeds
        embeds: [],
    });

    await tracker.upsert({
        build,
        source: {
            type: "requestedBuild",
            user,
            interaction: interaction.id,
            channel: msg.channel_id,
            message: msg.id,
        },
    });

    return { content: "Successfully started build" };
}
