import verify from "../discord/verify";
import { Env } from "../env";
import { Sentry } from "../sentry";
import { DEFAULT_HEADERS, returnJSON, returnStatus } from "../util/http";

import { getRouter } from "../discord/interactionRouter/registry";

export async function handler(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const body = await request.text();
    if (!(await verify(env.CLIENT_PUBLIC_KEY, request, body))) {
        return new Response(
            "my mother taught me never to talk to strangers",
            {
                status: 401,
                headers: DEFAULT_HEADERS,
            }
        );
    }

    const interaction = JSON.parse(body);
    sentry.setExtras({
        type: "interaction",
        interactionType: interaction.type,
    });

    const router = getRouter(env, sentry);
    const resp = await router.handle(interaction);
    if (!resp) {
        return returnStatus(204, "");
    }

    return returnJSON(resp);
}
