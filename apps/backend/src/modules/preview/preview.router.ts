/* istanbul ignore file */

import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { PreviewController } from "./preview.controller.js";
import { PreviewService } from "./preview.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface PreviewRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: PreviewService;
  controller?: PreviewController;
}

const createPreviewRateLimiter = () =>
  createRateLimiter({
    identifier: "preview",
    max: 60,
    windowSeconds: 60,
    allowInternalBypass: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : undefined),
  });

const PREVIEW_GENERATE_PATH = "/previews/generate";
const PREVIEW_BATCH_PATH = "/previews/batch";
const PREVIEW_RESOURCE_PATH = "/previews/:id";

export const createPreviewRouter = (
  _config: ApplicationConfig,
  options: PreviewRouterOptions = {},
): Router => {
  const router = Router();

  const service = options.service ?? new PreviewService();
  const controller = options.controller ?? new PreviewController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const limiter = createPreviewRateLimiter();

  router.post(PREVIEW_GENERATE_PATH, requireAuth, limiter, controller.generate);
  options.registerRoute?.("POST", PREVIEW_GENERATE_PATH);

  router.post(PREVIEW_BATCH_PATH, requireAuth, limiter, controller.batch);
  options.registerRoute?.("POST", PREVIEW_BATCH_PATH);

  router.get(PREVIEW_RESOURCE_PATH, requireAuth, controller.get);
  options.registerRoute?.("GET", PREVIEW_RESOURCE_PATH);

  return router;
};
