import { PluginError, SentryReportData } from "@bot/plugin/error";

export enum NoWorkHandlerErrorType {
    MIS_STRUCTURED_COMMAND = "mis_structured_command",
}

export class NoWorkHandlerError extends PluginError {
    type: NoWorkHandlerErrorType;
    data?: any;

    constructor(type: NoWorkHandlerErrorType, data?: any) {
        super("NoWorkHandlerError");

        this.type = type;
        this.data = data;
    }

    toOperatorMessage(): string {
        let extra: string;
        switch (this.type) {
            case NoWorkHandlerErrorType.MIS_STRUCTURED_COMMAND:
                extra = "mis-structured command" + (this.data
                    ? ` (${this.data})`
                    : "");
                break;
        }

        return `error showing /nowork: ${extra}`;
    }

    toUserMessage(): string {
        return "Internal error";
    }

    sentryData(): SentryReportData | null {
        return {
            message: this.toOperatorMessage(),
            level: "warning",
        };
    }
}

