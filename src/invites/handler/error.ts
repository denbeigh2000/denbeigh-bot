import { PluginError, SentryReportData } from "@bot/plugin/error";

export enum InviteHandlerErrorType {
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
    NO_VALID_ROLES = "no_valid_roles",
    INSUFFICIENT_PRIVILEGE = "insufficient_privilege",
}

export interface InviteHandlerErrorParams {
    type: InviteHandlerErrorType,
    data?: any,
}

export class InviteHandlerError extends PluginError {
    type: InviteHandlerErrorType;
    data?: any;

    constructor({ type: typ, data }: InviteHandlerErrorParams) {
        super()

        this.type = typ;
        this.data = data;
    }

    toOperatorMessage(): string {
        let msg: string;
        switch (this.type) {
            case InviteHandlerErrorType.MIS_STRUCTURED_COMMAND:
                const extra = this.data
                    ? ` (${this.data})`
                    : "";

                msg = `mis-structured command${extra}`;
            case InviteHandlerErrorType.NO_VALID_ROLES:
                msg = "User has no valid roles";
            case InviteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                msg = "User has insufficient privileges to award role";
        }

        return `Error inviting user: ${msg}`;
    }

    toUserMessage(): string {
        let extra: string;
        switch (this.type) {
            case InviteHandlerErrorType.MIS_STRUCTURED_COMMAND:
                extra = "internal error";
            case InviteHandlerErrorType.NO_VALID_ROLES:
                extra = "you have no valid roles";
            case InviteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                extra = "you do not have sufficient privileges to award this role";
        }
        return `Could not create user invite: ${extra}`;
    }

    sentryData(): SentryReportData | null {
        switch (this.type) {
            case InviteHandlerErrorType.MIS_STRUCTURED_COMMAND:
                const extra = this.data
                    ? ` (${this.data})`
                    : "";
                const message = `mis-structured command${extra}`;
                return { message, level: "warning" };
            case InviteHandlerErrorType.NO_VALID_ROLES:
            case InviteHandlerErrorType.INSUFFICIENT_PRIVILEGE:
                return null;
        }
    }

}
