import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteraction,
    APIInteractionResponse,
    APIInteractionResponseChannelMessageWithSource,
    APIMessageComponentGuildInteraction,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import {
    isApplicationCommandGuildInteraction,
    isChatInputApplicationCommandInteraction,
    isMessageComponentGuildInteraction,
    isMessageComponentInteraction,
} from "discord-api-types/utils/v10";

import { Sentry } from "@bot/sentry";
import { Env } from "@bot/env";
import { BotClient } from "@bot/discord/client/bot";
import { formatCommandSet } from "./help";

type CommandFn = (c: BotClient, i: APIChatInputApplicationCommandGuildInteraction, e: Env, s: Sentry) => Promise<APIInteractionResponse | null>;
type ComponentFn = (c: BotClient, i: APIMessageComponentGuildInteraction, e: Env, s: Sentry) => Promise<void>;

const HelpCommandDesc: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "help",
    description: "Show all supported bot commands.",
};

interface CmdInfo {
    discDescription: RESTPostAPIChatInputApplicationCommandsJSONBody,
}

export class InteractionRouter {
    sentry: Sentry;
    cmdInfo: CmdInfo[];
    commands: SlashCommandSubrouter;
    components: ComponentInteractionSubrouter;

    constructor(env: Env, sentry: Sentry) {
        this.sentry = sentry;
        this.cmdInfo = [];
        this.components = new ComponentInteractionSubrouter(env, sentry);
        this.commands = new SlashCommandSubrouter(env, sentry);
    }

    public registerCommand(name: string, h: CommandFn, desc: RESTPostAPIChatInputApplicationCommandsJSONBody) {
        this.commands.register(name, h);
        this.cmdInfo.push({ discDescription: desc });
    }

    public registerComponent(action: string, h: ComponentFn) {
        this.components.register(action, h);
    }

    public getCommandSpec(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
        return [
            HelpCommandDesc,
            ...this.cmdInfo.map(i => i.discDescription),
        ];
    }

    public async handle(interaction: APIInteraction): Promise<APIInteractionResponse | null> {
        if (interaction.type === InteractionType.Ping) {
            return { type: InteractionResponseType.Pong };
        }

        if (isMessageComponentInteraction(interaction)) {
            if (!isMessageComponentGuildInteraction(interaction)) {
                throw "TODO: not guild interaction"
            }

            const customId = interaction.data.custom_id;
            const [action] = customId.split("_", 1);

            await this.components.handle(action, interaction)
            return { type: InteractionResponseType.DeferredMessageUpdate };
        }

        if (interaction.type === InteractionType.ApplicationCommand) {
            if (!isChatInputApplicationCommandInteraction(interaction)) {
                throw "TODO: not chat input application command interaction";
            }

            if (!isApplicationCommandGuildInteraction(interaction)) {
                throw "TODO: not in a guild";
            }

            const name = interaction.data.name;
            if (name === "help") {
                return this.handleHelp();
            }

            const resp = await this.commands.handle(name, interaction);
            if (resp === "missing") {
                throw `TODO: missing for ${name}`;
            }

            return resp;
        }

        this.sentry.captureMessage(
            `Unhandled interaction type ${interaction.type}`,
            "warning"
        );
        return null;
    }

    private handleHelp(): APIInteractionResponseChannelMessageWithSource {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: formatCommandSet(this.getCommandSpec()),
            },
        };
    }
}

export type AsyncHandler<In, Out> = (c: BotClient, i: In, e: Env, s: Sentry) => Promise<Out>;

export class Subrouter<In, Out> {
    NOUN: string;
    handlers: Record<string, AsyncHandler<In, Out>>;
    env: Env;
    sentry: Sentry;

    constructor(env: Env, sentry: Sentry) {
        this.handlers = {};
        this.env = env;
        this.sentry = sentry;
    }

    public register(key: string, h: AsyncHandler<In, Out>) {
        if (this.handlers[key]) {
            throw `${key} already registered`;
        }

        this.handlers[key] = h;
    }

    public async handle(key: string, interaction: In): Promise<Out | "missing"> {
        const handler = this.handlers[key];
        if (!handler) {
            this.sentry.captureMessage("missing interaction handler", "warning", {
                data: {
                    interaction_type: this.NOUN,
                    interaction_key: key,
                },
            });

            return "missing";
        }

        const client = new BotClient(this.env.BOT_TOKEN, this.sentry);
        return await handler(client, interaction, this.env, this.sentry);
    }
}

class ComponentInteractionSubrouter extends Subrouter<APIMessageComponentGuildInteraction, void> {
    NOUN = "component"
}

class SlashCommandSubrouter extends Subrouter<APIChatInputApplicationCommandGuildInteraction, (APIInteractionResponse | null)> {
    NOUN = "command";
}
