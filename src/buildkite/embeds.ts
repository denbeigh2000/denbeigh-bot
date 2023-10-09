import { APIEmbed, EmbedType } from "discord-api-types/v10";
import { Sentry } from "../sentry";
import { Build, BuildState, TrackedBuild } from "./common";

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

const STALL_IMG = "https://em-content.zobj.net/source/animated-noto-colour-emoji/356/dotted-line-face_1fae5.gif";
const RUNNING_IMG = "https://i.kym-cdn.com/photos/images/original/002/429/796/96c.gif";
const SUCCESS_IMG = "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_d3100900bce94eb99e7251d741926564/animated/light/3.0";
const FAILURE_IMG = "https://cdn3.emoji.gg/emojis/4438_Pensive_Bread.png";

export interface State {
    thumbnail: string,
    colour: number,
    colourLight: number,
    emoji: string,
}

// export type BuildColour = "stalled" | "running" | "passed" | "failed";

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

export function buildEmbed(build: Build, sentry: Sentry): APIEmbed {
    const stateType = stateMap(build.state, sentry);
    const stateData = STATE_COLOURS[stateType];
    return {
        color: stateData.colour,
        thumbnail: { url: stateData.thumbnail },
        fields: [
            { name: "Pipeline", value: "???" },
            { name: "State", value: `${stateData.emoji} ${build.state}`, },
        ]
    };
}
