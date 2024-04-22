import { CommandHandler } from "@bot/plugin/command";
import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, InteractionResponseType, MessageFlags, MessageType, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

const definition: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: "ping",
    description: "Do the ping thing.",
};

export class PingCommandHandler extends CommandHandler<null, string> {
    constructor() {
        super(definition);
    }

    mapInput(_interaction: APIChatInputApplicationCommandGuildInteraction): null {
        return null;
    }

    mapOutput(_input: null, content: string): APIInteractionResponse {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { flags: MessageFlags.Ephemeral, content },
        };
    }

    async handle(_ctx: ExecutionContext, _input: null): Promise<string> {
        return "Pong";
    }
}
