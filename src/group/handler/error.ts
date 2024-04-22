import { PluginError, SentryReportData } from "@bot/plugin/error"

export enum GroupCommandHandlerErrorType {
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
    INSUFFICIENT_PRIVILEGES = "insufficient_privileges",
    NO_SUCH_GROUP = "no_such_group",
}

export interface GroupCommandHandlerErrorParams {
    type: GroupCommandHandlerErrorType,
    userDesc?: string,
    opDesc?: string,
}

export class GroupCommandHandlerError extends PluginError {
    type: GroupCommandHandlerErrorType;
    userDesc?: string;
    opDesc?: string;

    constructor({ type, userDesc, opDesc }: GroupCommandHandlerErrorParams) {
        super();

        this.type = type;
        this.userDesc = userDesc;
        this.opDesc = opDesc;
    }

    toOperatorMessage(): string {
        const suffix = this.opDesc
            ? ` (${this.opDesc})`
            : "";

        let msg: string;
        switch (this.type) {
            case GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND:
                msg = "malformed command";
                break;
            case GroupCommandHandlerErrorType.INSUFFICIENT_PRIVILEGES:
                msg = "insufficient user privileges";
                break;
            case GroupCommandHandlerErrorType.NO_SUCH_GROUP:
                msg = "no such group";
                break;
        }

        return `error handling group command: ${msg}${suffix}`;
    }

    toUserMessage(): string {
        let msg: string;
        switch (this.type) {
            case GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND:
                msg = "internal error";
                break;
            case GroupCommandHandlerErrorType.INSUFFICIENT_PRIVILEGES:
                const suffix = this.userDesc
                    ? `: ${this.userDesc}`
                    : "";
                msg = `you do not have sufficient privilege for this operation${suffix}`;
                break;
            case GroupCommandHandlerErrorType.NO_SUCH_GROUP:
                const groupName = this.userDesc
                    ? ` \`${this.userDesc}\``
                    : "";
                msg = `no such group${groupName}`;
                break;
        }

        return `Group operation failed: ${msg}`;
    }

    sentryData(): SentryReportData | null {
        switch (this.type) {
            case GroupCommandHandlerErrorType.INSUFFICIENT_PRIVILEGES:
            case GroupCommandHandlerErrorType.NO_SUCH_GROUP:
                return null;
            case GroupCommandHandlerErrorType.MIS_STRUCTURED_COMMAND:
                return {
                    message: this.toUserMessage(),
                    level: "warning",
                }
        }
    }
}
