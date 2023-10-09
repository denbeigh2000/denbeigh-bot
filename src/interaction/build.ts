import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";
import { APIApplicationCommandInteractionDataStringOption, APIChatInputApplicationCommandInteraction, MessageFlags, Snowflake } from "discord-api-types/v10";
import { BotClient } from "../discord";
import { Sentry } from "../sentry";
import { BuildkiteClient, BuildTracker } from "../buildkite";
import { Env } from "../env";
import { buildEmbed } from "../buildkite/embeds";

// /build pipeline:.dotfiles [branch:main] [commit:HEAD]

interface BuildSchema {
    pipeline: string,
    branch: string | undefined,
    commit: string | undefined,
}

interface UnpackedBuild {
    pipeline: APIApplicationCommandInteractionDataStringOption,
    branch: APIApplicationCommandInteractionDataStringOption | undefined,
    commit: APIApplicationCommandInteractionDataStringOption | undefined,
}

export async function handleBuild(
    bot: BotClient,
    bkClient: BuildkiteClient,
    tracker: BuildTracker,
    interaction: APIChatInputApplicationCommandInteraction,
    env: Env,
    sentry: Sentry,
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const ephFlags = { flags: MessageFlags.Ephemeral };
    let user: Snowflake;
    let message = interaction.id;
    if (interaction.member) {
        user = interaction.member.user.id;
    } else if (interaction.user) {
        user = interaction.user.id;
    } else {
        const msg = "Build command sent without a user";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    if (user !== env.DENBEIGH_USER) {
        sentry.setExtra("userID", user);
        sentry.sendMessage("Unauthorised user running builds", "warning");
        await bot.addRole(env.GUILD_ID, user, env.BUILD_CURIOSITY_ROLE);
        return {
            content: "👀",
            ...ephFlags,
        };
    }

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in build command";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    if (options.length > 3) {
        const msg = `Unexpected number of elements ${options.length}`;
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    const optionMap = options.reduce((memo, cur) => {
        memo[cur.name] = cur;
        return memo;
    }, {}) as UnpackedBuild;

    if (!optionMap.pipeline) {
        const msg = "Build command missing pipeline";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    const pipeline = optionMap.pipeline.value;
    const getOrElse = (k: string, alt: string) => k in optionMap ? optionMap[k] : alt;
    const params: BuildSchema = {
        pipeline,
        branch: getOrElse("branch", "master"),
        commit: getOrElse("commit", "HEAD"),
    };
    sentry.setExtra("buildParams", params);
    const attr = { user, message };
    const build = await bkClient.createBuild(env, pipeline, params, attr);
    if (!build) {
        const msg = "Failed to create build";
        sentry.sendMessage(msg, "warning");
        return { content: msg, ...ephFlags };
    }

    const embed = buildEmbed(build, sentry);
    const msg = await bot.createMessage(env.BUILDS_CHANNEL, {
        content: `<@${user}>`,
        embeds: [embed],
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

    return { content: "Successfully started build", ...ephFlags };
}
