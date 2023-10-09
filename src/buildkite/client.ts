import { Snowflake } from "discord-api-types/globals";
import { Env } from "../env";
import { BuildkiteErrorShape, Sentry } from "../sentry";
import { Build, BuildInfo, BuildState, Pipeline } from "./common";

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
    sentry: Sentry;

    constructor(sentry: Sentry, organisation: string, token: string, baseURL: string = "https://api.buildkite.com/v2/") {
        this.organisation = organisation;
        this.token = token;
        this.baseURL = baseURL;
        this.sentry = sentry;
    }

    async post(endpoint: string, data: any): Promise<Response> {
        const body = JSON.stringify(data);
        const url = new URL(endpoint, this.baseURL);
        const req = new Request(url, {
            method: "POST",
            body,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.token}`,
            },
        });

        const resp = await fetch(req);
        if (resp.status >= 400) {
            const body = await resp.json() as BuildkiteErrorShape;
            this.sentry.logBuildkiteError(req, resp, body);
            throw body.message;
        }
        return resp;
    }

    public pipelineURL(pipelineName: string): string {
        return `https://buildkite.com/${this.organisation}/${pipelineName}`;
    }

    public async createBuild(_env: Env, pipelineName: string, params: Partial<BuildParams>, attr: Attribution): Promise<BuildInfo | null> {
        const endpoint = `organizations/${this.organisation}/pipelines/${pipelineName}/builds`;
        const data = {
            ...params,
            meta_data: {
                "source": "discordbot",
                "discord_requester_id": attr.user,
                "discord_message_id": attr.message,
            },
        };

        const resp = await this.post(endpoint, data);
        const body = await resp.json() as any;

        const build: Build = {
            id: body.id as string,
            url: body.web_url as string,
            state: body.state as BuildState,
            commit: body.commit as string || "HEAD",
            number: body.number as number,
            branch: body.branch as string || "master",
            message: body.message as string || "",
        };

        const pipeline: Pipeline = {
            id: body.pipeline.id as string,
            name: body.pipeline.name as string,
            slug: body.pipeline.slug as string,
        };

        const user = (body.author ? body.author : body.creator) || {};
        const author = {
            name: "name" in user ? user.name : "",
            imageUrl: "avatar_url" in user ? user.avatar_url : undefined,
        };

        return {
            build,
            pipeline,
            author,
        };
    }
}
