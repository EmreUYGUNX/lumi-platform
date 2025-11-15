import type { RequestHandler } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";

import { ApiError } from "@/errors/api-error.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOADS_PER_REQUEST = 10;

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

  router.post(
    "/media/upload",
    requireAuth,
    uploadLimiter,
    requireMediaRole,
    uploadParser,
    controller.upload,
  );
  registerRoute?.("POST", "/media/upload");

  router.post("/media/signature", requireAuth, requireMediaRole, controller.signature);
  registerRoute?.("POST", "/media/signature");

  return router;
};
