import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { queryAuditLogs, recordAuditLog } from "../audit-log.service.js";

jest.mock("../../database/prisma.js", () => ({
  __esModule: true,
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("../../lib/logger.js", () => ({
  __esModule: true,
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

interface PrismaAuditLogMock {
  create: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
}

let prismaMock: {
  auditLog: PrismaAuditLogMock;
};

let loggerErrorMock: jest.Mock;

beforeAll(async () => {
  const prismaModule = await import("../../database/prisma.js");
  prismaMock = prismaModule.prisma as unknown as {
    auditLog: PrismaAuditLogMock;
  };

  const loggerModule = await import("../../lib/logger.js");
  loggerErrorMock = loggerModule.logger.error as jest.Mock;
});

describe("audit log service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scrubs sensitive data before persisting audit entries", async () => {
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.create as jest.Mock).mockResolvedValue({ id: "audit-1" });

    await recordAuditLog({
      action: "product.update",
      entity: "product",
      entityId: "prod-1",
      userId: "admin-1",
      before: {
        password: "super-secret",
        status: "active",
      },
      after: {
        token: "abc",
        amount: 100,
        nested: {
          authorization: "Bearer token",
          nullable: undefined,
        },
      },
      metadata: {
        requestId: "req-1",
        secret: "hidden",
      },
      ipAddress: "127.0.0.1",
      userAgent: "jest",
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const createMock = prismaMock.auditLog.create;
    const call = createMock.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;
    expect(call).toBeDefined();
    const payload = call!.data as {
      actorType: unknown;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };

    expect(payload.actorType).toBe("ADMIN");
    expect(payload.before).toEqual({
      password: "[REDACTED]",
      status: "active",
    });
    expect(payload.after).toEqual({
      after: {
        token: "[REDACTED]",
        amount: 100,
        nested: {
          authorization: "[REDACTED]",
          nullable: "[NULL]",
        },
      },
      metadata: {
        requestId: "req-1",
        secret: "[REDACTED]",
      },
    });
  });

  it("scrubs array payloads and serialises unsupported values", async () => {
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.create as jest.Mock).mockResolvedValue({ id: "audit-array" });

    const uniqueSymbol = Symbol("metadata");

    await recordAuditLog({
      action: "media.transform",
      entity: "media",
      entityId: "asset-array",
      after: {
        variants: [
          { token: "abc" },
          { nested: [undefined, { secret: "hidden" }] },
          "ready",
          undefined,
          uniqueSymbol,
        ] as unknown[],
      },
      metadata: {
        correlation: uniqueSymbol,
      },
    });

    const call = prismaMock.auditLog.create.mock.calls[0]?.[0] as
      | { data: { after?: Record<string, unknown> } }
      | undefined;
    expect(call).toBeDefined();
    const afterPayload = call!.data.after as Record<string, unknown>;
    expect(afterPayload.after).toBeDefined();
    expect(afterPayload.metadata).toBeDefined();
    expect((afterPayload.after as Record<string, unknown>).variants).toEqual([
      { token: "[REDACTED]" },
      { nested: ["[NULL]", { secret: "[REDACTED]" }] },
      "ready",
      "[NULL]",
      "Symbol(metadata)",
    ]);
    expect((afterPayload.metadata as Record<string, unknown>).correlation).toBe("Symbol(metadata)");
  });

  it("defaults actor type to SYSTEM when no user context is provided", async () => {
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.create as jest.Mock).mockResolvedValue({ id: "audit-2" });

    await recordAuditLog({
      action: "system.cleanup",
      entity: "system",
      entityId: "cleanup-1",
    });

    const call = prismaMock.auditLog.create.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(call).toBeDefined();
    const payload = call!.data as Record<string, unknown>;
    expect(payload.actorType).toBe("SYSTEM");
  });

  it("logs and rethrows persistence failures", async () => {
    const error = new Error("database failure");
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.create as jest.Mock).mockRejectedValue(error);

    await expect(
      recordAuditLog({
        action: "product.delete",
        entity: "product",
        entityId: "prod-2",
      }),
    ).rejects.toThrow(error);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to persist audit log entry",
      expect.objectContaining({
        error,
        entry: expect.objectContaining({
          action: "product.delete",
        }),
      }),
    );
  });

  it("queries audit logs with pagination and filters", async () => {
    const now = new Date("2024-01-01T00:00:00.000Z");

    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: "audit-3",
        action: "product.update",
        entity: "product",
        entityId: "prod-3",
        actorType: "ADMIN",
        userId: "admin-2",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        before: [],
        after: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.count as jest.Mock).mockResolvedValue(25);

    const result = await queryAuditLogs({
      page: 0,
      perPage: 200,
      actorType: "ADMIN",
      entity: "product",
      userId: "admin-2",
    });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        actorType: "ADMIN",
        entity: "product",
        userId: "admin-2",
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 100,
    });
    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({
      where: {
        actorType: "ADMIN",
        entity: "product",
        userId: "admin-2",
      },
    });
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 100,
      totalItems: 25,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(result.data).toHaveLength(1);
  });

  it("normalises pagination boundaries before querying audit logs", async () => {
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.findMany as jest.Mock).mockResolvedValue([]);
    // @ts-expect-error -- jest mock test double
    (prismaMock.auditLog.count as jest.Mock).mockResolvedValue(0);

    const result = await queryAuditLogs({
      entity: "media",
      page: 5.75,
      perPage: 0,
    });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        entity: "media",
      },
      orderBy: { createdAt: "desc" },
      skip: 80,
      take: 20,
    });
    expect(result.pagination.page).toBe(5);
    expect(result.pagination.pageSize).toBe(20);
    expect(result.pagination.hasPreviousPage).toBe(true);
  });
});
