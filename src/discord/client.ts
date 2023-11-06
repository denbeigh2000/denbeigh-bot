
// TODO: Migrate this and BotClient to use @discordjs/rest (need to figure out how to do the

import { ResponseLike, REST } from "@discordjs/rest";
import { Sentry } from "../sentry";

const _USER_AGENT = "Denbeigh Bot (github.com/denbeigh2000/denbeigh-bot / @denbeigh/@perpetualhangover)";

// different authentication types
export class Client {
    clientType = "";
    sentry: Sentry;

    rest: REST;

    constructor(authPrefix: "Bot" | "Bearer", token: string, sentry: Sentry) {
        this.sentry = sentry;
        this.rest = new REST({
            authPrefix,
            makeRequest: async (url, init): Promise<ResponseLike> => {
                const resp = await fetch(url, init as RequestInit);
                this.sentry.addBreadcrumb({
                    timestamp: Date.now(),
                    message: url,
                    category: "discord",
                    type: "http",
                    data: {
                        url: url,
                        method: init.method,
                        status_code: resp.status,
                        reason: resp.statusText,
                    },
                });

                // CF Workers refer to MDN documentation for their implementation of fetch,
                // and @discordjs/rest says makeRequest is supposed to support global fetch,
                // even though typescript gives warnings about non-overlapping response
                // types, soooooo I don't really see the harm of just casting here
                // @ts-ignore
                return resp as ResponseLike;
            },
        });

        this.rest.setToken(token);
    }
}
