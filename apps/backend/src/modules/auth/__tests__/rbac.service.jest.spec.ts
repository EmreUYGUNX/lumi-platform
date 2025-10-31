import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";

import { RbacService, type RbacServiceOptions } from "../rbac.service.js";

type PermissionCacheContract = NonNullable<RbacServiceOptions["cache"]>;

interface CacheSpy {
  get: jest.MockedFunction<PermissionCacheContract["get"]>;
  set: jest.MockedFunction<PermissionCacheContract["set"]>;
  delete: jest.MockedFunction<PermissionCacheContract["delete"]>;
  shutdown: jest.MockedFunction<PermissionCacheContract["shutdown"]>;
}

interface MockStores {
  users: Map<string, { id: string; email: string; status: "ACTIVE" | "SUSPENDED" }>;
  roles: Map<string, { id: string; name: string }>;
  permissions: Map<string, { id: string; key: string }>;
  userRoles: Set<string>;
  userPermissions: Set<string>;
  rolePermissions: Set<string>;
}

const buildCompoundKey = (...parts: string[]): string => parts.join("::");

const applySelect = <TRecord extends Record<string, unknown>>(
  record: TRecord,
  select: Record<string, boolean> | undefined,
): Partial<TRecord> => {
  if (!select) {
    return { ...record };
  }

  const projected: Partial<TRecord> = {};
  Object.entries(select).forEach(([key, value]) => {
    if (value && key in record) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (projected as Record<string, unknown>)[key] = record[key];
    }
  });
  return projected;
};

const createMockCache = (): CacheSpy & PermissionCacheContract => {
  const store = new Map<string, string[]>();

  const cache: PermissionCacheContract & CacheSpy = {
    get: jest.fn(async (userId: string) => {
      const entry = store.get(userId);
      return entry ? [...entry] : undefined;
    }),
    set: jest.fn(async (userId: string, permissions: string[]) => {
      store.set(userId, [...permissions]);
    }),
    delete: jest.fn(async (userId: string) => {
      store.delete(userId);
    }),
    shutdown: jest.fn(async () => {
      store.clear();
    }),
  };

  return cache;
};

const createMockStores = (): MockStores => {
  const users = new Map<string, { id: string; email: string; status: "ACTIVE" | "SUSPENDED" }>();
  const roles = new Map<string, { id: string; name: string }>();
  const permissions = new Map<string, { id: string; key: string }>();
  const userRoles = new Set<string>();
  const userPermissions = new Set<string>();
  const rolePermissions = new Set<string>();

  users.set("user_admin", {
    id: "user_admin",
    email: "admin@example.com",
    status: "ACTIVE",
  });

  roles.set("role_admin", { id: "role_admin", name: "admin" });
  roles.set("role_staff", { id: "role_staff", name: "staff" });

  permissions.set("perm_report_read", { id: "perm_report_read", key: "report:read" });
  permissions.set("perm_catalog_all", { id: "perm_catalog_all", key: "catalog:*" });
  permissions.set("perm_custom_manage", { id: "perm_custom_manage", key: "custom:manage" });

  userRoles.add(buildCompoundKey("user_admin", "role_admin"));
  rolePermissions.add(buildCompoundKey("role_admin", "perm_report_read"));
  rolePermissions.add(buildCompoundKey("role_admin", "perm_catalog_all"));
  userPermissions.add(buildCompoundKey("user_admin", "perm_custom_manage"));

  return { users, roles, permissions, userRoles, userPermissions, rolePermissions };
};

