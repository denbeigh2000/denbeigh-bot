import { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/rest/v10";
import { ApplicationCommandOptionType } from "discord-api-types/payloads/v10";

import { Env } from "./env";
import { BotClient, UserClient } from "./discord";
import { OAuthClient } from "./oauth";
import { returnStatus } from "./http";
import { Sentry } from "./sentry";

export const PingCommand: RESTPostAPIChatInputApplicationCommandsJSONBody =
    {
        name: "ping",
        description: "Do the ping thing",
    };

export const HelpCommand: RESTPostAPIChatInputApplicationCommandsJSONBody =
    {
        name: "help",
        description: "Show information about bot commands",
    };

export const PromoteCommand: RESTPostAPIChatInputApplicationCommandsJSONBody =
    {
        name: "promote",
        description: "Sets the role of another user",
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
    };

export const InviteCommand: RESTPostAPIChatInputApplicationCommandsJSONBody =
    {
        name: "invite",
        description: "Pre-approve a user to this server",
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "username",
                description:
                    "Username of the user to invite (e.g., User#0001)",
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
    };

export const GroupCommand: RESTPostAPIChatInputApplicationCommandsJSONBody =
    {
        name: "group",
        description:
            "Manage the groups you're in to meet cool people",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "create",
                description: "Create a new group",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description:
                            "The name of the group to create",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "join",
                description: "Join an existing group",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description: "The name of the group to join",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "leave",
                description: "Leave a group you're currently in",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description: "The name of the group to leave",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "delete",
                description: "Delete an existing group",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "name",
                        description:
                            "The name of the group to delete",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "list",
                description: "List all current groups",
            },
        ],
    };

const ALL_COMMANDS = [
    InviteCommand,
    GroupCommand,
    PromoteCommand,
    PingCommand,
    HelpCommand,
];

export async function handleRegister(
    req: Request,
    env: Env,
    _ctx: FetchEvent,
    sentry: Sentry
) {
    const oauthClient = new OAuthClient(
        env.CLIENT_ID,
        env.CLIENT_SECRET,
        env.REDIRECT_URI,
        sentry
    );
    const token = await oauthClient.getRefreshOrAuthorise(
        env.OAUTH,
        req
    );
    if (token instanceof Response) {
        return token;
    }

    const userClient = new UserClient(token, sentry);
    const user = await userClient.getUserInfo();
    if (!user) {
        return oauthClient.authorise(env.OAUTH);
    }

    if (user.id !== env.DENBEIGH_USER) {
        return returnStatus(403, "locals only\n");
    }

    const client = new BotClient(env.BOT_TOKEN, sentry);
    await client.bulkRegisterCommands(
        env.CLIENT_ID,
        env.GUILD_ID,
        ALL_COMMANDS
    );

    return new Response("OK\n");
}
