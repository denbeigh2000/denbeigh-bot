import { APIMessageComponentButtonInteraction, APIModalInteractionResponse, InteractionResponseType } from "discord-api-types/payloads/v10";
import { Env } from "../env";
import { BotClient } from "../discord";
import { Sentry } from "../sentry";

export function handlePollPrepare(): APIModalInteractionResponse {
    return {
        type: InteractionResponseType.Modal,
        data: {
            title: "Create a poll",
            custom_id: 'pollcreate',
            // TODO
            components: [],
        },
    }
}

export async function handlePollCreate(
    client: BotClient,
    interaction: APIModalSubmitGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<void> {

}

export async function handlePollVote(
    client: BotClient,
    interaction: APIMessageComponentButtonInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<void> {

}
