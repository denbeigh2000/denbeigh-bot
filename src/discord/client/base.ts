
// TODO: Migrate this and BotClient to use @discordjs/rest (need to figure out how to do the

import { ResponseLike, REST } from "@discordjs/rest";
import { Sentry } from "@bot/sentry";

// different authentication types
export class Client {
    clientType = "";
    sentry: Sentry;

    rest: REST;

    constructor(authPrefix: "Bot" | "Bearer", token: string, sentry: Sentry) {
        this.sentry = sentry;
        // TODO: can we also attach some association of the bot/user?
        this.rest = new REST({
            authPrefix,
            makeRequest: async (url, init): Promise<ResponseLike> => {
                const resp = await fetch(url, init as RequestInit);
                this.sentry.breadcrumbFromHTTP("discord", url, resp);

                if (resp.status >= 400 && resp.status < 500) {
                    this.sentry.captureMessage(`${resp.status} from Discord`, "warning");
                }

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
