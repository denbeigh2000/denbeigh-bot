import { Snowflake } from "discord-api-types/globals"
import { D1QB, D1Result, D1ResultOne, Query } from "workers-qb"

import { AuxRole, AUX_ROLE_META, ID_TO_AUX_ROLE, ID_TO_ROLE, Role, ROLE_META } from "../../../roles";
import { Sentry } from "../../../sentry";

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
        const { results, success }: D1ResultOne = await this.db.fetchOne({
            tableName: PENDING_TABLE,
            fields: ["message_id as messageID"],
            where: {
                conditions: "target_user_id = ?1",
                params: [targetUser],
            }
        }).execute();

        if (!success || !results) {
            // TODO: sentry, proper messaging
            return null;
        }

        return results.messageID as string;
    }

    public async insertActionMessage(targetUser: Snowflake, messageID: Snowflake) {
        const { success }: D1Result = await this.db.insert({
            tableName: PENDING_TABLE,
            data: {
                target_user_id: targetUser,
                message_id: messageID,
            },
        }).execute();

        if (!success) {
            // TODO, handling, sentry etc
            console.error(`Failed to insert data (user: ${targetUser}, msg: ${messageID})`)
            return
        }
    }

    public async setRole(roleEnum: Role, targetUser: Snowflake, interactor: Snowflake) {
        const role = ROLE_META[roleEnum].id;

        // TODO: check success?
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
    }

    public async setAuxRoles(auxRoles: AuxRole[], targetUser: Snowflake, interactor: Snowflake) {
        const roles = encodeAuxRoles(auxRoles);

        // TODO: check success?
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
    }

    private selectStateQuery(targetUser: Snowflake, interactor: Snowflake): Query {
        return this.db.fetchOne({
            tableName: INT_STATE_TABLE,
            fields: ["primary_role as roleRaw", "aux_roles as auxRolesRaw"],
            where: {
                conditions: 'target_user_id = ?1 AND interactor_id = ?2',
                params: [targetUser, interactor],
            },
        });
    }

    public async validateAndEnd(targetUser: Snowflake, interactor: Snowflake): Promise<Results | null> {
        const { results, success }: D1ResultOne = await this.selectStateQuery(targetUser, interactor).execute();
        if (!results) {
            // TODO: sentry
            // No matches, maybe there was a race?
            return null;
        }

        if (!success) {
            // TODO: sentry
            // More info somehow?
            return null;
        }

        // NOTE: we can't actually do a "transaction" here, but I hope for my
        // low-volume use cases that changes are unlikely in this section :^)
        if (!results.roleRaw || !results.auxRolesRaw) {
            // TODO: need to communicate that there were properties missing
            return null;
        }

        const getQuery = this.selectStateQuery(targetUser, interactor);
        const deleteQuery = this.db.delete({
            tableName: PENDING_TABLE,
            where: {
                conditions: "target_user_id = ?1",
                params: [targetUser],
            },
        });

        const [getResult, deleteResult] = await this.db.batchExecute([getQuery, deleteQuery]) as [D1ResultOne, D1Result];
        if (!getResult.success) {
            // TODO: sentry
            return null;
        }

        if (!getResult.results) {

            // TODO: sentry
            // No matches, maybe there was a race?
            return null;
        }

        const { roleRaw, auxRolesRaw } = getResult.results;

        const role = ID_TO_ROLE[roleRaw as string];
        const auxRoles = decodeAuxRoles(auxRolesRaw as string);

        if (!deleteResult.success) {
            // TODO: sentry
            // if this fails, but getResult.success was true, i'm not sure what
            // happened here.
            return null;
        }

        return { role, auxRoles };
    };
}
