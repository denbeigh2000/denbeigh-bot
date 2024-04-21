import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import { BotClient } from "@bot/discord/client";
import { Env } from "@bot/env";
import { envToRoleIDs } from "@bot/roles";
import { Sentry } from "@bot/sentry";
import { InvitesHandler } from "@bot/invites/handler";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "invite",
    description: "Pre-authorise a new user (admission rules apply).",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "username",
            description:
                "Username of the user to invite",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "role",
            description: "Role to give the new user",
            choices: [
                {
                    name: "Guest",
                    value: 10,
                },
                {
                    name: "Member",
                    value: 20,
                },
                {
                    name: "Moderator",
                    value: 30,
                },
            ],
            required: true,
        },
    ],
}

export async function handler(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _sentry: Sentry,
): Promise<APIInteractionResponse | null> {
    const handler = new InvitesHandler({
        discord: client,
        logChannel: env.LOG_CHANNEL,
        db: env.OAUTH,
        roleIDs: envToRoleIDs(env),
    });

    const inputParams = handler.mapInput(interaction);
    // TODO: pass ctx through
    const ctx = null as any as ExecutionContext;
    const outputData = await handler.handle(ctx, inputParams);
    return handler.mapOutput(inputParams, outputData);
}
