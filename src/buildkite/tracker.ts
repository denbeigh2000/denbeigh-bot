import { TrackedBuild } from "./common";

export class Tracker {
    ns: KVNamespace;

    constructor(namespace: KVNamespace) {
        this.ns = namespace
    }

    // Puts a record of a build into the database.
    // The build will be retrievable by its' global Build ID (UUID).
    public async upsert(data: TrackedBuild) {
        await this.ns.put(data.build.id, JSON.stringify(data));
    }

    public async get(id: string): Promise<TrackedBuild | null> {
        const entry = await this.ns.get(id);
        if (entry === null) {
            return null;
        }

        return JSON.parse(entry);
    }
}
