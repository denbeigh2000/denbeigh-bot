import { ResponseLike, REST } from "@discordjs/rest";
import { Sentry } from "../sentry";
import { sha256sum } from "../util";
import { DiscordCache } from "./cache";

export class Client {
    sentry: Sentry;

    cacheKey: string;
    cache: DiscordCache | null;
    rest: REST;

    constructor(authPrefix: "Bot" | "Bearer", token: string, sentry: Sentry) {
        // Ensure we use a token hash in the key name to avoid cache leakage
        this.cacheKey = `discord:${sha256sum(token)}`;
        this.sentry = sentry;
        this.rest = new REST({
            authPrefix,
            userAgentAppendix: "Denbeigh Bot (github.com/denbeigh2000/denbeigh-bot)",
            makeRequest: async (url, init): Promise<ResponseLike> => {
                // NOTE: This must be done on the first request, because
                // we cannot have an async constructor
                if (!this.cache) {
                    const c = await caches.open(this.cacheKey);
                    this.cache = new DiscordCache(c);
                }

                const data = init as RequestInit;
                const req = new Request(url, data);

                // CF Workers refer to MDN documentation for their implementation of fetch,
                // and @discordjs/rest says makeRequest is supposed to support global fetch,
                // even though typescript gives warnings about non-overlapping response
                // types, soooooo I don't really see the harm of just casting here (and below)
                // @ts-ignore
                let resp = await this.cache.match(req) as ResponseLike;
                const cacheHit = Boolean(resp);
                if (!cacheHit) {
                    const rawResp = await fetch(req);
                    const cachedResp = rawResp.clone();
                    this.cache.put(req, cachedResp);
                    // @ts-ignore
                    resp = rawResp as ResponseLike;
                }

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
                        cached: cacheHit,
                    },
                });

                return resp as ResponseLike;
            },
        });

        this.rest.setToken(token);
    }
}
