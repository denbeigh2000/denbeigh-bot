import { APIUser, RESTGetAPICurrentUserResult, Routes } from "discord-api-types/v10";

import { Sentry } from "../../sentry";
import { Client } from "./base";

export class UserClient extends Client {
    constructor(token: string, sentry: Sentry) {
        super("Bearer", token, sentry);
    }

    public async getUserInfo(): Promise<APIUser | null> {
        const route = Routes.user("@me");
        const user = await this.rest.get(route) as RESTGetAPICurrentUserResult;
        if (user) {
            this.sentry.setFromDiscordUser(user);
        }
        return user || null;
    }
}
