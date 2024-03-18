import {
    APIButtonComponent,
    APIGuildMember,
    APISelectMenuOption,
    ButtonStyle,
    ComponentType,
    RESTPostAPIChannelMessageJSONBody,
    Snowflake,
} from "discord-api-types/v10";

import { avatarURL, COLOURS, convertSnowflakeToDate } from "..";
import { Env } from "../../env";
import { AUX_ROLE_META, RoleMeta, ROLE_META } from "../../roles";
import { formatUser } from "../../util";

function renderRole(role: RoleMeta): APISelectMenuOption {
    return {
        label: role.friendlyName,
        value: role.id,
        description: role.description,
        emoji: {
            id: undefined,
            name: role.emoji,
        },
        default: false
    };
}

interface ButtonMeta {
    style: ButtonStyle.Success | ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Danger,
    label: string,
    id: string,
    emoji: string,
}

const AUTH_BUTTONS: Array<ButtonMeta> = [
    {
        style: ButtonStyle.Success,
        label: "Accept",
        id: "accept",
        emoji: "✅",
    },
    {
        style: ButtonStyle.Secondary,
        label: "Ignore",
        id: "ignore",
        emoji: "😔",
    },
    {
        style: ButtonStyle.Danger,
        label: "Ban",
        id: "ban",
        emoji: "🚫",
    },
];

function renderButton(userID: Snowflake): (button: ButtonMeta) => APIButtonComponent {
    return (button: ButtonMeta): APIButtonComponent => {
        return {
            custom_id: `authorise_${button.id}_${userID}`,
            style: button.style,
            label: button.label,
            disabled: false,
            emoji: {
                id: undefined,
                name: button.emoji
            },
            type: ComponentType.Button,
        };
    };
}

export function authorisePendingUser(env: Env, guildMember: APIGuildMember): RESTPostAPIChannelMessageJSONBody {
    const user = guildMember.user!;

    const joinedAt = new Date(guildMember.joined_at);
    const joinTS = Math.round(Number(joinedAt) / 1000);
    const creationTS = Math.round(Number(convertSnowflakeToDate(user.id)) / 1000);
    const avatar = user.avatar && avatarURL(user.id, user.avatar) || undefined;
    const thumbnail = (avatar && { url: avatar }) || undefined;

    const fields = [
        {
            name: "Profile",
            value: `<@${user.id}>`,
        },
        {
            name: "Account created",
            value: `<t:${creationTS}:R>`,
        },
        {
            name: "Joined server",
            value: `<t:${joinTS}:R>`,
        },
    ];

    if (user.global_name) {
        fields.unshift({
            name: "Display Name",
            value: user.global_name,
        });
    }

    // Use either the user's accent colour, or blurple
    const colour = user.accent_color || COLOURS.BLURPLE;
    return {
        content: `<@&${env.MOD_ROLE}>`,
        embeds: [
            {
                title: "A new user has joined",
                description: "What would you like to do?",
                color: colour,
                fields,
                timestamp: joinedAt.toISOString(),
                thumbnail,
                author: {
                    name: formatUser(user),
                    icon_url: avatar,
                }
            }
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        custom_id: `authorise_role_${user.id}`,
                        placeholder: "Select a role",
                        options: Object.values(ROLE_META).map(renderRole),
                        min_values: 1,
                        max_values: 1,
                        type: ComponentType.StringSelect,
                    }
                ]
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        custom_id: `authorise_extraroles_${user.id}`,
                        placeholder: "Apply extra roles?",
                        options: Object.values(AUX_ROLE_META).map(renderRole),
                        min_values: 0,
                        max_values: Object.keys(AUX_ROLE_META).length,
                        type: ComponentType.StringSelect,
                    }
                ]
            },
            {
                type: ComponentType.ActionRow,
                components: AUTH_BUTTONS.map(renderButton(user.id)),
            }
        ],
        allowed_mentions: {
            roles: [env.MOD_ROLE]
        }
    };
}

