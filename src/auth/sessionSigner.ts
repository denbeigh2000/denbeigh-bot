import * as jwt from "@tsndr/cloudflare-worker-jwt";
import { Session } from "./session";

export enum SessionSignerErrorCode {
    INVALID_SIGNATURE = "signature not valid",
}

export class SessionSignerError extends Error {
    code: SessionSignerErrorCode;

    constructor(code: SessionSignerErrorCode) {
        switch (code) {
            case SessionSignerErrorCode.INVALID_SIGNATURE:
                super("JWT did not pass validation test");
                break;
            default:
                throw `invalid code ${code}`;
        }

        this.code = code;

        // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, SessionSignerError.prototype);
    }

    toResponse(): Response {
        switch (this.code) {
            case SessionSignerErrorCode.INVALID_SIGNATURE:
                return new Response("401 Unauthorized", { status: 401 });
        }
    }
}

export class SessionSigner {
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
            throw new SessionSignerError(SessionSignerErrorCode.INVALID_SIGNATURE);
        }

        const decoded = jwt.decode(token);
        return decoded.payload as Session;
    }
}

