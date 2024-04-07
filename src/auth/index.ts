import { parse as parseCookie } from "cookie";

export const AUTH_COOKIE_NAME = "session";

export function getAuthToken(req: Request): string | null {
    const cookieStr = req.headers.get("Cookie");
    if (!cookieStr) {
        return null;
    }

    return parseCookie(cookieStr)[AUTH_COOKIE_NAME] || null;
}
