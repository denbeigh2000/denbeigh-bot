import {
    APIGuildMember,
    APIMessageComponentGuildInteraction,
    APIMessageStringSelectInteractionData,
    ComponentType,
} from "discord-api-types/payloads/v10";

import { BotClient } from "../../../discord/client";
import { genericEphemeral } from "../../../discord/messages/errors";
import { admittedUser, bannedUser } from "../../../discord/messages/log";
import { Env } from "../../../env";
import { Sentry } from "../../../sentry";
import { Snowflake } from "discord-api-types/globals";
import { Results, StateStore } from "../../../admission/statestore";
import { auxRoleToID, idsToRole, ID_TO_AUX_ROLE, ID_TO_ROLE, roleToID } from "../../../roles";
import { getMultiUserId, MultiUser } from "../../../discord";

async function handleAccept(env: Env, now: Date, admitted: APIGuildMember, admitter: APIGuildMember, state: Results, botClient: BotClient): Promise<boolean> {
    const { role, auxRoles } = state;
    const roles = [roleToID(env, role)].concat(auxRoles.map(r => auxRoleToID(env, r)));
    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        await botClient.addRole(env.GUILD_ID, admitted.user!.id, role);
    }

    const msg = admittedUser(env, admitter, admitted, now, role, auxRoles);
    await botClient.createMessage(env.LOG_CHANNEL, msg);

    return true;
}

async function handleBan(env: Env, now: Date, banned: MultiUser, banner: APIGuildMember, botClient: BotClient): Promise<boolean> {
    await botClient.banUser(env.GUILD_ID, getMultiUserId(banned));
    const msg = bannedUser(env, banner, banned!, now);
    await botClient.createMessage(env.LOG_CHANNEL, msg);

    return true;
}

async function handleIgnore(env: Env, banned: MultiUser, botClient: BotClient): Promise<boolean> {
    await botClient.kickUser(env.GUILD_ID, getMultiUserId(banned));
    return true;
}

async function getBestUser(botClient: BotClient, guildID: Snowflake, userID: Snowflake): Promise<MultiUser> {
    const guildMember = await botClient.getGuildMember(guildID, userID);
    if (guildMember) {
        return { type: "guildMember", data: guildMember };
    }

    const user = await botClient.getUser(userID);
    if (user) {
        return { type: "user", data: user };
    }

    return { type: "snowflake", data: userID };
}

async function handleButton(interaction: APIMessageComponentGuildInteraction, env: Env, now: Date, action: String, userID: Snowflake, botClient: BotClient, sentry: Sentry): Promise<boolean> {
    const stateStore = new StateStore(env.OAUTH_DB, sentry);

    switch (action) {
        case "accept":
        case "ignore":
        case "ban":
            break;
        default:
            sentry.captureMessage(`Unknown action: ${action}`, "error");
            return false;
    }

    const interactor = interaction.member;

    let userRole = idsToRole(env, interactor.roles);
    if (!userRole) {
        await botClient.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            genericEphemeral("You have no valid roles"),
        );
        return false;
    }

    const member = await getBestUser(botClient, env.GUILD_ID, userID);
    switch (action) {
        case "accept":
            if (member.type !== "guildMember") {
                await botClient.sendFollowup(
                    env.CLIENT_ID,
                    interaction.token,
                    genericEphemeral("This user could not be found (did they leave?)"),
                );

                return false;
            }

            const state = await stateStore.validateAndEnd(userID, interactor.user.id);
            if (!state) {
                console.warn("tried to end a thing that may have raced?");
                return false;
            }

            await handleAccept(env, now, member.data, interactor, state, botClient);
            break;
        case "ignore":
            await stateStore.end(getMultiUserId(member))
            await handleIgnore(env, member, botClient);
            break;
        case "ban":
            await stateStore.end(getMultiUserId(member))
            await handleBan(env, now, member, interactor, botClient);
            break;
    }

    await botClient.deleteMessage(
        env.PENDING_CHANNEL,
        interaction.message.id
    );

    return true;
}

async function handleSelect(data: APIMessageStringSelectInteractionData, env: Env, action: string, interactorID: string, userID: string, sentry: Sentry) {
    const store = new StateStore(env.OAUTH_DB, sentry);

    switch (action) {
        case "role":
            const rawRole = data.values[0];
            const role = ID_TO_ROLE[rawRole];
            await store.setRole(role, userID, interactorID);
            return;

        case "extraroles":
            const auxRoles = data.values.map(v => ID_TO_AUX_ROLE[v]);
            await store.setAuxRoles(auxRoles, userID, interactorID);
            return;

        default:
            // TODO: Should we respond to this with a 400 or something?
            sentry.captureMessage(`unknown action ${action}`, "error");
            return;
    }
}

export async function handler(
    _client: BotClient,
    interaction: APIMessageComponentGuildInteraction,
    env: Env,
    sentry: Sentry
) {
    const now = new Date();
    const data = interaction.data;
    const customId = data.custom_id;
    const fragments = customId.split("_", 3);
    if (fragments.length < 3) {
        sentry.captureMessage(`Poorly-formed fragments: ${fragments}`, "error");
        return;
    }

    const [_, action, userID] = fragments;
    const botClient = new BotClient(env.BOT_TOKEN, sentry);

    const interactor = interaction.member.user;

    switch (interaction.data.component_type) {
        case ComponentType.Button:
            // Nothing to do for selections
            const success = await handleButton(interaction, env, now, action, userID, botClient, sentry);
            if (success) {
            }
            return;
        case ComponentType.StringSelect:
            await handleSelect(interaction.data, env, action, interactor.id, userID, sentry);
            return;
        default:
            sentry.captureMessage(`Unexpected component_type: ${interaction.data.component_type}`, "error");
            return;
    }
}

