import { uuid } from "@cfworker/uuid";

// 3 minutes
const DEFAULT_TTL_SEC = 3 * 60;

// 30 minutes
const MAX_TTL_SEC = 30 * 60;

// Simple storage for temporary, single-use keys for validating login redirects
export class StateStore {
    kv: KVNamespace

    constructor(storage: KVNamespace) {
        this.kv = storage;
    }

    private storeKey(state: string): string {
        return `state:${state}`;
    }

    private newState(): string {
        return uuid().toString();
    }

    // Provides a new state value, valid for ttlSec seconds, to be used
    // with an oauth login flow
    public async createState(ttlSec: number = DEFAULT_TTL_SEC): Promise<string> {
        if (ttlSec > MAX_TTL_SEC) {
            throw new Error(`TTLError: given TTL of ${ttlSec} is greater than max of ${MAX_TTL_SEC}`);
        }

        const state = this.newState();

        // The value stored here doesn't matter, because we're just recording if this was
        // really make here
        await this.kv.put(this.storeKey(state), "OK", {
            expirationTtl: ttlSec,
        });

        return state;
    }

    // Returns true if the given state is a value that is valid (hasn't been
    // used, and has not outlived its' TTL)
    public async checkRedirect(state: string): Promise<boolean> {
        const key = this.storeKey(state);
        const val = await this.kv.get(key);
        if (!val) {
            return false;
        }

        await this.kv.delete(key);
        return true;
    }
}
