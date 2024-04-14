import { Snowflake } from "discord-api-types/globals";
import { Sentry } from "../sentry";

export interface FlagRole {
    roleID: Snowflake,
    countryCode: string,
}

interface GetQueryResponse {
    roleID: string
}

const listRolesQuery = `
SELECT
    role_id AS roleID
FROM
    flag_roles
WHERE
    tombstoned = 0;
`;

const getQuery = `
SELECT
    role_id AS roleID
FROM
    flag_roles
WHERE
    country_code = ?1
        AND tombstoned = 0
LIMIT 1;
`;

const createQuery = `
INSERT INTO
    flag_roles (country_code, role_id)
    VALUES (?1, ?2)
ON CONFLICT
    (country_code, tombstoned)
    DO NOTHING
RETURNING
    role_id AS roleID;
`;

const setUserQuery = `
INSERT INTO user_flags (user_id, country_code)
    VALUES (?1, ?2)
ON CONFLICT (user_id)
    DO UPDATE SET
        country_code = excluded.country_code;
`;

const removeUserQuery = `
DELETE FROM
    user_flags
WHERE
    user_id = ?1;
`;

const markTombstoned = `
UPDATE flag_roles
    SET tombstoned = ?1
    WHERE country_code IN (
        SELECT
            flag_roles.country_code
        FROM
            flag_roles
            LEFT JOIN user_flags
                ON (flag_roles.country_code = user_flags.country_code)
        WHERE
            user_flags.user_id IS NULL
    )
RETURNING
    flag_roles.role_id AS roleID;
`;

const sweepTombstoned = `
DELETE FROM flag_roles
    WHERE tombstoned = ?1;
`;

export class FlagRoleStore {
    db: D1Database;
    sentry: Sentry;

    constructor(db: D1Database, sentry: Sentry) {
        this.db = db;
        this.sentry = sentry;
    }

    public async get(countryCode: string): Promise<FlagRole | null> {
        const stmt = this.db.prepare(getQuery).bind(countryCode.toUpperCase());
        const { error, results } = await stmt.all<GetQueryResponse>();
        if (error) {
            this.sentry.captureMessage("failed to get role from db", "error", { originalException: error });
            throw error;
        }

        if (results && results[0]) {
            return { countryCode, ...results[0] };
        }

        return null;
    }

    public async listRoles(): Promise<Set<Snowflake>> {
        const stmt = this.db.prepare(listRolesQuery);
        const { error, results } = await stmt.all<GetQueryResponse>();
        if (error) {
            this.sentry.captureMessage("failed to list roles from db", "error", { originalException: error });
            throw error;
        }

        const data = new Set<string>();
        if (!results) {
            return data;
        }

        for (let row of results) {
            data.add(row.roleID);
        }

        return data;
    }

    public async create({ roleID, countryCode }: FlagRole): Promise<FlagRole> {
        const stmt = this.db.prepare(createQuery).bind(countryCode, roleID);
        const { error, results } = await stmt.all<GetQueryResponse>();
        if (error) {
            this.sentry.captureMessage("failed to insert role into db", "error", { originalException: error });
            throw error;
        }

        if (!results || !results[0]) {
            this.sentry.captureMessage("somehow empty role insertion result", "error");
            throw "success, but no result after inserting??";
        }

        return { countryCode, ...results[0] };
    }

    public async markTombstoned(key: number): Promise<Snowflake[]> {
        const stmt = this.db.prepare(markTombstoned).bind(key);
        const { error, results } = await stmt.all<GetQueryResponse>();
        if (error) {
            this.sentry.captureMessage("failed to mark tombstoned roles in db", "error", { originalException: error });
            throw error;
        }

        if (!results) {
            return [];
        }

        return results
            .filter(i => i.roleID != null)
            .map(i => i.roleID);
    }

    public async sweepTombstoned(key: number) {
        const stmt = this.db.prepare(sweepTombstoned).bind(key);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to sweep tombstoned roles in db", "error", { originalException: error });
            throw error;
        }
    }

    public async linkUser(userID: Snowflake, countryCode: string) {
        const stmt = this.db.prepare(setUserQuery).bind(userID, countryCode);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to set user link in db", "error", { originalException: error });
            throw error;
        }
    }

    public async unlinkUser(userID: Snowflake) {
        const stmt = this.db.prepare(removeUserQuery).bind(userID);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to unset user link in db", "error", { originalException: error });
            throw error;
        }
    }
}
