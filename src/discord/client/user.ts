import { APIUser, RESTGetAPICurrentUserResult, RESTJSONErrorCodes, Routes } from "discord-api-types/v10";

import { Sentry } from "../../sentry";
import { Client } from "./base";

export class UserClient extends Client {
    constructor(token: string, sentry: Sentry) {
        super("Bearer", token, sentry);
    }

    public async getUserInfo(): Promise<APIUser | null> {
        const route = Routes.user("@me");
        try {
            return await this.rest.get(route) as RESTGetAPICurrentUserResult;
        } catch (e) {
            if (e.code && e.code === RESTJSONErrorCodes.Unauthorized) {
                return null;
            }

            throw e;
        }
    }
}
