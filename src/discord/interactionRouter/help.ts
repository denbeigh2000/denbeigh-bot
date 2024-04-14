import {
    APIApplicationCommandBasicOption,
    APIApplicationCommandSubcommandGroupOption,
    APIApplicationCommandSubcommandOption,
    ApplicationCommandOptionType,
    RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord-api-types/v10";

interface InfoLine {
    tokens: string[],
    description: string,
}

function formatBasicOption(cmd: APIApplicationCommandBasicOption): string {
    let inner = "";
    switch (cmd.type) {
        case ApplicationCommandOptionType.String:
        case ApplicationCommandOptionType.Integer:
        case ApplicationCommandOptionType.Boolean:
            inner = "..."
            break;
        case ApplicationCommandOptionType.Role:
            inner = "@role";
            break;
        case ApplicationCommandOptionType.User:
            inner = "@user";
            break;
        case ApplicationCommandOptionType.Mentionable:
            inner = "@mention";
            break;
        case ApplicationCommandOptionType.Channel:
            inner = "#channel";
            break;
        case ApplicationCommandOptionType.Attachment:
            inner = "attachment";
            break;
        default:
            throw `unhandled type ${cmd.type}`;
    }

    const tag = `${cmd.name}:<${inner}>`;
    if (!cmd.required) {
        return `[${tag}]`;
    }

    return tag;
}

function formatSubcommand(cmd: APIApplicationCommandSubcommandOption): InfoLine {
    const { description, name, options } = cmd;
    const tokens = [name];
    if (options) {
        for (let i = 0; i < options.length; i++) {
            tokens.push(formatBasicOption(options[i]));
        }
    }

    return { tokens, description };
}

function formatSubcommandGroup(cmd: APIApplicationCommandSubcommandGroupOption): InfoLine[] {
    const { name, options } = cmd;
    // can you even have a subcommand group without options?
    if (!options) {
        return [];
    }

    return [
        // Also add a top-level description of the command group
        { tokens: [name, "..."], description: cmd.description },
        ...options.map(cmd => {
            const line = formatSubcommand(cmd);

            return { ...line, tokens: [name, ...line.tokens] };
        }),
    ];
}

function formatCommand(cmd: RESTPostAPIChatInputApplicationCommandsJSONBody): InfoLine[] {
    const lines: InfoLine[] = [];
    const tokens = [`/${cmd.name}`];

    if (cmd.options) {
        for (let i = 0; i < cmd.options.length; i++) {
            const opt = cmd.options[i];
            switch (opt.type) {
                case ApplicationCommandOptionType.SubcommandGroup:
                    // SubcommandGroups may generate more than one line
                    // (groupName ...)
                    // (groupName cmd1 opt1:<..> [opt2:<..>])
                    // (groupName cmd2 opt3:<..> [opt4:<..>])
                    const subcGroups = formatSubcommandGroup(opt as APIApplicationCommandSubcommandGroupOption);
                    const subcGroupLines: InfoLine[] = subcGroups.map(subc => {
                        const { description, tokens: cmdTokens } = subc;
                        return { description, tokens: [...tokens, ...cmdTokens] };
                    });
                    lines.push.apply(subcGroupLines);
                    break;
                case ApplicationCommandOptionType.Subcommand:
                    // Subcommand will generate exactly one line
                    // (subcommandName opt1:<..> [opt2:<..>])
                    const partialLine = formatSubcommand(opt as APIApplicationCommandSubcommandOption);
                    const line = [...tokens, ...partialLine.tokens]
                    lines.push({ ...partialLine, tokens: line });
                    break;
                default:
                    // NOTE: doing this in a loop and mutating shared state will
                    // allow us to specify required options before subcommands
                    // (though i'm not sure if that's actually supported?)
                    const basicCmd = formatBasicOption(opt as APIApplicationCommandBasicOption);
                    tokens.push(basicCmd)
            }
        }
    }

    // NOTE: If we have any subcommands, we will not be able to run our base
    // command, and will have appended at least one entry to lines.
    // If we have no subcommands, we will only be able to run the base command,
    // and will have all the options we've appended to tokens.
    return lines.length > 0
        ? lines
        : [{ tokens, description: cmd.description }];
}

export function formatCommandSet(cmds: RESTPostAPIChatInputApplicationCommandsJSONBody[]): string {
    return cmds.map(cmd => {
        const infos = formatCommand(cmd);
        const fullInfos = infos.length > 1
            ? [{ tokens: [`/${cmd.name}`, "..."], description: cmd.description }, ...infos]
            : infos;

        return fullInfos.map(info => {
            const cmdDesc = info.tokens.join(" ");
            return `\`${cmdDesc}\`: ${info.description}`;
        }).join("\n");
    }).join("\n\n");
}
