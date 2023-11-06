export const DEFAULT_MIN_TTL_SEC = 60 * 2;

export class DiscordCache {
    minTtlSec: number;
    cache: Cache;
    // NOTE: Would like to extend, but we can't get direct access to these
    // constructors.
    constructor(inner: Cache, minTtlSec: number = DEFAULT_MIN_TTL_SEC) {
        this.cache = inner;
        this.minTtlSec = minTtlSec;
    }

    public async match(req: Request): Promise<Response | undefined> {
        return await this.cache.match(req);
    }

    public async put(req: Request, resp: Response) {
        const maxAge = resp.headers.get("Max-Age");
        const belowMin = !maxAge || parseInt(maxAge, 10) < this.minTtlSec;
        if (belowMin) {
            resp.headers.set("Max-Age", this.minTtlSec.toString());
        }

        await this.cache.put(req, resp);
    }
}
