import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import type { createChildLogger } from "@/lib/logger.js";
import { getSentryInstance, isSentryEnabled } from "@/observability/index.js";

import { SecurityEventService } from "../security-event.service.js";

const captureMessageMock = jest.fn();
const withScopeMock = jest.fn(
  (
    callback: (scope: {
      setLevel: jest.Mock;
      setTag: jest.Mock;
      setUser: jest.Mock;
      setContext: jest.Mock;
    }) => void,
  ) => {
    const scope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setUser: jest.fn(),
      setContext: jest.fn(),
    };
    callback(scope);
  },
);

jest.mock("@/observability/index.js", () => ({
  isSentryEnabled: jest.fn(() => false),
  getSentryInstance: jest.fn(() => ({
    withScope: withScopeMock,
    captureMessage: captureMessageMock,
  })),
}));

interface PrismaMock {
  securityEvent: {
    create: jest.Mock;
  };
}

const createPrismaMock = (): PrismaMock => ({
  securityEvent: {
    create: jest.fn(),
  },
});

type LoggerMock = ReturnType<typeof createChildLogger>;
interface LoggerShape {
  error: jest.Mock;
}

const createLoggerMock = (): LoggerShape & LoggerMock =>
  ({
    error: jest.fn(),
  }) as unknown as LoggerShape & LoggerMock;

describe("SecurityEventService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    captureMessageMock.mockClear();
    withScopeMock.mockClear();
  });

  it("persists security events with associated user metadata", async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const service = new SecurityEventService({
      prisma: prisma as unknown as PrismaClient,
      logger,
    });

    const payload = { provider: "email" };
    await service.log({
      type: "auth.login.success",
      userId: "user_123",
      ipAddress: "203.0.113.10",
      userAgent: "JestAgent/1.0",
      payload,
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "auth.login.success",
        ipAddress: "203.0.113.10",
        userAgent: "JestAgent/1.0",
        payload,
        user: {
          connect: { id: "user_123" },
        },
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs a warning when persistence fails and omits optional fields", async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const error = new Error("database unavailable");
    prisma.securityEvent.create.mockImplementationOnce(() => {
      throw error;
    });
    const service = new SecurityEventService({
      prisma: prisma as unknown as PrismaClient,
      logger,
    });

    await service.log({
      type: "auth.login.failed",
      ipAddress: undefined,
      userAgent: undefined,
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "auth.login.failed",
        ipAddress: undefined,
        userAgent: undefined,
        payload: undefined,
        user: undefined,
      },
    });
    expect(logger.error).toHaveBeenCalledWith("Failed to persist security event", {
      error,
      eventType: "auth.login.failed",
      userId: undefined,
    });
  });

  it("forwards critical events to Sentry when telemetry is enabled", async () => {
    const prisma = createPrismaMock();
    const logger = createLoggerMock();
    const service = new SecurityEventService({
      prisma: prisma as unknown as PrismaClient,
      logger,
    });

    jest.mocked(isSentryEnabled).mockReturnValue(true);
    const sentry = getSentryInstance();
    captureMessageMock.mockClear();
    withScopeMock.mockClear();

    await service.log({
      type: "refresh_token_replay_detected",
      userId: "user_789",
      ipAddress: "198.51.100.24",
      userAgent: "SecurityAudit/1.0",
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "refresh_token_replay_detected",
        ipAddress: "198.51.100.24",
        userAgent: "SecurityAudit/1.0",
        payload: undefined,
        user: {
          connect: { id: "user_789" },
        },
      },
    });
    expect(withScopeMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock).toHaveBeenCalledWith(
      "Security event recorded: refresh_token_replay_detected",
      "error",
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(sentry).toBeDefined();
  });
});
