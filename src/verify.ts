// Thanks https://gist.github.com/devsnek/77275f6e3f810a9545440931ed314dc1

function hex2bin(hex: string): Uint8Array {
    const buf = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < buf.length; i++) {
        buf[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return buf;
}

const _key: Map<string, CryptoKey> = new Map();

async function publicKey(key: string): Promise<CryptoKey> {
    if (!_key.has(key)) {
        _key.set(
            key,
            await crypto.subtle.importKey(
                "raw",
                hex2bin(key),
                {
                    name: "NODE-ED25519",
                    namedCurve: "NODE-ED25519",
                },
                true,
                ["verify"]
            )
        );
    }

    return _key.get(key)!;
}

const encoder = new TextEncoder();

export default async (
    key: string,
    request: Request,
    bodyText: string
): Promise<boolean> => {
    const pubkey = await publicKey(key);
    const timestamp =
        request.headers.get("X-Signature-Timestamp") || "";
    const signature = hex2bin(
        request.headers.get("X-Signature-Ed25519")!
    );
    return crypto.subtle.verify(
        "NODE-ED25519",
        pubkey,
        signature,
        encoder.encode(timestamp + bodyText)
    );
};
