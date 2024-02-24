import {
    APIMessageComponentSelectMenuInteraction,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { BotClient } from "../../discord/client";
import { Env, getUserRole } from "../../env";
import { Sentry } from "../../sentry";
import { admittedUser } from "../../discord/messages/log";
import { idsToRole, Role, roleToID } from "../../roles";

export async function handler(
    interaction: APIMessageComponentSelectMenuInteraction,
    env: Env,
    _ctx: ExecutionContext,
    sentry: Sentry
) {
    const now = new Date();
    const customId = interaction.data.custom_id;
    if (!customId.startsWith("action_")) {
        sentry.captureMessage(
            `Unhandled custom_id: ${customId}`,
            "warning"
        );
        return;
    }

    const fragments = customId.split("_");
    if (fragments.length !== 2) {
        // TODO: Better validation
        throw new Error(`invalid fragments ${fragments}`);
    }

    const userId = fragments[1];
    const botClient = new BotClient(env.BOT_TOKEN, sentry);
    const action = interaction.data.values[0];

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
}

