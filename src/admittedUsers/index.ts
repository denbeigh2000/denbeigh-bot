import { Snowflake } from "discord-api-types/globals";
import { AuxRole, Role } from "../roles";
import { Sentry } from "../sentry";
import { AdmittedUserStore } from "./store";

export type AuxRoleAssignments = {
    [key in AuxRole]?: { addedAt: Date }
};

export interface UserRecord {
    userID: string,
    role: Role,
    auxRoles: AuxRoleAssignments,
    addedAt: Date,
    roleUpdatedAt: Date,
}

export class AdmittedUserManager {
    sentry: Sentry;
    store: AdmittedUserStore;

    constructor(db: D1Database, sentry: Sentry) {
        this.sentry = sentry;
        this.store = new AdmittedUserStore(db, sentry);
    }

    async addUser(opts: { userID: Snowflake, role: Role, auxRoles?: AuxRole[] }) {
        const { userID, role, auxRoles } = opts;
        await this.store.upsertUser(userID, role);
        if (auxRoles) {
            await Promise.all(auxRoles.map(r => this.store.addAuxRole(userID, r)));
        }
    }

    async getUser({ userID }: { userID: Snowflake }): Promise<UserRecord | null> {
        const user = await this.store.getUser(userID);
        if (!user) {
            return null;
        }

        const auxRoleList = await this.store.getAuxRoles(userID);
        const auxRoles = auxRoleList.reduce((memo, { role, addedAt }) => {
            if (memo[role]) {
                throw `dupe rule ${role}`;
            }

            memo[role] = { addedAt };
            return memo;
        }, {});

        return {
            ...user,
            auxRoles,
        };
    }

    async removeUser({ userID }: { userID: Snowflake }) {
        await this.store.deleteUser(userID);
    }

    async addAuxRole({ userID, auxRole }: { userID: Snowflake, auxRole: AuxRole }) {
        await this.store.addAuxRole(userID, auxRole);
    }

    async removeAuxRole({ userID, auxRole }: { userID: Snowflake, auxRole: AuxRole }) {
        await this.store.removeAuxRole(userID, auxRole);
    }
}
