import { setTimeout as delay } from "node:timers/promises";

import type { Permission, PrismaClient, Role, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createClient } from "redis";

import { getConfig } from "@/config/index.js";
import { NotFoundError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

import type { AuthenticatedRole } from "./token.types.js";

interface PermissionCache {
  get(userId: string): Promise<string[] | undefined>;
  set(userId: string, permissions: string[]): Promise<void>;
  delete(userId: string): Promise<void>;
  shutdown(): Promise<void>;
}

const PERMISSION_CACHE_KEY_PREFIX = "auth:rbac:permissions";
const PERMISSION_CACHE_TTL_SECONDS = 5 * 60;
const REDIS_OPERATION_RETRY_DELAY_MS = 250;
const REDIS_OPERATION_MAX_RETRIES = 3;

const buildCacheKey = (userId: string): string => `${PERMISSION_CACHE_KEY_PREFIX}:${userId}`;

const isPrismaNotFound = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

const executeWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < REDIS_OPERATION_MAX_RETRIES) {
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential retries required
      return await operation();
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-await-in-loop -- backoff between retries
      await delay(REDIS_OPERATION_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Permission cache operation failed");
};

const serialisePermissions = (permissions: readonly string[]): string =>
  JSON.stringify({ permissions, cachedAt: Date.now() });

const deserialisePermissions = (
  payload: string | null,
  logger: ReturnType<typeof createChildLogger>,
): string[] | undefined => {
  let permissions: string[] | undefined;

  if (!payload) {
    return permissions;
  }

  try {
    const parsed = JSON.parse(payload) as { permissions?: unknown };
    if (
      Array.isArray(parsed.permissions) &&
      parsed.permissions.every((item) => typeof item === "string")
    ) {
      permissions = parsed.permissions as string[];
    }
  } catch (error) {
    logger.warn("Failed to parse cached RBAC permissions", { error });
  }

  return permissions;
};

const createRedisPermissionCache = (
  client: ReturnType<typeof createClient>,
  logger = createChildLogger("auth:rbac:cache:redis"),
): PermissionCache => {
  let connected = false;

  const ensureConnected = async () => {
    if (connected || client.isOpen) {
      connected = true;
    }

    await client.connect();
    connected = true;
  };

  return {
    async get(userId): Promise<string[] | undefined> {
      await ensureConnected();
      const key = buildCacheKey(userId);
      const payload = await executeWithRetry(() => client.get(key));
      return deserialisePermissions(payload, logger);
    },
    async set(userId, permissions) {
      await ensureConnected();
      const key = buildCacheKey(userId);
      const payload = serialisePermissions(permissions);
      await executeWithRetry(() =>
        client.set(key, payload, {
          EX: PERMISSION_CACHE_TTL_SECONDS,
        }),
      );
    },
    async delete(userId) {
      await ensureConnected();
      const key = buildCacheKey(userId);
      await executeWithRetry(() => client.del(key));
    },
    async shutdown() {
      if (!connected || !client.isOpen) {
        return;
      }

      try {
        await client.quit();
      } catch (error) {
        logger.warn("Failed to close Redis RBAC permission cache client cleanly", { error });
      } finally {
        connected = false;
      }
    },
  };
};

const createInMemoryPermissionCache = (): PermissionCache => {
  const store = new Map<string, { permissions: string[]; expiresAt: number }>();

  const cleanupExpired = () => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    });
  };

  return {
    async get(userId): Promise<string[] | undefined> {
      cleanupExpired();
      const entry = store.get(userId);
      return entry ? [...entry.permissions] : undefined;
    },
    async set(userId, permissions) {
      const expiresAt = Date.now() + PERMISSION_CACHE_TTL_SECONDS * 1000;
      store.set(userId, {
        permissions: [...permissions],
        expiresAt,
      });
    },
    async delete(userId) {
      store.delete(userId);
    },
    async shutdown() {
      store.clear();
    },
  };
};

const createPermissionCache = (): PermissionCache => {
  const logger = createChildLogger("auth:rbac:cache");

  try {
    const { cache } = getConfig();
    const { redisUrl } = cache;
    if (!redisUrl) {
      logger.warn("Redis URL not configured. Using in-memory RBAC permission cache.");
      return createInMemoryPermissionCache();
    }

    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      logger.error("Redis RBAC permission cache client error", { error });
    });

    return createRedisPermissionCache(client, logger);
  } catch (error) {
    logger.error(
      "Failed to initialise Redis RBAC permission cache. Falling back to memory store.",
      {
        error,
      },
    );
    return createInMemoryPermissionCache();
  }
};

const normaliseRoles = (roles: readonly Pick<Role, "id" | "name">[]): AuthenticatedRole[] =>
  roles.map((role) => ({ id: role.id, name: role.name }));

const mergePermissions = (
  directPermissions: readonly Pick<Permission, "key">[],
  rolePermissions: readonly Pick<Permission, "key">[],
): string[] => {
  const combined = new Set<string>();

  [...directPermissions, ...rolePermissions].forEach((permission) => {
    if (permission.key) {
      combined.add(permission.key);
    }
  });

  return [...combined];
};

