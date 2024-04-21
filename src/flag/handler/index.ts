import { Snowflake } from "discord-api-types/globals";
import { APIChatInputApplicationCommandGuildInteraction, APIInteractionResponse, ApplicationCommandOptionType, InteractionResponseType, MessageFlags, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

import { BotClient } from "@bot/discord/client";
import { FlagManager } from "@bot/flag";
import { CommandHandler } from "@bot/plugin/command";
import { Sentry } from "@bot/sentry";
import { structureError } from "./error";

enum FlagRequestType {
    SET = 10,
    UNSET = 20,
}

interface FlagRequest {
    type: FlagRequestType,
    user: Snowflake,
    data: any,
}

interface FlagSetRequest extends FlagRequest {
    type: FlagRequestType.SET,
    data: FlagSetParams,
}

interface FlagSetParams {
    countryCode: string,
}

interface FlagUnsetRequest extends FlagRequest {
    type: FlagRequestType.UNSET,
    data: null,
}

function isFlagSetRequest(req: FlagRequest): req is FlagSetRequest {
    return req.type === FlagRequestType.SET;
}

function isFlagUnsetRequest(req: FlagRequest): req is FlagUnsetRequest {
    return req.type === FlagRequestType.UNSET;
}

export class FlagCommandHandler extends CommandHandler<FlagRequest, null> {
    definition: RESTPostAPIChatInputApplicationCommandsJSONBody = {
        name: "flag",
        description: "Manage the flag displayed next to your display name.",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "set",
                description: "Pick a flag to show.",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "code",
                        description: "ISO-3166-1 Country Code",
                        required: true,
                    },
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "unset",
                description: "Remove any flag you have set.",
            },
        ],
    };

    client: BotClient;
    manager: FlagManager;

    constructor(client: BotClient, db: D1Database, guildID: Snowflake, sentry: Sentry) {
        super()

        this.client = client;
        this.manager = new FlagManager(db, client, guildID, sentry);
    }

    // Convert the interaction blob to input we want
    mapInput(interaction: APIChatInputApplicationCommandGuildInteraction): FlagRequest {
        const userID = interaction.member.user.id;
        const options = interaction.data.options;
        if (!options)
            throw structureError("no options data");

        const subc = options[0];
        if (subc.type !== ApplicationCommandOptionType.Subcommand)
            throw structureError("1st option not subcommand");

        switch (subc.name) {
            case "unset":
                return {
                    type: FlagRequestType.UNSET,
                    user: userID,
                    data: null,
                };

            case "set":
                const setOpt = subc.options && subc.options[0];
                if (!setOpt)
                    throw structureError("missing country code");
                if (setOpt.name !== "code")
                    throw structureError(`Unexpected sub-option ${setOpt.name}`);
                if (setOpt.type !== ApplicationCommandOptionType.String)
                    throw structureError(`Unexpected sub-option type ${setOpt.type}`);

                return {
                    type: FlagRequestType.SET,
                    user: userID,
                    data: { countryCode: setOpt.value },
                };

            default:
                throw structureError(`unexpected subcommand ${subc.name}`);
        }
    }

    // Turn the input and successful output into a response
    mapOutput(input: FlagRequest): APIInteractionResponse {
        const code = input.data?.countryCode;
        let content: string;
        if (isFlagSetRequest(input))
            content = `OK, set your flag to :flag_${code.toLowerCase()}:`;
        else if (isFlagUnsetRequest(input))
            content = "OK, removed your flag";
        else
            // TODO: proper class error type
            throw structureError(`unknown flagrequest type ${input.type} (but this should have been caught earlier(???))`)

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content, flags: MessageFlags.Ephemeral },
        };
    }

    // Do the actual handling of work we want to do (setting/unsetting the
    // flag)
    async handle(_ctx: ExecutionContext, input: FlagRequest): Promise<null> {
        // NOTE: if this were a longer running operation, we could
        //   - make this class respond with a deferred message
        //   - send the interaction ID as part of the set/unset operation
        //   - have the manager update the interaction after doing the
        //     setting/unsetting
        if (isFlagSetRequest(input))
            await this.manager.setFlag(input.user, input.data.countryCode);
        else if (isFlagUnsetRequest(input))
            await this.manager.unsetFlag(input.user);
        else
            // TODO: error class for flag that extends PluginError
            throw new Error(`unknown flagrequest type ${input.type}`);

        // NOTE: returned so the output message can be constructed
        return null;
    }
}
