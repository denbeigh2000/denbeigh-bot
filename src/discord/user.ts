import { APIUser, RESTGetAPICurrentUserResult, Routes } from "discord-api-types/v10";

import { Sentry } from "../sentry";
import { Client } from "./client";

export class UserClient extends Client {
    constructor(token: string, sentry: Sentry) {
        super("Bearer", token, sentry);
    }

    public async getUserInfo(): Promise<APIUser | null> {
        const route = Routes.user("@me");
        const user = await this.rest.get(route) as RESTGetAPICurrentUserResult;
        return user || null;
    }
}
