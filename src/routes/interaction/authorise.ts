import {
    APIGuildMember,
    APIMessageComponentInteraction,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { BotClient } from "../../discord/client";
import { Env } from "../../env";
import { Sentry } from "../../sentry";
import { admittedUser } from "../../discord/messages/log";
import { idsToRole, Role, roleToID } from "../../roles";
import { Snowflake } from "discord-api-types/globals";

async function handleAccept(_interaction: APIMessageComponentInteraction, _env: Env, _now: Date, _userID: Snowflake): Promise<boolean> {
    throw new Error("unimplemented");
}

async function handleBan(_interaction: APIMessageComponentInteraction, _env: Env, _now: Date, _userID: Snowflake): Promise<boolean> {
    throw new Error("unimplemented");
}

async function handleIgnore(_interaction: APIMessageComponentInteraction, _env: Env, _user: string): Promise<boolean> {
    throw new Error("unimplemented");
}

async function handleButton(interaction: APIMessageComponentInteraction, env: Env, now: Date, action: String, userID: Snowflake, sentry: Sentry): Promise<boolean> {
    switch (action) {
        case "accept":
            return await handleAccept(interaction, env, now, userID);
        case "ignore":
            return await handleIgnore(interaction, env, userID);
        case "ban":
            return await handleBan(interaction, env, now, userID);
        default:
            sentry.captureMessage(`Unknown action: ${action}`, "error");
            return false;
    }
}

export async function handler(
    interaction: APIMessageComponentInteraction,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const now = new Date();
    const customId = interaction.data.custom_id;
    const fragments = customId.split("_", 4);
    if (fragments.length < 4) {
        sentry.captureMessage(
            `Poorly-formed fragments: ${fragments}`,
            "error"
        );
        return;
    }

    const [_, item, action, userID] = fragments;
    const botClient = new BotClient(env.BOT_TOKEN, sentry);

    switch (item) {
        case "button":
            // Nothing to do for selections
            await handleButton(interaction, env, now, action, userID, sentry);
            await botClient.deleteMessage(
                env.PENDING_CHANNEL,
                interaction.message.id
            );
            return;
        case "select":
            return;
        default:
            sentry.captureMessage(`Unknown item: ${item}`, "error");
            return;
    }

    /*

    // TODO: need to change this to handle new interaction structure
    let role: Role | null = null;
    switch (action) {
        case "reject_ignore":
            break;
        case "accept_guest":
            role = Role.Guest;
            break;
        case "accept_member":
            role = Role.Member;
            break;
        case "accept_moderator":
            role = Role.Moderator;
            break;
        default:
            sentry.captureMessage(
                `unhandled select value ${action}`,
                "warning"
            );
            return;
    }

    // TODO: better defensiveness in case this was done in a dm...somehow?
    const member = await botClient.getGuildMember(interaction.guild_id!, userId);
    // TODO: this is going to change shortly to support bans, too
    if (action && !member) {
        await botClient.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content: "This user could not be found (did they leave?)",
                flags: MessageFlags.Ephemeral,
            }
        );
        await botClient.deleteMessage(
            env.PENDING_CHANNEL,
            interaction.message.id
        );

        return;
    }


    let userRole = idsToRole(env, interaction.member!.roles);
    if (!userRole) {
        await botClient.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content: "You have no valid roles",
                flags: MessageFlags.Ephemeral,
            }
        );
        return;
    }

    const isNotMod = userRole < Role.Moderator;
    const isGuest = userRole < Role.Member;
    const roleNotAboveAwarding = role && userRole <= role;
    if (isGuest || (isNotMod && roleNotAboveAwarding)) {
        await botClient.sendFollowup(
            env.CLIENT_ID,
            interaction.token,
            {
                content:
                    "You do not have sufficient privileges to grant this",
                flags: MessageFlags.Ephemeral,
            }
        );
        return;
    }

    let logMessage: string;
    if (role) {
        const applyRole = roleToID(env, role)!;
        await botClient.addRole(
            interaction.guild_id!,
            userId,
            applyRole
        );
        logMessage = `admitted <@${userId}> with the <@&${applyRole}> role`;
    } else {
        await botClient.kickUser(interaction.guild_id!, userId);
        logMessage = `kicked <@${userId}>`;
    }
    const msg = admittedUser(env, interaction.member!, member!, now, role!, [])
    await botClient.createMessage(env.LOG_CHANNEL, msg);
    await botClient.deleteMessage(
        env.PENDING_CHANNEL,
        interaction.message.id
    );

    */
}

