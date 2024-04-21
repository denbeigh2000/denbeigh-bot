import { CommandHandler } from "@bot/plugin/command";
import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, InteractionResponseType, MessageFlags, MessageType } from "discord-api-types/v10";

export class PingCommandHandler extends CommandHandler<null, string> {
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
