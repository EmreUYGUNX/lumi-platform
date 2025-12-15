/* istanbul ignore file */

import type { RequestHandler } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";

import { ApiError } from "@/errors/api-error.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import type { ApplicationConfig } from "@lumi/types";

import { ClipartController } from "./clipart.controller.js";
import { ClipartService } from "./clipart.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface ClipartRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: ClipartService;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 25;

const createUploadParser = (): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_FILES_PER_REQUEST,
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

        next(new ApiError(error.message, { status }));
        return;
      }

      next(error);
    });
  };
};

const createUploadRateLimiter = () =>
  createRateLimiter({
    identifier: "clipart-upload",
    max: 30,
    windowSeconds: 60 * 60,
    allowInternalBypass: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : undefined),
  });

const CLIPART_COLLECTION_PATH = "/clipart";
const CLIPART_RESOURCE_PATH = "/clipart/:id";

const ADMIN_CLIPART_COLLECTION_PATH = "/admin/clipart";
const ADMIN_CLIPART_RESOURCE_PATH = "/admin/clipart/:id";

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createClipartRouter = (
  _config: ApplicationConfig,
  options: ClipartRouterOptions = {},
): Router => {
  const router = Router();

  const service = options.service ?? new ClipartService();
  const controller = new ClipartController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);
  const uploadLimiter = createUploadRateLimiter();
  const uploadParser = createUploadParser();

  router.get(CLIPART_COLLECTION_PATH, controller.listPublic);
  register(options.registerRoute, "GET", CLIPART_COLLECTION_PATH);

  router.get(CLIPART_RESOURCE_PATH, controller.getPublic);
  register(options.registerRoute, "GET", CLIPART_RESOURCE_PATH);

  router.get(ADMIN_CLIPART_COLLECTION_PATH, requireAuth, requireAdmin, controller.listAdmin);
  register(options.registerRoute, "GET", ADMIN_CLIPART_COLLECTION_PATH);

  router.get(ADMIN_CLIPART_RESOURCE_PATH, requireAuth, requireAdmin, controller.getAdmin);
  register(options.registerRoute, "GET", ADMIN_CLIPART_RESOURCE_PATH);

  router.post(
    ADMIN_CLIPART_COLLECTION_PATH,
    requireAuth,
    requireAdmin,
    uploadLimiter,
    uploadParser,
    controller.upload,
  );
  register(options.registerRoute, "POST", ADMIN_CLIPART_COLLECTION_PATH);

  router.put(ADMIN_CLIPART_RESOURCE_PATH, requireAuth, requireAdmin, controller.update);
  register(options.registerRoute, "PUT", ADMIN_CLIPART_RESOURCE_PATH);

  router.delete(ADMIN_CLIPART_RESOURCE_PATH, requireAuth, requireAdmin, controller.delete);
  register(options.registerRoute, "DELETE", ADMIN_CLIPART_RESOURCE_PATH);

  return router;
};
