import { Snowflake } from "discord-api-types/globals";
import { Sentry } from "../sentry";

export interface FlagRole {
    roleID: Snowflake,
    countryCode: string,
}

interface GetQueryResponse {
    roleID: string
}

const getQuery = `
SELECT role_id AS roleID
FROM flag_roles
WHERE country_code = ?1
    AND tombstoned = 0
LIMIT 1;
`;

export class FlagRoleStore {
    db: D1Database;
    sentry: Sentry;

    constructor(db: D1Database, sentry: Sentry) {
        this.db = db;
        this.sentry = sentry;
    }

    public async getOrCreate(countryCode: string): Promise<FlagRole> {
        const getStmt = this.db.prepare(getQuery).bind(countryCode.toLowerCase());
        const { error: getErr, results: getRes } = await getStmt.all<GetQueryResponse>();
        if (getErr) {
            this.sentry.captureMessage("failed to get role from db", "error", { originalException: getErr });
            throw getErr;
        }

        if (getRes && getRes[0]) {
            return { countryCode, ...getRes[0] };
        }
    }
}
