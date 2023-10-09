import { Env } from "../env";
import { Sentry } from "../sentry";

// https://stackoverflow.com/a/43131635
function hexStringToArrayBuffer(hex: string): ArrayBuffer {
    const match = hex.match(/[\da-f]{2}/gi);
    if (!match) {
        throw Error(`Not a valid hex string: ${hex}`);
    }
    const array = new Uint8Array(match.map(h => parseInt(h, 16)));

    return array.buffer;
}

// https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
// https://stackoverflow.com/a/67884134
export async function verify(request: Request, hmacKey: string, sentry: Sentry): Promise<boolean> {
    const signature = request.headers.get("X-Buildkite-Signature");
    if (!signature) {
        sentry.sendMessage("Received buildkite webhook without signature", "info");
        return false;
    }

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(hmacKey.trim()),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );
    const data = await request.text();

    const verified = await crypto.subtle.verify(
        'HMAC',
        key,
        hexStringToArrayBuffer(signature),
        encoder.encode(data)
    )

    return verified;
}
