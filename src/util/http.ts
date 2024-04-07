import { serialize as serializeCookie } from "cookie";

const A_LONG_TIME_AGO = new Date(0);
const OLD_AUTH_HEADER = "auth";

// NOTE: explicit type is required so TS is okay with this type
export const DEFAULT_HEADERS: [string, string][] = [
    ["Set-Cookie", serializeCookie(OLD_AUTH_HEADER, "deleted", { expires: A_LONG_TIME_AGO })]
];

export function returnStatus(status: number, body: string): Response {
    const headers = new Headers(DEFAULT_HEADERS);
    return new Response(`${body}\n`, { status, headers });
}

export function respond400(): Response {
    return returnStatus(400, "Bad request");
}

export function respondNotFound(): Response {
    return returnStatus(418, "get lost");
}

export function returnTODO(): Response {
    return returnStatus(500, "TODO");
}

export function returnJSON(data: object): Response {
    return new Response(JSON.stringify(data), {
        headers: [
            ["Content-Type", "application/json"],
            ...DEFAULT_HEADERS
        ],
    });
}
