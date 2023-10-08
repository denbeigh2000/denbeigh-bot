import { Snowflake } from "discord-api-types/globals";
import { Env } from "../env";

export interface Attribution {
    user: Snowflake,
    message: Snowflake,
}

export interface Environment { [key: string]: string };

export interface BuildParams {
    commit: string,
    branch: string,
    env: Environment,
}

export class BuildkiteClient {
    organisation: string;
    token: string;
    baseURL: string;

    constructor(organisation: string, token: string, baseURL: string = "https://api.buildkite.com/v2/") {
        this.organisation = organisation;
        this.token = token;
        this.baseURL = baseURL;
    }

    async post(endpoint: string, data: any): Promise<Response> {
        const body = JSON.stringify(data);
        const url = new URL(endpoint, this.baseURL);
        const req = new Request(url, {
            method: "POST",
            body,
            headers: {
                "Content-Type": "application/json",
            },
        });

        return await fetch(req);
    }

    public async startBuild(_env: Env, pipeline: string, params: Partial<BuildParams>, attr: Attribution): Promise<Response> {
        const endpoint = `organizations/${this.organisation}/pipelines/${pipeline}/builds`;
        const data = {
            ...params,
            meta_data: {
                "source": "discordbot",
                "discord_requester_id": attr.user,
                "discord_message_id": attr.message,
            },
        };

        return await this.post(endpoint, data);
    }
}
