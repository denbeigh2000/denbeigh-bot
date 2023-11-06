import { Router, IRequest } from "itty-router";

import { Env } from "../env";
import { Sentry } from "../sentry";
import { respondNotFound } from "../util/http";

import { handler as handleJoin } from "./join";
import { handler as handleRedirect } from "./redirect";
import { handler as handleInteraction } from "./interaction";
import { handler as handleRegister } from "./register";

type RequestType = [Env, ExecutionContext, Sentry];

export const router = Router<IRequest, RequestType>()
    .get("/join", handleJoin)
    .get("/redirect", handleRedirect)
    .get("/register", handleRegister)
    .post("/interaction", handleInteraction)
    .all("*", respondNotFound);
