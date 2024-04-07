import { Snowflake } from "discord-api-types/globals"
import { D1QB, D1Result, D1ResultOne, JoinTypes, Query } from "workers-qb"

import { AuxRole, AUX_ROLE_META, ID_TO_AUX_ROLE, ID_TO_ROLE, Role, ROLE_META } from "../roles";
import { Sentry } from "../sentry";

const PENDING_TABLE = "users_pending_entry";
const INT_STATE_TABLE = "pending_user_interaction_state";

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
    db: D1QB
    sentry: Sentry

    constructor(db: D1Database, sentry: Sentry) {
        this.db = new D1QB(db);
        this.sentry = sentry;
    }

    public async getActionMessage(targetUser: Snowflake): Promise<Snowflake | null> {
        let rawResult: D1ResultOne;
        try {
            rawResult = await this.db.fetchOne({
                tableName: PENDING_TABLE,
                fields: ["message_id as messageID"],
                where: {
                    conditions: "target_user_id = ?1",
                    params: [targetUser],
                }
            }).execute();
        } catch (e) {
            this.sentry.captureException(e);
            throw e;
        }
        const { results }: D1ResultOne = rawResult;

        if (!results) {
            return null;
        }

        return results.messageID as string;
    }

    public async insertActionMessage(targetUser: Snowflake, messageID: Snowflake) {
        let result: D1Result;
        try {
            result = await this.db.insert({
                tableName: PENDING_TABLE,
                data: {
                    target_user_id: targetUser,
                    message_id: messageID,
                },
            }).execute();

        } catch (e) {
            console.error(`Failed to insert data (user: ${targetUser}, msg: ${messageID})`)
            this.sentry.captureException(e);
            throw e;
        }
    }

    public async setRole(roleEnum: Role, targetUser: Snowflake, interactor: Snowflake) {
        const role = ROLE_META[roleEnum].id;

        try {
            await this.db.insert({
                tableName: INT_STATE_TABLE,
                data: {
                    target_user_id: targetUser,
                    interactor_id: interactor,
                    primary_role: role,
                },
                onConflict: {
                    column: ["target_user_id", "interactor_id"],
                    data: { primary_role: role },
                },
            }).execute();
        } catch (e) {
            this.sentry.captureException(e);
            throw e;
        }
    }

    public async setAuxRoles(auxRoles: AuxRole[], targetUser: Snowflake, interactor: Snowflake) {
        const roles = encodeAuxRoles(auxRoles);

        try {
            await this.db.insert({
                tableName: INT_STATE_TABLE,
                data: {
                    target_user_id: targetUser,
                    interactor_id: interactor,
                    aux_roles: roles,
                },
                onConflict: {
                    column: ["target_user_id", "interactor_id"],
                    data: { aux_roles: roles },
                },
            }).execute();
        } catch (e) {
            this.sentry.captureException(e);
            throw e;
        }
    }

    private selectStateQuery(targetUser: Snowflake, interactor: Snowflake): Query {
        return this.db.fetchOne({
            tableName: PENDING_TABLE,
            fields: [`${INT_STATE_TABLE}.primary_role as roleRaw`, `${INT_STATE_TABLE}.aux_roles as auxRolesRaw`],
            join: {
                type: JoinTypes.LEFT,
                table: INT_STATE_TABLE,
                on: `${INT_STATE_TABLE}.target_user_id = ${PENDING_TABLE}.target_user_id`,
            },
            where: {
                conditions: `${INT_STATE_TABLE}.target_user_id = ?1 AND interactor_id = ?2`,
                params: [targetUser, interactor],
            },
        });
    }

    private deleteStateQuery(targetUser: Snowflake): Query {
        return this.db.delete({
            tableName: PENDING_TABLE,
            where: {
                conditions: "target_user_id = ?1",
                params: [targetUser],
            },
        });
    }

    public async end(targetUser: Snowflake): Promise<void> {
        await this.deleteStateQuery(targetUser).execute();
    }

    public async validateAndEnd(targetUser: Snowflake, interactor: Snowflake): Promise<Results | null> {
        let state: D1ResultOne;
        try {
            state = await this.selectStateQuery(targetUser, interactor).execute();
        } catch (e) {
            this.sentry.captureException(e);
            return null;
        }

        const { results } = state;
        if (!results) {
            // No matches, maybe there was a concurrent request that also ended
            // this?
            this.sentry.captureMessage("trying to close an authorisation entry that doesn't exist", "error");
            return null;
        }

        // NOTE: we can't actually do a "transaction" here, but I hope for my
        // low-volume use cases that changes are unlikely in this section :^)
        if (!results.roleRaw) {
            // TODO: need to communicate that there were properties missing
            return null;
        }

        const getQuery = this.selectStateQuery(targetUser, interactor);
        const deleteQuery = this.deleteStateQuery(targetUser);

        let batchResults: [D1ResultOne, D1Result];
        try {
            batchResults = await this.db.batchExecute([getQuery, deleteQuery]) as [D1ResultOne, D1Result];
        } catch (e) {
            this.sentry.captureException(e);
            return null;
        }
        const [getResult, _] = batchResults;

        if (!getResult.results) {
            // No matches, maybe there was a race?
            this.sentry.captureMessage("our results were deleted concurrently", "error");
            return null;
        }

        const { roleRaw, auxRolesRaw } = getResult.results;

        const role = ID_TO_ROLE[roleRaw as string];
        const auxRoles = decodeAuxRoles(auxRolesRaw as string);

        return { role, auxRoles };
    };
}
