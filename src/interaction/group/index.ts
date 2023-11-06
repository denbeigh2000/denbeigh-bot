import {
    APIChatInputApplicationCommandGuildInteraction,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord-api-types/payloads/v10";
import { RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/rest/v10/webhook";

import { BotClient } from "../../discord";
import { Env } from "../../env";
import { Sentry } from "../../sentry";
import { GroupManager } from "../../groups";

import { handler as createHandler, subcommand as createSubcommand } from "./create";
import { handler as deleteHandler, subcommand as deleteSubcommand } from "./delete";
import { handler as leaveHandler, subcommand as leaveSubcommand } from "./leave";
import { handler as listHandler, subcommand as listSubcommand } from "./list";
import { handler as joinHandler, subcommand as joinSubcommand } from "./join";
import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

export const command: RESTPostAPIChatInputApplicationCommandsJSONBody =
{
    name: "group",
    description: "Manage the groups you're in to meet cool people",
    options: [
        listSubcommand,
        joinSubcommand,
        createSubcommand,
        leaveSubcommand,
        deleteSubcommand,
    ],
};

export async function handler(
    client: BotClient,
    interaction: APIChatInputApplicationCommandGuildInteraction,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
): Promise<RESTPostAPIWebhookWithTokenJSONBody> {
    const manager = new GroupManager(
        client,
        env.GUILD_ID,
        env.MOD_ROLE,
        env.MEMBER_ROLE,
        env.GUEST_ROLE
    );

    const flags = MessageFlags.Ephemeral & MessageFlags.Urgent;

    const { options } = interaction.data;
    if (!options) {
        const msg = "No options defined in group command";
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const user = interaction.member!.user.id;
    if (options.length !== 1) {
        const msg = `Unexpected number of elements ${options.length}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const option = options[0];
    if (option.type !== ApplicationCommandOptionType.Subcommand) {
        const msg = `Unexpected option type${option.type}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    if (!option.options) {
        const msg = "No options in subcommand";
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const subcommandName = option.name;
    if (subcommandName === "list") {
        return await listHandler(manager);
    }

    if (option.options.length !== 1) {
        const msg = `Expected exactly 1 option, got ${option.options.length}`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }
    const subOption = option.options[0];
    if (
        subOption.type !== ApplicationCommandOptionType.String ||
        subOption.name !== "name"
    ) {
        const msg = `Unexpected option ${subOption}, expected a string with name "name"`;
        sentry.captureMessage(msg, "warning");
        return { content: msg, flags };
    }

    const groupName = subOption.value;

    switch (option.name) {
        case "create":
            return await createHandler(manager, groupName, user);
        case "join":
            return await joinHandler(manager, groupName, user);
        case "leave":
            return await leaveHandler(manager, groupName, user);
        case "delete":
            return await deleteHandler(manager, groupName, user);
        default:
            return { content: `Unknown command ${option.name}`, flags };
    }
}
