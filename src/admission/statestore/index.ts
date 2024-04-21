import { Snowflake } from "discord-api-types/globals"

import { AuxRole, AUX_ROLE_META, ID_TO_AUX_ROLE, ID_TO_ROLE, Role, ROLE_META } from "@bot/roles";
import { Sentry } from "@bot/sentry";
import { deleteState, FetchPendingResult, fetchPendingUser, insertActionMessage, selectState, setAuxRoles, setRole, StateResult } from "./queries";

export interface Results {
    role: Role,
    auxRoles: AuxRole[],
}

function encodeAuxRoles(auxRoles: AuxRole[]): string {
    return auxRoles.map(r => AUX_ROLE_META[r].id).join("\0");
}

function decodeAuxRoles(data: string): AuxRole[] {
    if (!data) {
        return [];
    }

    return data.split("\0").map(r => ID_TO_AUX_ROLE[r]);
}

export class StateStore {
    db: D1Database;
    sentry: Sentry;

    constructor(db: D1Database, sentry: Sentry) {
        this.db = db;
        this.sentry = sentry;
    }

    public async getActionMessage(targetUser: Snowflake): Promise<Snowflake | null> {
        const stmt = this.db.prepare(fetchPendingUser).bind(targetUser);
        const { error, results } = await stmt.all<FetchPendingResult>();

        if (error) {
            this.sentry.captureMessage("failed to execute fetch query", "error", { originalException: error });
            throw error;
        }

        if (!results || !results[0]) {
            return null;
        }

        return results[0].messageID as string;
    }

    public async insertActionMessage(targetUser: Snowflake, messageID: Snowflake) {
        const stmt = this.db.prepare(insertActionMessage).bind(targetUser, messageID);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to insert action message into db", "error", { originalException: error });
            throw error;
        }
    }

    public async setRole(roleEnum: Role, targetUser: Snowflake, interactor: Snowflake) {
        const role = ROLE_META[roleEnum].id;
        const stmt = this.db.prepare(setRole).bind(targetUser, interactor, role);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to set role in db", "error", { originalException: error });
            throw error;
        }
    }

    public async setAuxRoles(auxRoles: AuxRole[], targetUser: Snowflake, interactor: Snowflake) {
        const roles = encodeAuxRoles(auxRoles);
        const stmt = this.db.prepare(setAuxRoles).bind(targetUser, interactor, roles);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to set aux roles in db", "error", { originalException: error });
            throw error;
        }
    }

    public async end(targetUser: Snowflake): Promise<void> {
        const stmt = this.db.prepare(deleteState).bind(targetUser);
        const { error } = await stmt.run();
        if (error) {
            this.sentry.captureMessage("failed to delete state from db", "error", { originalException: error });
            throw error;
        }
    }

    public async validateAndEnd(targetUser: Snowflake, interactor: Snowflake): Promise<Results | null> {
        const validStmt = this.db.prepare(selectState).bind(targetUser, interactor);
        const { error, results: validResults } = await validStmt.all<StateResult>();
        if (error) {
            this.sentry.captureMessage("failed to get state from db while validating", "error", { originalException: error });
            return null;
        }

        if (!validResults || !validResults[0]) {
            this.sentry.captureMessage("trying to close an authorisation entry that doesn't exist", "error");
            return null;
        }
        // NOTE: we can't actually do a "transaction" here, but I hope for my
        // low-volume use cases that changes are unlikely in this section :^)
        if (!validResults[0].roleRaw) {
            // TODO: need to communicate that there were properties missing
            return null;
        }

        const getQuery = this.db.prepare(selectState).bind(targetUser, interactor);
        const deleteQuery = this.db.prepare(deleteState).bind(targetUser);

        const batchResults: D1Result<void | StateResult>[] = await this.db.batch([getQuery, deleteQuery]);
        if (batchResults.length !== 2) {
            this.sentry.captureMessage(`expected 2 results from batch q, got ${batchResults.length}`);
            // TODO: improve?
            throw "bad results from d1";
        }

        // @ts-ignore: this order should be guaranteed from input arguments
        const [getResult, deleteResult]: [D1Result<StateResult>, D1Result<void>] = batchResults;
        if (getResult.error) {
            this.sentry.captureMessage(
                "failed to get state when deleting",
                "error",
                { originalException: getResult.error }
            );
            // TODO: this should also clear state at the higher level?
            // need to throw richer errors
            throw getResult.error;
        }

        if (!getResult.results || !getResult.results[0]) {
            // No matches, maybe there was a race?
            this.sentry.captureMessage("our results were deleted concurrently", "error");
            return null;
        }

        if (deleteResult.error) {
            this.sentry.captureMessage(
                "failed to delete old user state",
                "warning",
                { originalException: deleteResult.error }
            );
        }

        const { roleRaw, auxRolesRaw } = getResult.results[0];
        const role = ID_TO_ROLE[roleRaw!];
        const auxRoles = decodeAuxRoles(auxRolesRaw || "");

        return { role, auxRoles };
    };
}