const createPrismaMock = (stores: MockStores): PrismaClient => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const record = stores.users.get(where.id);
        return record ? { ...record } : undefined;
      }),
    },
    role: {
      findMany: jest.fn(
        async (args?: {
          where?: { userRoles?: { some?: { userId?: string } } };
          select?: Record<string, boolean>;
          orderBy?: { name: "asc" | "desc" };
        }) => {
          const results: Record<string, unknown>[] = [];

          stores.roles.forEach((role) => {
            const userId = args?.where?.userRoles?.some?.userId;
            if (userId) {
              const key = buildCompoundKey(userId, role.id);
              if (!stores.userRoles.has(key)) {
                return;
              }
            }

            results.push(applySelect(role, args?.select));
          });

          if (args?.orderBy?.name === "asc") {
            results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
          }

          return results;
        },
      ),
    },
    permission: {
      findMany: jest.fn(
        async (args?: {
          where?: {
            userPermissions?: { some?: { userId?: string } };
            rolePermissions?: { some?: { roleId?: { in?: string[] } } };
          };
          select?: Record<string, boolean>;
        }) => {
          const results: Record<string, unknown>[] = [];

          stores.permissions.forEach((permission) => {
            const userId = args?.where?.userPermissions?.some?.userId;
            if (userId) {
              const key = buildCompoundKey(userId, permission.id);
              if (!stores.userPermissions.has(key)) {
                return;
              }
            }

            const roleIdList = args?.where?.rolePermissions?.some?.roleId?.in;
            if (Array.isArray(roleIdList) && roleIdList.length > 0) {
              const matchesRole = roleIdList.some((roleId) =>
                stores.rolePermissions.has(buildCompoundKey(roleId, permission.id)),
              );
              if (!matchesRole) {
                return;
              }
            }

            results.push(applySelect(permission, args?.select));
          });

          return results;
        },
      ),
    },
    userRole: {
      upsert: jest.fn(
        async ({
          where,
          create,
        }: {
          where: { userId_roleId: { userId: string; roleId: string } };
          create: { userId: string; roleId: string };
        }) => {
          const key = buildCompoundKey(where.userId_roleId.userId, where.userId_roleId.roleId);
          stores.userRoles.add(key);
          return {
            userId: create.userId,
            roleId: create.roleId,
            assignedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      ),
      delete: jest.fn(
        async ({ where }: { where: { userId_roleId: { userId: string; roleId: string } } }) => {
          const key = buildCompoundKey(where.userId_roleId.userId, where.userId_roleId.roleId);
          if (!stores.userRoles.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError("Not found", {
              code: "P2025",
              clientVersion: "stub",
            });
          }

          stores.userRoles.delete(key);
          return {
            userId: where.userId_roleId.userId,
            roleId: where.userId_roleId.roleId,
          };
        },
      ),
    },
    userPermission: {
      upsert: jest.fn(
        async ({
          where,
          create,
        }: {
          where: { userId_permissionId: { userId: string; permissionId: string } };
          create: { userId: string; permissionId: string };
        }) => {
          const key = buildCompoundKey(
            where.userId_permissionId.userId,
            where.userId_permissionId.permissionId,
          );
          stores.userPermissions.add(key);
          return {
            userId: create.userId,
            permissionId: create.permissionId,
            assignedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      ),
      delete: jest.fn(
        async ({
          where,
        }: {
          where: { userId_permissionId: { userId: string; permissionId: string } };
        }) => {
          const key = buildCompoundKey(
            where.userId_permissionId.userId,
            where.userId_permissionId.permissionId,
          );
          if (!stores.userPermissions.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError("Not found", {
              code: "P2025",
              clientVersion: "stub",
            });
          }

          stores.userPermissions.delete(key);
          return {
            userId: where.userId_permissionId.userId,
            permissionId: where.userId_permissionId.permissionId,
          };
        },
      ),
    },
  } satisfies Partial<Record<keyof PrismaClient, unknown>>;

  return prismaMock as unknown as PrismaClient;
};

describe("RbacService", () => {
  let stores: MockStores;
  let prisma: PrismaClient;
  let cache: CacheSpy & PermissionCacheContract;
  let service: RbacService;

  beforeEach(() => {
    stores = createMockStores();
    prisma = createPrismaMock(stores);
    cache = createMockCache();

    service = new RbacService({
      prisma,
      cache,
      logger: createChildLogger("test:rbac-service"),
    } as RbacServiceOptions);
  });

  it("returns all roles assigned to the user", async () => {
    const roles = await service.getUserRoles("user_admin");

    expect(roles).toEqual([
      {
        id: "role_admin",
        name: "admin",
      },
    ]);
  });

  it("aggregates direct and role-based permissions and caches the result", async () => {
    const permissionsFirstCall = await service.getUserPermissions("user_admin");
    const permissionsSecondCall = await service.getUserPermissions("user_admin");

    expect(new Set(permissionsFirstCall)).toEqual(
      new Set(["report:read", "catalog:*", "custom:manage"]),
    );
    expect(permissionsSecondCall).toEqual(permissionsFirstCall);

    // First call triggers two Prisma lookups (direct + role permissions). Cached call should not.
    expect(prisma.permission.findMany).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledTimes(2);
  });

  it("returns cached permissions without querying the data store", async () => {
    cache.get.mockResolvedValueOnce(["cached:permission"]);

    const permissions = await service.getUserPermissions("user_admin");

    expect(permissions).toEqual(["cached:permission"]);
    expect(prisma.permission.findMany).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("checks role membership in a case-insensitive manner", async () => {
    const hasAdmin = await service.hasRole("user_admin", ["ADMIN"]);
    const hasStaff = await service.hasRole("user_admin", ["staff"]);

    expect(hasAdmin).toBe(true);
    expect(hasStaff).toBe(false);
  });

  it("supports wildcard permission checks", async () => {
    const canPublishCatalog = await service.hasPermission("user_admin", "catalog:publish");
    const canManageOrders = await service.hasPermission("user_admin", "orders:manage");

    expect(canPublishCatalog).toBe(true);
    expect(canManageOrders).toBe(false);
  });

  it("honours trailing wildcard permissions for nested resources", async () => {
    const canRestockInventory = await service.hasPermission(
      "user_admin",
      "catalog:inventory:restock",
    );

    expect(canRestockInventory).toBe(true);
  });

  it("assigns a new role and invalidates cached permissions", async () => {
    stores.roles.set("role_support", { id: "role_support", name: "support" });
    await service.assignRole("user_admin", "role_support");

    expect(prisma.userRole.upsert).toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith("user_admin");
  });

  it("grants direct permissions and invalidates cache", async () => {
    stores.permissions.set("perm_order_manage", { id: "perm_order_manage", key: "order:manage" });

    await service.grantPermission("user_admin", "perm_order_manage");

    expect(prisma.userPermission.upsert).toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith("user_admin");
  });

  it("silently handles revoking non-existent roles", async () => {
    await expect(service.revokeRole("user_admin", "role_support")).resolves.not.toThrow();
  });

  it("revokes existing permissions and invalidates cache", async () => {
    await service.revokePermission("user_admin", "perm_custom_manage");

    expect(prisma.userPermission.delete).toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith("user_admin");
  });

  it("throws a NotFoundError when the target user does not exist", async () => {
    await expect(service.getUserRoles("unknown_user")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("supports leading wildcard permissions for diverse resources", async () => {
    stores.users.set("user_wildcard", {
      id: "user_wildcard",
      email: "wildcard@example.com",
      status: "ACTIVE",
    });
    stores.permissions.set("perm_star_manage", { id: "perm_star_manage", key: "*:manage" });
    stores.userPermissions.add(buildCompoundKey("user_wildcard", "perm_star_manage"));

    const canManageOrders = await service.hasPermission("user_wildcard", "orders:manage");
    const canManageReports = await service.hasPermission("user_wildcard", "reports:manage");

    expect(canManageOrders).toBe(true);
    expect(canManageReports).toBe(true);
  });

  it("grants universal access when the global wildcard permission is assigned", async () => {
    stores.permissions.set("perm_global", { id: "perm_global", key: "*" });
    stores.userPermissions.add(buildCompoundKey("user_admin", "perm_global"));

    const canPerformAnyAction = await service.hasPermission("user_admin", "any:thing:here");

    expect(canPerformAnyAction).toBe(true);
  });

  it("rejects access when required scope exceeds granted scope without wildcard", async () => {
    stores.users.set("user_scoped", {
      id: "user_scoped",
      email: "scoped@example.com",
      status: "ACTIVE",
    });
    stores.permissions.set("perm_catalog_manage_scoped", {
      id: "perm_catalog_manage_scoped",
      key: "catalog:manage",
    });
    stores.userPermissions.add(buildCompoundKey("user_scoped", "perm_catalog_manage_scoped"));

    const canManageAll = await service.hasPermission("user_scoped", "catalog:manage:all");

    expect(canManageAll).toBe(false);
  });

  it("returns empty roles when no assignments exist", async () => {
    stores.users.set("user_guest", {
      id: "user_guest",
      email: "guest@example.com",
      status: "ACTIVE",
    });

    const roles = await service.getUserRoles("user_guest");

    expect(roles).toEqual([]);
  });

  it("treats empty role requirements as authorized", async () => {
    const allowed = await service.hasRole("user_admin", []);

    expect(allowed).toBe(true);
  });

  it("treats empty permission requirements as authorized", async () => {
    const allowed = await service.hasPermission("user_admin", []);

    expect(allowed).toBe(true);
  });

  it("explicitly invalidates cached permissions for a user", async () => {
    await service.invalidateUserPermissions("user_admin");

    expect(cache.delete).toHaveBeenCalledWith("user_admin");
  });
});

describe("permission cache integration", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("falls back to in-memory caching when Redis configuration is missing", async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: "user_cache",
          email: "cache@example.com",
          status: "ACTIVE",
        })),
      },
      role: {
        findMany: jest.fn(async () => []),
      },
      permission: {
        findMany: jest.fn(async () => []),
      },
    } as unknown as PrismaClient;

    const loggerWarn = jest.fn();

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/config/index.js", () => ({
        __esModule: true,
        getConfig: jest.fn(() => ({
          cache: { redisUrl: undefined },
        })),
      }));

      jest.doMock("@/lib/prisma.js", () => ({
        __esModule: true,
        getPrismaClient: jest.fn(() => mockPrisma),
      }));

      jest.doMock("@/lib/logger.js", () => ({
        __esModule: true,
        createChildLogger: jest.fn(() => ({
          warn: loggerWarn,
          error: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
        })),
        logger: {
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          log: jest.fn(),
        },
        mergeRequestContext: jest.fn(),
        withRequestContext: jest.fn((_context, callback: () => unknown) => callback()),
        registerLogTransport: jest.fn(),
        unregisterLogTransport: jest.fn(),
        listRegisteredTransports: jest.fn(() => []),
        logError: jest.fn(),
      }));

      const { createRbacService } = await import("../rbac.service.js");
      const fallbackService = createRbacService();

      await expect(fallbackService.getUserPermissions("user_cache")).resolves.toEqual([]);
      await expect(fallbackService.getUserPermissions("user_cache")).resolves.toEqual([]);

      expect(mockPrisma.permission.findMany).toHaveBeenCalledTimes(1);
      expect(loggerWarn).toHaveBeenCalledWith(
        "Redis URL not configured. Using in-memory RBAC permission cache.",
      );
    });
  });

  it("surfaces cache operation failures after exhausting retries", async () => {
    const failingOperation: jest.MockedFunction<() => Promise<never>> = jest.fn();
    failingOperation
      .mockRejectedValueOnce(new Error("redis down"))
      .mockRejectedValueOnce(new Error("redis still down"))
      .mockRejectedValueOnce(new Error("redis permanently down"));

    await jest.isolateModulesAsync(async () => {
      jest.doMock("redis", () => ({
        __esModule: true,
        createClient: jest.fn(() => ({
          isOpen: false,
          connect: jest.fn(async () => {
            /* noop */
          }),
          quit: jest.fn(async () => {
            /* noop */
          }),
          get: failingOperation,
          set: failingOperation,
          del: failingOperation,
          on: jest.fn(),
        })),
      }));

      const mockPrisma = {
        user: {
          findUnique: jest.fn(async () => ({
            id: "user_error",
            email: "error@example.com",
            status: "ACTIVE",
          })),
        },
        role: {
          findMany: jest.fn(async () => []),
        },
        permission: {
          findMany: jest.fn(async () => []),
        },
      } as unknown as PrismaClient;

      jest.doMock("@/config/index.js", () => ({
        __esModule: true,
        getConfig: jest.fn(() => ({
          cache: { redisUrl: "redis://localhost:6379/1" },
        })),
      }));

      jest.doMock("@/lib/prisma.js", () => ({
        __esModule: true,
        getPrismaClient: jest.fn(() => mockPrisma),
      }));

      jest.doMock("@/lib/logger.js", () => ({
        __esModule: true,
        createChildLogger: jest.fn(() => ({
          warn: jest.fn(),
          error: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
        })),
        logger: {
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          log: jest.fn(),
        },
        mergeRequestContext: jest.fn(),
        withRequestContext: jest.fn((_context, callback: () => unknown) => callback()),
        registerLogTransport: jest.fn(),
        unregisterLogTransport: jest.fn(),
        listRegisteredTransports: jest.fn(() => []),
        logError: jest.fn(),
      }));

      const { createRbacService } = await import("../rbac.service.js");
      const redisBackedService = createRbacService();

      await expect(redisBackedService.invalidateUserPermissions("user_error")).rejects.toThrow(
        "redis permanently down",
      );

      expect(failingOperation).toHaveBeenCalledTimes(3);
    });
  });
});
