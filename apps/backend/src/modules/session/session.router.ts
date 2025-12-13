/* istanbul ignore file */

import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { SessionController } from "./session.controller.js";
import { SessionService } from "./session.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface SessionRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: SessionService;
  controller?: SessionController;
}

const createSessionRateLimiter = () =>
  createRateLimiter({
    identifier: "design-session",
    max: 120,
    windowSeconds: 60,
    allowInternalBypass: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : undefined),
  });

const SESSION_SAVE_PATH = "/sessions/save";
const SESSIONS_COLLECTION_PATH = "/sessions";
const SESSION_RESOURCE_PATH = "/sessions/:id";
const SESSION_SHARE_PATH = "/sessions/:id/share";
const SESSION_SHARED_PATH = "/sessions/shared/:token";

export const createSessionRouter = (
  _config: ApplicationConfig,
  options: SessionRouterOptions = {},
): Router => {
  const router = Router();

  const service = options.service ?? new SessionService();
  const controller = options.controller ?? new SessionController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const limiter = createSessionRateLimiter();

  router.post(SESSION_SAVE_PATH, requireAuth, limiter, controller.save);
  options.registerRoute?.("POST", SESSION_SAVE_PATH);

  router.get(SESSIONS_COLLECTION_PATH, requireAuth, controller.list);
  options.registerRoute?.("GET", SESSIONS_COLLECTION_PATH);

  router.get(SESSION_SHARED_PATH, controller.getShared);
  options.registerRoute?.("GET", SESSION_SHARED_PATH);

  router.post(SESSION_SHARE_PATH, requireAuth, controller.share);
  options.registerRoute?.("POST", SESSION_SHARE_PATH);

  router.get(SESSION_RESOURCE_PATH, controller.get);
  options.registerRoute?.("GET", SESSION_RESOURCE_PATH);

  router.delete(SESSION_RESOURCE_PATH, requireAuth, controller.delete);
  options.registerRoute?.("DELETE", SESSION_RESOURCE_PATH);

  return router;
};
