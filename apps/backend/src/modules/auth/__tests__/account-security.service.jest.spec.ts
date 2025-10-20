import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";

import { AccountSecurityService } from "../account-security.service.js";

interface PrismaMock {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

const createPrismaMock = (): PrismaMock => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

const createSecurityEventsMock = () => ({
  log: jest.fn(() => Promise.resolve()),
});

const createLoggerMock = () => ({
  info: jest.fn(),
});

describe("AccountSecurityService", () => {
  it("clears lockout state and records manual unlock security event", async () => {
    const prisma = createPrismaMock();
    const securityEvents = createSecurityEventsMock();
    const logger = createLoggerMock();

    const userRecord = {
      id: "user_123",
      email: "user@example.com",
      firstName: "Ada",
      failedLoginCount: 5,
      lockoutUntil: new Date("2025-01-01T00:15:00.000Z"),
    };

    prisma.user.findUnique.mockResolvedValue(userRecord as never);
    prisma.user.update.mockResolvedValue({} as never);

    const service = new AccountSecurityService({
      prisma: prisma as unknown as PrismaClient,
      logger: logger as never,
      securityEvents: securityEvents as never,
    });

    await service.unlockUserAccount({
      userId: "user_123",
      performedBy: "admin_1",
      reason: "support_request",
      ipAddress: "198.51.100.12",
      userAgent: "AdminConsole/1.0",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_123" },
      data: {
        failedLoginCount: 0,
        // eslint-disable-next-line unicorn/no-null -- Explicit null ensures Prisma clears the lockout column.
        lockoutUntil: null,
      },
    });
    expect(securityEvents.log).toHaveBeenCalledWith({
      type: "account_unlock_manual",
      userId: "user_123",
      ipAddress: "198.51.100.12",
      userAgent: "AdminConsole/1.0",
      payload: {
        performedBy: "admin_1",
        reason: "support_request",
        previousLockoutUntil: userRecord.lockoutUntil.toISOString(),
        previousFailedLoginCount: 5,
      },
      severity: "warning",
    });
    expect(logger.info).toHaveBeenCalledWith("Administrator unlocked user account", {
      userId: "user_123",
      performedBy: "admin_1",
      reason: "support_request",
    });
  });

  it("throws NotFoundError when user does not exist", async () => {
    const prisma = createPrismaMock();
    // eslint-disable-next-line unicorn/no-null -- Simulating repository returning no record.
    prisma.user.findUnique.mockResolvedValue(null as never);

    const service = new AccountSecurityService({
      prisma: prisma as unknown as PrismaClient,
    });

    await expect(
      service.unlockUserAccount({
        userId: "missing",
        performedBy: "admin_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
