import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, ApplicationCommandOptionType, InteractionResponseType, MessageFlags, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIWebhookWithTokenJSONBody } from "discord-api-types/v10";
import { PluginError, SentryReportData } from "@bot/plugin/error";
import { CommandHandler } from "@bot/plugin/command";

export interface CommandHandlerInputParams {
    mentionUser?: string,
}

export enum NoWorkHandlerErrorType {
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
}

function structureErr(info: string): NoWorkHandlerError {
    return new NoWorkHandlerError(
        NoWorkHandlerErrorType.MIS_STRUCTURED_COMMAND,
        info,
    );
}

export class NoWorkHandlerError extends PluginError {
    type: NoWorkHandlerErrorType;
    data?: any;

    constructor(type: NoWorkHandlerErrorType, data?: any) {
        super("NoWorkHandlerError");

        this.type = type;
        this.data = data;
    }

    toOperatorMessage(): string {
        let extra: string;
        switch (this.type) {
            case NoWorkHandlerErrorType.MIS_STRUCTURED_COMMAND:
                extra = "mis-structured command" + (this.data
                    ? ` (${this.data})`
                    : "");
        }

        return `error showing /nowork: ${extra}`;
    }

    toUserMessage(): string {
        return "Internal error";
    }

    sentryData(): SentryReportData | null {
        return {
            message: this.toOperatorMessage(),
            level: "warning",
        };
    }
}

export default class NoWorkCommandHandler extends CommandHandler<CommandHandlerInputParams, RESTPostAPIWebhookWithTokenJSONBody> {
    definition: RESTPostAPIChatInputApplicationCommandsJSONBody = {
        name: "nowork",
        description: "Remind the chat of the no-work policy.",
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "user",
                description: "User to direct reminder to",
                required: false,
            },
        ],
    };

    mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): CommandHandlerInputParams {
        const { options } = interaction.data;
        if (options && options.length > 1)
            throw structureErr("too many options given");

        const opt = options && options[0];
        if (opt && opt.type !== ApplicationCommandOptionType.User)
            throw structureErr(`Bad option type: ${opt.type}`);

        return { mentionUser: opt && opt.value }
    }

    mapOutput(_input: CommandHandlerInputParams, output: RESTPostAPIWebhookWithTokenJSONBody): APIInteractionResponse {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: output,
        }
    }

    async handle(_ctx: ExecutionContext, { mentionUser }: CommandHandlerInputParams): Promise<RESTPostAPIWebhookWithTokenJSONBody> {

        const formattedUser = mentionUser
            ? `<@${mentionUser}> `
            : "";
        const content = `${formattedUser}No Discord feedback/feature requests/bug reports in this server.

Official support channels:
- [User feedback](https://feedback.discord.com)
- [Submit a bug report](https://dis.gd/bugreport)
- [Report abuse/violations](https://discord.com/safety/360044103651-reporting-abusive-behavior-to-discord)
- [Discord Support on Twitter](https://twitter.com/discord_support)
    `;

        const mentions = mentionUser ? [mentionUser] : [];
        return {
            content,
            allowed_mentions: { users: mentions },
            flags: MessageFlags.SuppressEmbeds,
        };
    }
}
