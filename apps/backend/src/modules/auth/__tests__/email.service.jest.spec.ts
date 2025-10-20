import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import type { ApplicationConfig } from "@lumi/types";

import { EmailService } from "../email.service.js";

jest.mock("@/config/index.js", () => ({
  getConfig: jest.fn(),
}));

jest.mock("@/lib/logger.js", () => ({
  createChildLogger: jest.fn(),
}));

const mockedGetConfig = jest.mocked(getConfig);
const mockedCreateChildLogger = jest.mocked(createChildLogger);

const createApplicationConfig = (overrides: Partial<ApplicationConfig["app"]> = {}) =>
  ({
    app: {
      frontendUrl: "https://app.example.com/",
      environment: "test",
      apiBaseUrl: "https://api.example.com",
      port: 3000,
      ...overrides,
    },
  }) as unknown as ApplicationConfig;

const createLoggerStub = () => ({
  info: jest.fn(),
  warn: jest.fn(),
});

describe("EmailService", () => {
  beforeEach(() => {
    mockedGetConfig.mockReset();
    mockedCreateChildLogger.mockReset();
  });

  it("uses defaults when dependencies are not provided", async () => {
    const loggerStub = createLoggerStub();
    const config = createApplicationConfig();
    mockedGetConfig.mockReturnValue(config);
    mockedCreateChildLogger.mockReturnValue(loggerStub as never);

    const service = new EmailService();
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");

    await service.sendVerificationEmail({
      to: "user@example.com",
      firstName: "Ada",
      token: "verify-token",
      expiresAt,
    });

    expect(mockedGetConfig).toHaveBeenCalledTimes(1);
    expect(mockedCreateChildLogger).toHaveBeenCalledWith("auth:email-service");
    expect(loggerStub.info).toHaveBeenCalledWith("Queued email verification message", {
      to: "user@example.com",
      verificationUrl: "https://app.example.com/verify-email?token=verify-token",
      expiresAt: expiresAt.toISOString(),
    });

    await service.sendAccountLockoutNotification({
      to: "user@example.com",
      unlockAt: expiresAt,
    });

    expect(loggerStub.warn).toHaveBeenCalledWith("Queued account lockout notification", {
      to: "user@example.com",
      unlockAt: expiresAt.toISOString(),
    });
  });

  it("supports custom configuration and logs auxiliary emails", async () => {
    const loggerStub = createLoggerStub();
    const config = createApplicationConfig({ frontendUrl: "https://lumi.dev" });
    const service = new EmailService({
      config,
      logger: loggerStub as never,
    });

    await service.sendPasswordResetEmail({
      to: "user@example.com",
      token: "reset-token",
      expiresAt: new Date("2025-02-02T00:00:00.000Z"),
    });

    expect(loggerStub.info).toHaveBeenCalledWith("Queued password reset email", {
      to: "user@example.com",
      resetUrl: "https://lumi.dev/reset-password?token=reset-token",
      expiresAt: "2025-02-02T00:00:00.000Z",
    });

    await service.sendPasswordChangedNotification({
      to: "user@example.com",
    });

    expect(loggerStub.info).toHaveBeenCalledWith("Queued password changed notification", {
      to: "user@example.com",
    });

    await service.sendNewDeviceLoginAlert({
      to: "user@example.com",
      deviceSummary: "Chrome on macOS",
      ipAddress: "203.0.113.45",
      time: new Date("2025-03-03T12:30:00.000Z"),
    });

    expect(loggerStub.info).toHaveBeenCalledWith("Queued new device login alert", {
      to: "user@example.com",
      deviceSummary: "Chrome on macOS",
      ipAddress: "203.0.113.45",
      time: "2025-03-03T12:30:00.000Z",
    });
  });
});
