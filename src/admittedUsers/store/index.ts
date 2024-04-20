import { Snowflake } from "discord-api-types/globals";
import { AuxRole, AUX_ROLE_META, ID_TO_AUX_ROLE, ID_TO_ROLE, Role, ROLE_META } from "../../roles";
import { Sentry } from "../../sentry";
import { addAuxRoleQuery, getAuxRolesQuery, getQuery, removeAuxRoleQuery, removeQuery, upsertQuery } from "./queries";

export interface UserItem {
    userID: string,
    role: Role,
    addedAt: Date,
    roleUpdatedAt: Date,
}

export interface AuxRoleItem {
    role: AuxRole,
    addedAt: Date,
}

type StoredRole = "guest" | "member" | "mod";

interface UserRow {
    status: StoredRole,
    addedAt: number,
    roleUpdatedAt: number,
}

export class AdmittedUserStore {
    userCache: { [userID: Snowflake]: UserItem }
    db: D1Database;
    sentry: Sentry;

    constructor(db: D1Database, sentry: Sentry) {
        this.userCache = {};
        this.db = db;
        this.sentry = sentry;
    }

    private now(date: Date = new Date()): number {
        return (new Number(date) as number);
    }

    async upsertUser(userID: Snowflake, role: Role) {
        const roleStr = ROLE_META[role].id;
        const now = this.now();
        const stmt = this.db.prepare(upsertQuery).bind(userID, roleStr, now, now);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage(
                "failed to insert user",
                "warning",
                { originalException: error }
            );

            // TODO?
            throw error;
        }

        // NOTE: Not inserting the record into cache here, because added_at
        // could potentially be wrong.
    }

    async getUser(userID: Snowflake): Promise<UserItem | null> {
        if (this.userCache[userID]) {
            return this.userCache[userID];
        }

        const user = await this.getUserInner(userID);
        if (user) {
            this.userCache[userID] = user;
        }

        return user;
    }

    private async getUserInner(userID: Snowflake): Promise<UserItem | null> {
        const stmt = this.db.prepare(getQuery).bind(userID);
        const { results, error } = await stmt.all<UserRow>();
        if (error) {
            this.sentry.captureMessage(
                "failed to fetch users",
                "warning",
                { originalException: error }
            );

            // TODO?
            throw error;
        }

        if (!results || !results[0]) {
            return null;
        }

        const { status, addedAt, roleUpdatedAt } = results[0];
        return {
            userID,
            role: ID_TO_ROLE[status],
            addedAt: new Date(addedAt),
            roleUpdatedAt: new Date(roleUpdatedAt),
        };
    }

    async deleteUser(userID: Snowflake) {
        const stmt = this.db.prepare(removeQuery).bind(userID);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to remove user", "error", { originalException: error });
            throw error;
        }

        if (this.userCache[userID]) {
            delete this.userCache[userID];
        }
    }

    async addAuxRole(userID: Snowflake, auxRole: AuxRole) {
        const stmt = this.db.prepare(addAuxRoleQuery).bind(
            userID,
            AUX_ROLE_META[auxRole].id,
            this.now(),
        );
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to insert aux role", "error", { originalException: error });
            throw error;
        }
    }

    async removeAuxRole(userID: Snowflake, auxRole: AuxRole) {
        const stmt = this.db.prepare(removeAuxRoleQuery).bind(
            userID,
            auxRole,
        );
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to remove aux role", "error", { originalException: error });
            throw error;
        }
    }

    async getAuxRoles(userID: Snowflake): Promise<AuxRoleItem[]> {
        const stmt = this.db.prepare(getAuxRolesQuery).bind(userID);
        const { results, error } = await stmt.all<AuxRoleItem>();
        if (error) {
            this.sentry.captureMessage("failed to fetch aux roles", "error", { originalException: error });
            throw error;
        }

        if (!results || !results[0]) {
            return [];
        }

        return results;
    }
}
