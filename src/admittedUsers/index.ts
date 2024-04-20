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
    denbeighID: Snowflake;
    sentry: Sentry;
    store: AdmittedUserStore;

    constructor(denbeighID: Snowflake, db: D1Database, sentry: Sentry) {
        this.denbeighID = denbeighID;

        this.sentry = sentry;
        this.store = new AdmittedUserStore(db, sentry);
    }

    private async isModerator(requesterID: Snowflake): Promise<boolean> {
        if (requesterID === this.denbeighID) {
            return true;
        }

        const user = await this.store.getUser(requesterID);
        if (!user) {
            throw `don't know about requester ${requesterID}?`;
        }

        return user.role === Role.Moderator;
    }

    private async isPermitted(requesterID: Snowflake, desiredRole: Role): Promise<boolean> {
        if (await this.isModerator(requesterID)) {
            return true;
        }

        // It's fine to repeat this call, we cache responses, and the cache
        // only lasts for the lifetime of the request so things are unlikely to
        // get complicated.
        const requester = await this.store.getUser(requesterID);
        if (!requester) {
            throw `don't know about requester ${requesterID}?`;
        }

        return requester.role > desiredRole;
    }

    async addUser(opts: { requesterID: Snowflake, userID: Snowflake, role: Role, auxRoles?: AuxRole[] }) {
        const { requesterID, userID, role, auxRoles } = opts;
        const permitted = await this.isPermitted(requesterID, role);
        if (!permitted) {
            // TODO: proper error propagation
            throw "not permitted";
        }

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

    async removeUser({ requesterID, userID }: { requesterID: Snowflake, userID: Snowflake }) {
        if (!this.isModerator(requesterID)) {
            // TODO: proper error propagation
            throw `${requesterID} is not a moderator`;
        }

        await this.store.deleteUser(userID);
    }

    async addAuxRole({ userID, auxRole }: { userID: Snowflake, auxRole: AuxRole }) {
        if (userID !== this.denbeighID) {
            throw `${userID} not permitted to manage aux roles`;
        }

        await this.store.addAuxRole(userID, auxRole);
    }

    async removeAuxRole({ userID, auxRole }: { userID: Snowflake, auxRole: AuxRole }) {
        if (userID !== this.denbeighID) {
            throw `${userID} not permitted to manage aux roles`;
        }

        await this.store.removeAuxRole(userID, auxRole);
    }
}
