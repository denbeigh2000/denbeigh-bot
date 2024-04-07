import { Snowflake } from "discord-api-types/globals";
import * as jwt from "@tsndr/cloudflare-worker-jwt";

export interface Session {
    discordID: Snowflake,
}

// https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
export class VerificationError extends Error {
    constructor() {
        super("JWT did not pass validation test");

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, VerificationError.prototype);
    }
}

export class SessionManager {
    key: CryptoKey;
    ALGORITHM: { algorithm: "ES256" };

    constructor(key: CryptoKey) {
        this.key = key;
    }

    public async sign(session: Session): Promise<string> {
        // @ts-ignore: https://github.com/tsndr/cloudflare-worker-jwt/pull/78
        return jwt.sign(session, this.key, { keyid: "init", ...this.ALGORITHM });
    }

    public async decode(token: string): Promise<Session> {
        const verified = jwt.verify(token, this.key, this.ALGORITHM);
        if (!verified) {
            throw new VerificationError();
        }

        const decoded = jwt.decode(token);
        return decoded.payload as Session;
    }
}
