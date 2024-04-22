import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    ApplicationCommandOptionType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import { BotClient } from "@bot/discord/client/bot";
import { Env } from "@bot/env";
import { envToRoleIDs } from "@bot/roles";
import { Sentry } from "@bot/sentry";
import { PromoteHandler } from "@bot/promote/handler";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody =
{
    name: "promote",
    description: "Sets the role of another user (role limits apply).",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "User to apply role to",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Integer,
            name: "role",
            description: "New role to set",
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
    const handler = new PromoteHandler({
        client,
        denbeighUserID: env.DENBEIGH_USER,
        guildID: env.GUILD_ID,
        logChannelID: env.LOG_CHANNEL,
        roleIDs: envToRoleIDs(env),
    });

    // TODO: pass ctx through
    const ctx = null as any as ExecutionContext;
    const inputParams = handler.mapInput(interaction);
    const outputData = await handler.handle(ctx, inputParams);
    return handler.mapOutput(inputParams, outputData);
}
