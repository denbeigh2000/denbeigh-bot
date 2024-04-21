import { PluginError, SentryReportData } from "@bot/plugin/error"

export enum FlagErrorType {
    TODO = "sample",
    INVALID_FLAG_CODE = "invalid_flag_code",
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
}

const errPageName = "a list of ISO 3166-1 codes on Wikipedia"
const errPageLink = "https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes"

export interface FlagErrorParams {
    type: FlagErrorType,
    orig?: any,
    data?: any,
}

export function structureError(msg: string): FlagError {
    return new FlagError({
        type: FlagErrorType.MIS_STRUCTURED_COMMAND,
        data: msg,
    });
}

export class FlagError extends PluginError {
    type: FlagErrorType;
    orig?: any;
    data?: any;

    constructor({ type, orig, data }: FlagErrorParams) {
        super(`FlagError: ${type}`);

        this.type = type;
        this.orig = orig;
        this.data = data
    }

    toOperatorMessage(): string {
        switch (this.type) {
            case FlagErrorType.INVALID_FLAG_CODE:
                return "FlagError: Invalid flag code";
            case FlagErrorType.TODO:
                return "FlagError: Internal error";
            case FlagErrorType.MIS_STRUCTURED_COMMAND:
                return "FlagError: Unexpected command structure";
        }
    }

    toUserMessage(): string {
        switch (this.type) {
            case FlagErrorType.INVALID_FLAG_CODE:
                const code = this.data as string;
                return `\`${code}\` is not a valid country code. See [${errPageName}](${errPageLink}).`
            case FlagErrorType.MIS_STRUCTURED_COMMAND:
                return "Internal error";
            case FlagErrorType.TODO:
                return "Not implemented.";
        }
    }

    sentryData(): SentryReportData | null {
        switch (this.type) {
            case FlagErrorType.TODO:
            case FlagErrorType.INVALID_FLAG_CODE:
                return null;
            case FlagErrorType.MIS_STRUCTURED_COMMAND:
                const msgExtra = this.data
                    ? ` (${this.data})`
                    : "";
                return {
                    message: `Unexpected flag command structure${msgExtra}`,
                    level: "error",
                    hint: this.orig
                        ? { originalException: this.orig }
                        : undefined,
                };
        }
    };
}
