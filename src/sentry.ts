import { APIUser } from "discord-api-types/payloads/v10";
import { Breadcrumb, Extra, Extras } from "@sentry/types";
import Toucan, { Level } from "toucan-js";

import { Env } from "./env";
import { tag } from "../version.json";

export interface BuildkiteErrorShape {
    message: string,
    errors: any[],
}

export class Sentry {
    private client: Toucan;

    constructor(request: Request, env: Env, context: FetchEvent) {
        this.client = new Toucan({
            allowedHeaders: ["user-agent"],
            context,
            dsn: env.SENTRY_DSN,
            environment: env.ENVIRONMENT,
            request,
            release: tag,
        });
    }

    public setUser(user: APIUser) {
        this.client.setUser({
            id: user.id,
            username: `${user!.username}#${user!.discriminator}`,
        });
    }

    public sendException(exception: Error) {
        this.client.captureException(exception);
    }

    public sendMessage(message: string, level: Level = "info") {
        this.client.captureMessage(message, level);
    }

    public addBreadcrumb(breadcrumb: Breadcrumb) {
        this.client.addBreadcrumb(breadcrumb);
    }

    private logHttp(
        message: string,
        category: string,
        request: Request,
        response: Response
    ) {
        this.client.addBreadcrumb({
            timestamp: Date.now(),
            message,
            category,
            type: "http",
            data: {
                url: request.url,
                method: request.method,
                status_code: response.status,
                reason: response.statusText,
            },
        });
    }

    private logHttpMessage(noun: string, response: Response) {
        const { status } = response;
        const success = status < 300;

        this.client.setExtras({ success, status });

        const extra = success ? "" : " failed";
        const level = success ? "info" : "warning";

        this.client.captureMessage(`${noun}${extra}`, level);
    }

    public logRefresh(request: Request, response: Response) {
        this.logHttp("Refreshing token", "oauth", request, response);
        this.logHttpMessage("Token refresh", response);
    }

    public logGetToken(request: Request, response: Response) {
        this.logHttp("Getting new token", "oauth", request, response);
        this.logHttpMessage("Token creation", response);
    }

    public setExtra(key: string, value: Extra) {
        this.client.setExtra(key, value);
    }

    public setExtras(extras: Extras) {
        this.client.setExtras(extras);
    }
}
