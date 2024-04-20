import { APIInteraction, APIUser, InteractionType } from "discord-api-types/payloads/v10";
import { Toucan, RequestData, LinkedErrors } from "toucan-js";
import { Env } from "./env";
import { formatUser } from "./util";

export class Sentry extends Toucan {
    constructor(params: { controller?: ScheduledController, request?: Request, env: Env, context: ExecutionContext }) {
        const { request, env, context: context } = params;
        const allowedHeaders = ["X-GitHub-Event", "X-GitHub-Hook-ID", "User-Agent"]

        super({
            context,
            request,
            dsn: env.SENTRY_DSN,
            environment: env.ENVIRONMENT,
            enableTracing: true,

            integrations: [
                new RequestData({ allowedHeaders }),
                new LinkedErrors(),
            ],
        });

        if (request) {
            const ghEvent = request.headers.get("X-GitHub-Event");
            if (ghEvent) {
                this.setTag("githubEvent", ghEvent);
            }
        }
    }

    public setFromDiscordUser(user: APIUser) {
        this.setTags({
            "user_id": user.id,
            "username": formatUser(user),
        });
    }

    public setFromDiscordInteraction(interaction: APIInteraction) {
        const guildID = interaction.guild_id || null;
        const tags: any = {
            isDM: !guildID,
            guildID,
            interactionType: interaction.type,
        };

        // Integer types are not easy to understand when reading Sentry.
        switch (interaction.type) {
            case InteractionType.ApplicationCommand:
                tags.command = interaction.data.name;
                tags.interactionType = "command";
                break;
            case InteractionType.Ping:
                tags.interactionType = "ping";
                break;
            case InteractionType.ModalSubmit:
                tags.interactionType = "submit"
                break;
            case InteractionType.MessageComponent:
                tags.interactionType = "component";
                break;
            case InteractionType.ApplicationCommandAutocomplete:
                tags.interactionType = "autocomplete";
                break;
        }

        this.setTags(tags);
    }

    public breadcrumbFromHTTP(category: string, url: string, response: Response, extra?: any) {
        const level = response.status >= 400 ? "error" : "info";
        this.addBreadcrumb({
            type: "webRequest",
            level,
            category,
            data: {
                url,
                extra,
                responseCode: response.status,
            },
        });

        // NOTE: Could be noisy re: people with bans?
        if (response.status >= 400) {
            this.captureMessage(`HTTP error ${response.status}`, "error");
        }
    }
}
