import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import type { createChildLogger } from "@/lib/logger.js";

import { SecurityEventService } from "../security-event.service.js";

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
});