const wildcardToRegex = (pattern: string): RegExp => {
  const specialCharacters = new Set([
    "\\",
    "^",
    "$",
    ".",
    "*",
    "+",
    "?",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "|",
  ]);
  const escaped = [...pattern]
    .map((character) => (specialCharacters.has(character) ? `\\${character}` : character))
    .join("");

  const wildcardPattern = escaped.split("\\*").join(".*");
  // Pattern is sanitised above before compilation.
  // eslint-disable-next-line security/detect-non-literal-regexp -- Sanitised wildcard conversion
  return new RegExp(`^${wildcardPattern}$`);
};

const permissionMatches = (granted: string, required: string): boolean => {
  if (granted === "*") {
    return true;
  }

  if (granted === required) {
    return true;
  }

  return wildcardToRegex(granted).test(required);
};

interface AccessProfile {
  user: Pick<User, "id" | "email" | "status">;
  roles: AuthenticatedRole[];
  permissions: string[];
}

export interface RbacServiceOptions {
  prisma?: PrismaClient;
  cache?: PermissionCache;
  logger?: ReturnType<typeof createChildLogger>;
}

export class RbacService {
  private readonly prisma: PrismaClient;

  private readonly cache: PermissionCache;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: RbacServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.cache = options.cache ?? createPermissionCache();
    this.logger = options.logger ?? createChildLogger("auth:rbac:service");
  }

  private async ensureUser(userId: string): Promise<Pick<User, "id" | "email" | "status">> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User could not be located for RBAC evaluation.", {
        details: { userId },
      });
    }

    return user;
  }

  private async loadAccessProfile(userId: string): Promise<AccessProfile> {
    const user = await this.ensureUser(userId);

    const roles = await this.prisma.role.findMany({
      where: { userRoles: { some: { userId } } },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    const cachedPermissions = await this.cache.get(userId);
    if (cachedPermissions) {
      return {
        user,
        roles: normaliseRoles(roles),
        permissions: cachedPermissions,
      };
    }

    const directPermissionsPromise = this.prisma.permission.findMany({
      where: { userPermissions: { some: { userId } } },
      select: {
        id: true,
        key: true,
      },
    });

    const roleIds = roles.map((role) => role.id);

    const rolePermissionsPromise =
      roleIds.length > 0
        ? this.prisma.permission.findMany({
            where: {
              rolePermissions: {
                some: {
                  roleId: { in: roleIds },
                },
              },
            },
            select: {
              id: true,
              key: true,
            },
          })
        : Promise.resolve<Pick<Permission, "key">[]>([]);

    const [directPermissions, rolePermissions] = await Promise.all([
      directPermissionsPromise,
      rolePermissionsPromise,
    ]);

    const permissions = mergePermissions(directPermissions, rolePermissions);
    await this.cache.set(userId, permissions);

    return {
      user,
      roles: normaliseRoles(roles),
      permissions,
    };
  }

  async getUserRoles(userId: string): Promise<AuthenticatedRole[]> {
    const profile = await this.loadAccessProfile(userId);
    return profile.roles;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const profile = await this.loadAccessProfile(userId);
    return profile.permissions;
  }

  async hasRole(userId: string, roles: string | string[]): Promise<boolean> {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    if (requiredRoles.length === 0) {
      return true;
    }

    const profile = await this.loadAccessProfile(userId);
    const requiredRoleSet = new Set(requiredRoles.map((role) => role.toLowerCase()));

    return profile.roles.some((role) => requiredRoleSet.has(role.name.toLowerCase()));
  }

  async hasPermission(userId: string, permission: string | string[]): Promise<boolean> {
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    if (requiredPermissions.length === 0) {
      return true;
    }

    const profile = await this.loadAccessProfile(userId);

    return requiredPermissions.every((required) =>
      profile.permissions.some((granted) => permissionMatches(granted, required)),
    );
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
      },
    });

    await this.cache.delete(userId);

    this.logger.info("Assigned role to user", { userId, roleId });
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    try {
      await this.prisma.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
      });
    } catch (error) {
      if (!isPrismaNotFound(error)) {
        throw error;
      }

      this.logger.debug("Attempted to revoke non-existent role assignment", { userId, roleId });
      return;
    }

    await this.cache.delete(userId);

    this.logger.info("Revoked role from user", { userId, roleId });
  }

  async grantPermission(userId: string, permissionId: string): Promise<void> {
    await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
      update: {},
      create: {
        userId,
        permissionId,
      },
    });

    await this.cache.delete(userId);

    this.logger.info("Granted user permission", { userId, permissionId });
  }

  async revokePermission(userId: string, permissionId: string): Promise<void> {
    try {
      await this.prisma.userPermission.delete({
        where: {
          userId_permissionId: {
            userId,
            permissionId,
          },
        },
      });
    } catch (error) {
      if (!isPrismaNotFound(error)) {
        throw error;
      }

      this.logger.debug("Attempted to revoke non-existent user permission", {
        userId,
        permissionId,
      });
      return;
    }

    await this.cache.delete(userId);

    this.logger.info("Revoked user permission", { userId, permissionId });
  }

  async invalidateUserPermissions(userId: string): Promise<void> {
    await this.cache.delete(userId);
  }

  async shutdown(): Promise<void> {
    await this.cache.shutdown();
  }
}

export const createRbacService = (options: RbacServiceOptions = {}): RbacService =>
  new RbacService(options);

let sharedInstance: RbacService | undefined;

export const getSharedRbacService = (): RbacService => {
  if (!sharedInstance) {
    sharedInstance = createRbacService();
  }

  return sharedInstance;
};
