import { PluginError, SentryReportData } from "@bot/plugin/error";

export enum PromoteHandlerErrorType {
    INSUFFICIENT_PRIVILEGE = "insufficient_privilege",
    YOU_ARE_NOT_IN_GUILD = "you_are_not_in_guild",
    TARGET_NOT_IN_GUILD = "target_not_in_guild",
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
}

export interface PromoteHandlerErrorParams {
    type: PromoteHandlerErrorType,
    data?: any,
}

export class PromoteHandlerError extends PluginError {
    type: PromoteHandlerErrorType;
    data?: any;

    constructor({ type, data }: PromoteHandlerErrorParams) {
        super();

        this.type = type;
        this.data = data;
    }

    toOperatorMessage(): string {
        const suffix = this.data && typeof this.data === "string"
            ? ` (${this.data})`
            : "";
        let extra: string;
        switch (this.type) {
            case PromoteHandlerErrorType.YOU_ARE_NOT_IN_GUILD:
                extra = "actor not in guild";
                break;
            case PromoteHandlerErrorType.TARGET_NOT_IN_GUILD:
                extra = "target not in this guild";
                break;
            case PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                extra = "underprivileged actor";
                break;
            case PromoteHandlerErrorType.MIS_STRUCTURED_COMMAND:
                extra = `malformed command${suffix}`;
        }

        return `Role awarding failed: ${extra}`;
    }

    toUserMessage(): string {
        let extra: string;
        switch (this.type) {
            case PromoteHandlerErrorType.YOU_ARE_NOT_IN_GUILD:
                extra = "you are not in this guild (somehow?)";
                break;
            case PromoteHandlerErrorType.TARGET_NOT_IN_GUILD:
                extra = "that user is not in this guild";
                break;
            case PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                const suffix = this.data && typeof this.data === "string"
                    ? ` (${this.data})`
                    : "";
                extra = `you do not have sufficient privileges${suffix}`;
                break;
            case PromoteHandlerErrorType.MIS_STRUCTURED_COMMAND:
                extra = "internal error";
                break;
        }

        return `Could not promote user: ${extra}`;
    }

    sentryData(): SentryReportData | null {
        switch (this.type) {
            case PromoteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                return null;
            default:
                return {
                    message: this.toOperatorMessage(),
                    level: "warning",
                };
        }
    }

}
