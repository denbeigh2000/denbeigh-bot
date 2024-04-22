import {
    APIChatInputApplicationCommandGuildInteraction,
    APIInteractionResponse,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

// A thing that is able to handle a slash command
export abstract class CommandHandler<Input, Output> {
    definition: RESTPostAPIChatInputApplicationCommandsJSONBody;

    constructor(definition: RESTPostAPIChatInputApplicationCommandsJSONBody) {
        this.definition = definition;
    }

    // Map the relevant information out of the command structure
    abstract mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): Input;
    // Map the output from the input/output of the operation into a response
    abstract mapOutput(input: Input, output: Output): APIInteractionResponse;
    // Do the actual meat of the work of the operation (usually exported to
    // some strategy that's a property of the instantiated subclass)
    abstract handle(ctx: ExecutionContext, input: Input): Promise<Output>;
}
