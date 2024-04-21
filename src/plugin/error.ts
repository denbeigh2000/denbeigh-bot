import { EventHint, SeverityLevel } from "@sentry/types";
import { RESTPostAPIChannelMessageJSONBody } from "discord-api-types/v10";

import { genericError } from "@bot/discord/messages/errors";
import { Sentry } from "@bot/sentry";

export interface SentryReportData {
    message: string,
    level?: SeverityLevel,
    hint?: EventHint,
}

export abstract class PluginError extends Error {
    errorType: 'pluginError';

    // A short (headline) summary of the message for operator identification
    // (e.g., "error writing oauth credential to db")
    abstract toOperatorMessage(): string;
    // A generic message that can be displayed to the user
    // (e.g., "we couldn't set your role" or "internal error")
    abstract toUserMessage(): string;
    // If return value is not null, error will be reported to sentry using this
    // data.
    abstract sentryData(): SentryReportData | null;

    // The message returned to the user as a response.
    // Can be overridden to return a more extravagant error
    toDiscordMessage(): RESTPostAPIChannelMessageJSONBody {
        return genericError(this.toUserMessage());
    }

    // The way the error will be reported to sentry.
    reportSentry(sentry: Sentry) {
        const payload = this.sentryData();
        if (!payload) {
            return;
        }

        sentry.captureMessage(payload.message, payload.level, payload.hint);
    }
}

export function isPluginError(item: any): item is PluginError {
    if (!(item.errorType && item.errorType === "pluginError")) {
        return false;
    }

    if (!(item.toUserMessage && typeof item.toUserMessage === "function")) {
        return false;
    }

    if (!(item.sentryData && typeof item.sentryData === "function")) {
        return false;
    }

    return true;
}
