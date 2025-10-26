import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

import { createAuthRateLimiter } from "@/middleware/auth/authRateLimiter.js";
import { createTestConfig } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import type { AuthController } from "../auth.controller.js";
import { createAuthController } from "../auth.controller.js";
import { createAuthRouter } from "../auth.routes.js";

jest.mock("@/middleware/auth/authRateLimiter.js", () => ({
  createAuthRateLimiter: jest.fn(() =>
    jest.fn((_req, _res, next) => {
      if (typeof next === "function") {
        next();
      }
    }),
  ),
}));

jest.mock("../auth.controller.js", () => ({
  createAuthController: jest.fn(() => ({
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    me: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    setupTwoFactor: jest.fn(),
    verifyTwoFactor: jest.fn(),
  })),
}));

const mockedCreateAuthRateLimiter = jest.mocked(createAuthRateLimiter);
const mockedCreateAuthController = jest.mocked(createAuthController);

const createConfig = (): ApplicationConfig => createTestConfig({ app: { environment: "test" } });

const createControllerStub = (): AuthController =>
  ({
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    me: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    setupTwoFactor: jest.fn(),
    verifyTwoFactor: jest.fn(),
  }) as unknown as AuthController;

describe("createAuthRouter", () => {
  beforeEach(() => {
    mockedCreateAuthController.mockClear();
    mockedCreateAuthRateLimiter.mockClear();
  });

  it("creates a controller when one is not supplied", () => {
    const config = createConfig();
    const controllerOptions = { logger: "stub" } as Record<string, unknown>;

    createAuthRouter(config, { controllerOptions });

    expect(mockedCreateAuthController).toHaveBeenCalledWith(
      expect.objectContaining({
        config,
        logger: "stub",
      }),
    );
    expect(mockedCreateAuthRateLimiter).toHaveBeenCalledTimes(6);
  });

  it("uses provided controller and registers all routes", () => {
    const config = createConfig();
    const controller = createControllerStub();
    const registerRoute = jest.fn();

    createAuthRouter(config, { controller, registerRoute });

    expect(mockedCreateAuthController).not.toHaveBeenCalled();
    expect(registerRoute).toHaveBeenCalledTimes(13);
    expect(registerRoute).toHaveBeenCalledWith("POST", "/register");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/login");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/refresh");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/logout");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/logout-all");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/me");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/verify-email");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/resend-verification");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/forgot-password");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/reset-password");
    expect(registerRoute).toHaveBeenCalledWith("PUT", "/change-password");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/2fa/setup");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/2fa/verify");
  });

  it("configures key generators for authenticated rate limiters", () => {
    const config = createConfig();

    createAuthRouter(config);

    const { calls } = mockedCreateAuthRateLimiter.mock;
    expect(calls).toHaveLength(6);

    const resendOptions = calls[4]?.[0];
    const changeOptions = calls[5]?.[0];

    expect(resendOptions).toMatchObject({
      keyPrefix: "auth:resend-verification",
    });
    expect(changeOptions).toMatchObject({
      keyPrefix: "auth:change-password",
    });

    const authedRequest = { user: { id: "user_123" }, ip: "198.51.100.24" } as unknown as Request;
    const anonymousRequest = { ip: "203.0.113.12" } as unknown as Request;
    const fallbackRequest = {} as unknown as Request;

    const resendKeyGenerator = resendOptions?.keyGenerator;
    const changeKeyGenerator = changeOptions?.keyGenerator;

    expect(resendKeyGenerator?.(authedRequest)).toBe("user_123");
    expect(resendKeyGenerator?.(anonymousRequest)).toBe("203.0.113.12");
    expect(resendKeyGenerator?.(fallbackRequest)).toBe("anonymous");

    expect(changeKeyGenerator?.(authedRequest)).toBe("user_123");
    expect(changeKeyGenerator?.(anonymousRequest)).toBe("203.0.113.12");
    expect(changeKeyGenerator?.(fallbackRequest)).toBe("anonymous");
  });
});
