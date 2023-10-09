import { APIEmbed, EmbedType } from "discord-api-types/v10";
import { Build, BuildState, TrackedBuild } from "./common";

const RED = "#F83F23";
const RED_LIGHT = "#FDF5F5";
const YELLOW = "#FFBA11";
const YELLOW_LIGHT = "#FFF8E7";
const GREEN = "#00BE13";
const GREEN_LIGHT = "#FAFDFA";
const GREY = "#C2CACE";
const GREY_LIGHT = "#F9FAFB";

const STALL_IMG = "https://em-content.zobj.net/source/animated-noto-colour-emoji/356/dotted-line-face_1fae5.gif";
const RUNNING_IMG = "https://i.kym-cdn.com/photos/images/original/002/429/796/96c.gif";
const SUCCESS_IMG = "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_d3100900bce94eb99e7251d741926564/animated/light/3.0";
const FAILURE_IMG = "https://cdn3.emoji.gg/emojis/4438_Pensive_Bread.png";

export interface State {
    thumbnail: string,
    colour: string,
    lightColor: string,
    emoji: string,
}

export function stateMap(given: BuildState): string {
    switch (given) {
        case "running":
        case "started":
            return "running";
        case "scheduled":
        case "blocked":
        case "skipped":
        case "not run":
            return "stall";
        case "passed":
            return "passwd";
        case "failed":
        case "canceled":
        case "canceling":
            return "failed";
    }
}

export const STATE_COLOURS = {
    stall: {
        thumbnail: "https://em-content.zobj.net/source/animated-noto-colour-emoji/356/dotted-line-face_1fae5.gif",
        colour: "#C2CACE",
        colourLight: "#F9FAFB",
        emoji: "😪",
    },
    running: {
        thumbnail: "https://i.kym-cdn.com/photos/images/original/002/429/796/96c.gif",
        colour: "#FFBA11",
        colourLight: "#FFF8E7",
        emoji: "⏱️",
    },
    passed: {
        thumbnail: "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_d3100900bce94eb99e7251d741926564/animated/light/3.0",
        colour: "#00BE13",
        colourLight: "#FAFDFA",
        emoji: "✅"
    },
    failed: {
        thumbnail: "https://cdn3.emoji.gg/emojis/4438_Pensive_Bread.png",
        colour: "",
        colourLight: "",
        emoji: "❌",
    },
};

export function buildEmbed(build: Build): APIEmbed {
    const stateType = stateMap(build.state);
    const stateData = STATE_COLOURS[stateType];
    return {
        color: stateData.colour,
        fields: [
            { name: "Pipeline", value: "???" },
            { name: "State", value: `${stateData.emoji} ${build.state}`, },
        ]
    };
}
