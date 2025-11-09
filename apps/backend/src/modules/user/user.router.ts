import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import { createScopedRateLimiter } from "@/middleware/rateLimiter.js";
import { createAuthService } from "@/modules/auth/auth.service.js";
import type { AuthServiceContract } from "@/modules/auth/auth.service.js";
import type { ApplicationConfig, RateLimitRouteConfig } from "@lumi/types";

import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface UserRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: UserService;
  authService?: AuthServiceContract;
  controller?: UserController;
}

const CUSTOMER_RATE_LIMIT: RateLimitRouteConfig = {
  points: 120,
  durationSeconds: 5 * 60,
  blockDurationSeconds: 5 * 60,
};

const ADMIN_RATE_LIMIT: RateLimitRouteConfig = {
  points: 300,
  durationSeconds: 5 * 60,
  blockDurationSeconds: 5 * 60,
};

const SELF_BASE_PATH = "/users/me";
const SELF_ADDRESSES_PATH = `${SELF_BASE_PATH}/addresses`;
const SELF_PREFERENCES_PATH = `${SELF_BASE_PATH}/preferences`;

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createUserRouter = (
  config: ApplicationConfig,
  options: UserRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new UserService();
  const authService = options.authService ?? createAuthService({ config });
  const controller =
    options.controller ??
    new UserController({
      service,
      authService,
    });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);

  const { middleware: customerLimiter } = createScopedRateLimiter(
    config.security.rateLimit,
    "users:self",
    CUSTOMER_RATE_LIMIT,
    {
      keyGenerator: (req) => req.user?.id ?? req.ip,
    },
  );

  const { middleware: adminLimiter } = createScopedRateLimiter(
    config.security.rateLimit,
    "users:admin",
    ADMIN_RATE_LIMIT,
    {
      keyGenerator: (req) => req.user?.id ?? req.ip,
    },
  );

  router.get(SELF_BASE_PATH, requireAuth, customerLimiter, controller.getProfile);
  register(options.registerRoute, "GET", SELF_BASE_PATH);

  router.put(SELF_BASE_PATH, requireAuth, customerLimiter, controller.updateProfile);
  register(options.registerRoute, "PUT", SELF_BASE_PATH);

  router.put(`${SELF_BASE_PATH}/password`, requireAuth, customerLimiter, controller.changePassword);
  register(options.registerRoute, "PUT", `${SELF_BASE_PATH}/password`);

  router.get(SELF_ADDRESSES_PATH, requireAuth, customerLimiter, controller.listAddresses);
  register(options.registerRoute, "GET", SELF_ADDRESSES_PATH);

  router.post(SELF_ADDRESSES_PATH, requireAuth, customerLimiter, controller.createAddress);
  register(options.registerRoute, "POST", SELF_ADDRESSES_PATH);

  router.put(
    `${SELF_ADDRESSES_PATH}/:addressId`,
    requireAuth,
    customerLimiter,
    controller.updateAddress,
  );
  register(options.registerRoute, "PUT", `${SELF_ADDRESSES_PATH}/:addressId`);

  router.delete(
    `${SELF_ADDRESSES_PATH}/:addressId`,
    requireAuth,
    customerLimiter,
    controller.deleteAddress,
  );
  register(options.registerRoute, "DELETE", `${SELF_ADDRESSES_PATH}/:addressId`);

  router.put(
    `${SELF_ADDRESSES_PATH}/:addressId/default`,
    requireAuth,
    customerLimiter,
    controller.setDefaultAddress,
  );
  register(options.registerRoute, "PUT", `${SELF_ADDRESSES_PATH}/:addressId/default`);

  router.get(SELF_PREFERENCES_PATH, requireAuth, customerLimiter, controller.getPreferences);
  register(options.registerRoute, "GET", SELF_PREFERENCES_PATH);

  router.put(SELF_PREFERENCES_PATH, requireAuth, customerLimiter, controller.updatePreferences);
  register(options.registerRoute, "PUT", SELF_PREFERENCES_PATH);

  router.get("/admin/users", requireAuth, requireAdmin, adminLimiter, controller.adminListUsers);
  register(options.registerRoute, "GET", "/admin/users");

  router.get("/admin/users/:id", requireAuth, requireAdmin, adminLimiter, controller.adminGetUser);
  register(options.registerRoute, "GET", "/admin/users/:id");

  router.put(
    "/admin/users/:id/status",
    requireAuth,
    requireAdmin,
    adminLimiter,
    controller.adminUpdateStatus,
  );
  register(options.registerRoute, "PUT", "/admin/users/:id/status");

  router.post(
    "/admin/users/:id/unlock",
    requireAuth,
    requireAdmin,
    adminLimiter,
    controller.adminUnlockUser,
  );
  register(options.registerRoute, "POST", "/admin/users/:id/unlock");

  return router;
};
