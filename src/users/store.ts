import { Snowflake } from "discord-api-types/globals";
import { D1QB } from "workers-qb";

import { Roles } from "./roles";

const TABLE_NAME = "users";

export class UserStore {
    db: D1QB

    constructor(db: D1Database) {
        this.db = new D1QB(db);
    }

    setRole(user: Snowflake, role: Roles) {
        this.qb.insert({
            tableName: TABLE_NAME,

        }).execute();
    }
}
