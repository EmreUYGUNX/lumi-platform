import { Router } from "express";

import { createAuthRateLimiter } from "@/middleware/auth/authRateLimiter.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import type { ApplicationConfig } from "@lumi/types";

import {
  type AuthController,
  type AuthControllerOptions,
  createAuthController,
} from "./auth.controller.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface AuthRouterOptions {
  registerRoute?: RouteRegistrar;
  controller?: AuthController;
  controllerOptions?: AuthControllerOptions;
}

const registerRoute = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

const buildAuthRateLimiters = () => {
  const loginLimiter = createAuthRateLimiter({
    keyPrefix: "auth:login",
    points: 5,
    durationSeconds: 15 * 60,
    message: "Too many login attempts. Please try again later.",
  });

  const registerLimiter = createAuthRateLimiter({
    keyPrefix: "auth:register",
    points: 5,
    durationSeconds: 15 * 60,
    message: "Too many registration attempts. Please try again later.",
  });

  const refreshLimiter = createAuthRateLimiter({
    keyPrefix: "auth:refresh",
    points: 10,
    durationSeconds: 60,
    message: "Too many refresh attempts. Please slow down.",
  });

  const forgotPasswordLimiter = createAuthRateLimiter({
    keyPrefix: "auth:forgot-password",
    points: 3,
    durationSeconds: 60 * 60,
    message: "Too many password reset requests. Please try again later.",
  });

  const resendVerificationLimiter = createAuthRateLimiter({
    keyPrefix: "auth:resend-verification",
    points: 3,
    durationSeconds: 60 * 60,
    message: "Verification email already sent. Please wait before requesting again.",
    keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
  });

  const changePasswordLimiter = createAuthRateLimiter({
    keyPrefix: "auth:change-password",
    points: 5,
    durationSeconds: 60 * 60,
    message: "Too many password change attempts. Please try again later.",
    keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
  });

  return {
    loginLimiter,
    registerLimiter,
    refreshLimiter,
    forgotPasswordLimiter,
    resendVerificationLimiter,
    changePasswordLimiter,
  };
};

export const createAuthRouter = (
  config: ApplicationConfig,
  options: AuthRouterOptions = {},
): Router => {
  const router = Router();
  const controller =
    options.controller ??
    createAuthController({
      config,
      ...options.controllerOptions,
    });

  const requireAuth = createRequireAuthMiddleware();
  const {
    loginLimiter,
    registerLimiter,
    refreshLimiter,
    forgotPasswordLimiter,
    resendVerificationLimiter,
    changePasswordLimiter,
  } = buildAuthRateLimiters();

  router.post("/register", registerLimiter, controller.register);
  registerRoute(options.registerRoute, "POST", "/register");

  router.post("/login", loginLimiter, controller.login);
  registerRoute(options.registerRoute, "POST", "/login");

  router.post("/refresh", refreshLimiter, controller.refresh);
  registerRoute(options.registerRoute, "POST", "/refresh");

  router.post("/logout", requireAuth, controller.logout);
  registerRoute(options.registerRoute, "POST", "/logout");

  router.post("/logout-all", requireAuth, controller.logoutAll);
  registerRoute(options.registerRoute, "POST", "/logout-all");

  router.get("/me", requireAuth, controller.me);
  registerRoute(options.registerRoute, "GET", "/me");

  router.post("/verify-email", controller.verifyEmail);
  registerRoute(options.registerRoute, "POST", "/verify-email");

  router.post(
    "/resend-verification",
    requireAuth,
    resendVerificationLimiter,
    controller.resendVerification,
  );
  registerRoute(options.registerRoute, "POST", "/resend-verification");

  router.post("/forgot-password", forgotPasswordLimiter, controller.forgotPassword);
  registerRoute(options.registerRoute, "POST", "/forgot-password");

  router.post("/reset-password", controller.resetPassword);
  registerRoute(options.registerRoute, "POST", "/reset-password");

  router.put("/change-password", requireAuth, changePasswordLimiter, controller.changePassword);
  registerRoute(options.registerRoute, "PUT", "/change-password");

  return router;
};
