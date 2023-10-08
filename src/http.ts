export function returnStatus(status: number, body: string): Response {
    return new Response(`${body}\n`, { status });
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
        headers: {
            "Content-Type": "application/json",
        },
    });
}
