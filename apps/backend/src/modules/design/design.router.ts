import type { RequestHandler } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";

import { ApiError } from "@/errors/api-error.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { DesignController } from "./design.controller.js";
import { DesignService } from "./design.service.js";
import { createSvgSanitizationMiddleware } from "./svg-sanitizer.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface DesignRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: DesignService;
  controller?: DesignController;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 1;

const createUploadParser = (): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_FILES_PER_REQUEST,
    },
  }).single("file");

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

        next(new ApiError(error.message, { status }));
        return;
      }

      next(error);
    });
  };
};

const createUploadRateLimiter = () =>
  createRateLimiter({
    identifier: "design-upload",
    max: 20,
    windowSeconds: 60 * 60,
    allowInternalBypass: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : undefined),
  });

const DESIGNS_COLLECTION_PATH = "/designs";
const DESIGN_RESOURCE_PATH = "/designs/:id";
const DESIGN_UPLOAD_PATH = "/designs/upload";

export const createDesignRouter = (
  _config: ApplicationConfig,
  options: DesignRouterOptions = {},
): Router => {
  const router = Router();

  const service = options.service ?? new DesignService();
  const controller = options.controller ?? new DesignController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const uploadLimiter = createUploadRateLimiter();
  const uploadParser = createUploadParser();
  const svgSanitizer = createSvgSanitizationMiddleware();

  router.post(
    DESIGN_UPLOAD_PATH,
    requireAuth,
    uploadLimiter,
    uploadParser,
    svgSanitizer,
    controller.upload,
  );
  options.registerRoute?.("POST", DESIGN_UPLOAD_PATH);

  router.get(DESIGNS_COLLECTION_PATH, requireAuth, controller.list);
  options.registerRoute?.("GET", DESIGNS_COLLECTION_PATH);

  router.get(DESIGN_RESOURCE_PATH, controller.get);
  options.registerRoute?.("GET", DESIGN_RESOURCE_PATH);

  router.put(DESIGN_RESOURCE_PATH, requireAuth, controller.update);
  options.registerRoute?.("PUT", DESIGN_RESOURCE_PATH);

  router.delete(DESIGN_RESOURCE_PATH, requireAuth, controller.delete);
  options.registerRoute?.("DELETE", DESIGN_RESOURCE_PATH);

  return router;
};
