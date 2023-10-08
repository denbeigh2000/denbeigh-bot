import { BuildInfo } from "./common";
export class Tracker {
    ns: KVNamespace;

    constructor(namespace: KVNamespace) {
        this.ns = namespace
    }

    // Puts a record of a build into the database.
    // The build will be retrievable by its' global Build ID (UUID).
    public async add(data: BuildInfo) {
        await this.ns.put(data.buildID, JSON.stringify(data));
    }

    public async get(id: string): Promise<BuildInfo | null> {
        const entry = await this.ns.get(id);
        if (entry === null) {
            return null;
        }

        return JSON.parse(entry);
    }
}
