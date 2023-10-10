import humanizeDuration from "humanize-duration";
import { APIEmbed, APIEmbedField } from "discord-api-types/v10";
import { Sentry } from "../sentry";
import { BuildInfo, BuildState } from "./common";

// #F83F23
const RED = 16269091;
// #FDF5F5
const RED_LIGHT = 16643573;
// #FFBA11
const YELLOW = 16759313;
// #FFF8E7
const YELLOW_LIGHT = 16775399;
// #00BE13
const GREEN = 48659;
// #FAFDFA
const GREEN_LIGHT = 16449018;
// #C2CACE
const GREY = 12765902;
// #F9FAFB
const GREY_LIGHT = 16382715;

// const STALL_IMG = "https://em-content.zobj.net/source/animated-noto-colour-emoji/356/dotted-line-face_1fae5.gif";
// const RUNNING_IMG = "https://i.kym-cdn.com/photos/images/original/002/429/796/96c.gif";
// const SUCCESS_IMG = "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_d3100900bce94eb99e7251d741926564/animated/light/3.0";
// const FAILURE_IMG = "https://cdn3.emoji.gg/emojis/4438_Pensive_Bread.png";
const STALL_IMG = "https://pub-0faf9f8a28c14050a1d2a3decae82f38.r2.dev/dotted-line-face.gif";
const RUNNING_IMG = "https://pub-0faf9f8a28c14050a1d2a3decae82f38.r2.dev/duck-in-hat.gif";
const SUCCESS_IMG = "https://pub-0faf9f8a28c14050a1d2a3decae82f38.r2.dev/limesDance.gif";
const FAILURE_IMG = "https://pub-0faf9f8a28c14050a1d2a3decae82f38.r2.dev/pensive-bread.png";

// Not sure if this is just for me, but this default gravatar image is very
// unappealing lol.
const DEFAULT_BK_IMG = "https://www.gravatar.com/avatar/3f0e71403ee9fefd2a1cc0df38e14c81";

export interface State {
    thumbnail: string,
    colour: number,
    colourLight: number,
    emoji: string,
}

export enum BuildColour {
    STALLED = "stalled",
    RUNNING = "running",
    PASSED = "passed",
    FAILED = "failed",
}

export function stateMap(given: BuildState, sentry: Sentry): BuildColour {
    switch (given) {
        case "running":
        case "started":
            return BuildColour.RUNNING;
        case "scheduled":
        case "blocked":
        case "skipped":
        case "not run":
            return BuildColour.STALLED;
        case "passed":
            return BuildColour.PASSED;
        case "failed":
        case "canceled":
        case "canceling":
            return BuildColour.FAILED;
        default:
            sentry.setExtra("givenState", given);
            sentry.sendMessage("unhandled state");
            return BuildColour.STALLED;
    }
}

export type ColourSet = {
    [k in BuildColour]: State
}

export const STATE_COLOURS: ColourSet = {
    [BuildColour.STALLED]: {
        thumbnail: STALL_IMG,
        colour: GREY,
        colourLight: GREY_LIGHT,
        emoji: "😪",
    },
    [BuildColour.RUNNING]: {
        thumbnail: RUNNING_IMG,
        colour: YELLOW,
        colourLight: YELLOW_LIGHT,
        emoji: "⏱️",
    },
    [BuildColour.PASSED]: {
        thumbnail: SUCCESS_IMG,
        colour: GREEN,
        colourLight: GREEN_LIGHT,
        emoji: "✅"
    },
    [BuildColour.FAILED]: {
        thumbnail: FAILURE_IMG,
        colour: RED,
        colourLight: RED_LIGHT,
        emoji: "❌",
    },
};

export function buildEmbed(build: BuildInfo, sentry: Sentry): APIEmbed {
    const stateType = stateMap(build.build.state, sentry);
    const stateData = STATE_COLOURS[stateType];

    const fullCommit = build.build.commit || "HEAD";
    const commit = fullCommit.substring(0, 13);
    const title = `${stateData.emoji} ${build.pipeline.name} (#${build.build.number})`
    const { url } = build.build;
    let { message } = build.build;
    if (message && message.length > 50) {
        message = message.substring(0, 47) + "...";
    }

    const imageUrl = build.author.imageUrl !== DEFAULT_BK_IMG
        ? build.author.imageUrl
        : undefined;

    const msgField = message
        ? [{ name: "Message", value: message }]
        : [];

    let timeFields: APIEmbedField[] = [];
    const { started, finished } = build.build;
    if (finished && started) {
        const end = finished.getTime();
        const start = started.getTime();
        const fin = Math.round(end / 1000);
        const finStr = `<t:${fin}:f> (<t:${fin}:R>)`;
        const duration: string = humanizeDuration(end - start);
        timeFields = [
            { name: "Finished at", value: finStr, },
            { name: "Time taken", value: duration, },
        ];
    } else if (started) {
        const start = Math.round(started.getTime() / 1000);
        const startStr = `<t:${start}:f> (<t:${start}:R>)`;
        timeFields = [
            { name: "Started at", value: startStr }
        ];
    }

    return {
        title,
        url,
        author: {
            name: build.author.name,
            icon_url: imageUrl,
        },
        color: stateData.colour,
        thumbnail: { url: stateData.thumbnail },
        fields: [
            ...msgField,
            { name: "State", value: build.build.state, },
            { name: "Commit", value: `\`${commit}\`` },
            ...timeFields,
        ],
    };
}
