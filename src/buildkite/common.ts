import { Snowflake } from "discord-api-types/v10"

export interface BuildRequest {
    type: "requestedBuild";
    user: Snowflake,
    // Interaction ID of slash command that triggered build
    interaction: Snowflake,

    channel: Snowflake,
    message: Snowflake,

    // NOTE: may need to add more here (e.g., interaction response ID, any
    // state we create)
}

export interface IncomingBuild {
    type: "build"
    buildID: string,
    channel: Snowflake,
    message: Snowflake,
}

export type BuildSource = IncomingBuild | BuildRequest;

export type BuildState = "running" | "scheduled" | "blocked" | "canceled" | "failed" | "passed" | "skipped" | "canceling" | "not run" | "started";

export interface Build {
    id: string,
    url: string,
    number: number,
    branch: string,
    commitHash: string,
    state: BuildState,
}

export interface Pipeline {
    id: string,
    name: string,
    slug: string,
}

export interface TrackedBuild {
    build: Build,

    // Source of this request (and associated metadata for updates etc)
    source: BuildSource;
}
