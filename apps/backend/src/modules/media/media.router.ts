import type { RequestHandler } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";

import { ApiError } from "@/errors/api-error.js";
import { createChildLogger } from "@/lib/logger.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOADS_PER_REQUEST = 10;
const ADMIN_MEDIA_ROUTE = "/admin/media/:id";
const routerLogger = createChildLogger("media:router");

type RouteRegistrar = (method: string, path: string) => void;

export interface MediaRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: MediaService;
  controller?: MediaController;
}

const createUploadParser = (): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_UPLOADS_PER_REQUEST,
    },
  }).any();

  return (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof MulterError) {
        let status = 400;

        if (error.code === "LIMIT_FILE_SIZE") {
          status = 413;
        }

        if (error.code === "LIMIT_FILE_COUNT") {
          status = 413;
        }

        next(
          new ApiError(error.message, {
            status,
          }),
        );
        return;
      }

      next(error);
    });
  };
};

const createUploadRateLimiter = () =>
  createRateLimiter({
    identifier: "media-upload",
    max: 10,
    windowSeconds: 60,
    allowInternalBypass: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : undefined),
  });

const createMetricsRateLimiter = () =>
  createRateLimiter({
    identifier: "media-metrics",
    max: 60,
    windowSeconds: 300,
    allowInternalBypass: true,
  });

const MEDIA_COLLECTION_PATH = "/media";
const MEDIA_RESOURCE_PATH = "/media/:id";
const MEDIA_UPLOAD_PATH = "/media/upload";
const MEDIA_SIGNATURE_PATH = "/media/signature";
const MEDIA_LCP_PATH = "/media/metrics/lcp";

export const createMediaRouter = (
  config: ApplicationConfig,
  options: MediaRouterOptions = {},
): Router => {
  const router = Router();
  const { registerRoute } = options;

  const service = options.service ?? new MediaService();
  const controller = options.controller ?? new MediaController({ service, config });

  const requireAuth = createRequireAuthMiddleware();
  const requireMediaRole = createRequireRoleMiddleware(["admin", "staff"]);
  const uploadLimiter = createUploadRateLimiter();
  const uploadParser = createUploadParser();
  const metricsLimiter = createMetricsRateLimiter();

  const enableRuntimeWarmers = config.app.environment !== "test";

  if (enableRuntimeWarmers && !options.service && !options.controller) {
    service
      .warmPopularAssets()
      .catch((error) => routerLogger.warn("Media cache warmup trigger failed", { error }));
    service.startUsageMonitoring();
  }

  router.get(MEDIA_COLLECTION_PATH, requireAuth, controller.list);
  registerRoute?.("GET", MEDIA_COLLECTION_PATH);

  router.get(MEDIA_RESOURCE_PATH, requireAuth, controller.get);
  registerRoute?.("GET", MEDIA_RESOURCE_PATH);

  router.post(MEDIA_UPLOAD_PATH, requireAuth, uploadLimiter, uploadParser, controller.upload);
  registerRoute?.("POST", MEDIA_UPLOAD_PATH);

  router.post(MEDIA_SIGNATURE_PATH, requireAuth, controller.signature);
  registerRoute?.("POST", MEDIA_SIGNATURE_PATH);

  router.post(MEDIA_LCP_PATH, metricsLimiter, controller.recordLcpMetric);
  registerRoute?.("POST", MEDIA_LCP_PATH);

  router.put(ADMIN_MEDIA_ROUTE, requireAuth, requireMediaRole, controller.update);
  registerRoute?.("PUT", ADMIN_MEDIA_ROUTE);

  router.post(
    `${ADMIN_MEDIA_ROUTE}/regenerate`,
    requireAuth,
    requireMediaRole,
    controller.regenerate,
  );
  registerRoute?.("POST", `${ADMIN_MEDIA_ROUTE}/regenerate`);

  router.delete(ADMIN_MEDIA_ROUTE, requireAuth, requireMediaRole, controller.softDelete);
  registerRoute?.("DELETE", ADMIN_MEDIA_ROUTE);

  router.delete(
    `${ADMIN_MEDIA_ROUTE}/permanent`,
    requireAuth,
    requireMediaRole,
    controller.hardDelete,
  );
  registerRoute?.("DELETE", `${ADMIN_MEDIA_ROUTE}/permanent`);

  return router;
};
