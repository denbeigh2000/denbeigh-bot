import { Snowflake } from "discord-api-types/v10"

export interface Attribution {
    user: Snowflake,
    message: Snowflake,
    interaction: Snowflake,
}

export interface Associations {
    // Soon(tm)
    // mergeRequest: ...
}

export interface BuildInfo {
    buildID: string,
    buildURL: string,
    buildNumber: number,
    branch: string,
    commitHash: string,
    pipeline: {
        id: string,
        name: string,
    },

    // Discord user the build was requested by (if the build was originally
    // triggered from Discord)
    attribution: Attribution | null,
    // Ongoing requests this build is associated with
    associations: Partial<Associations>,
}
