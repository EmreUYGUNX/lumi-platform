/* eslint-disable import/no-useless-path-segments, sonarjs/cognitive-complexity, unicorn/no-null, unicorn/consistent-function-scoping, unicorn/no-useless-undefined, @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any, unicorn/prefer-spread, @typescript-eslint/array-type, unicorn/prefer-native-coercion-functions, prefer-destructuring */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { beforeEach, describe, expect, it } from "@jest/globals";
import type {
  EmailVerificationToken,
  PasswordResetToken,
  Prisma,
  PrismaClient,
  Role,
  SecurityEvent,
  User,
  UserSession,
} from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";
import { createChildLogger } from "@/lib/logger.js";
import { createTestConfig } from "@/testing/config.js";
import type { DeepPartial } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import type { BruteForceProtectionService } from "../../auth/brute-force.service.js";
import type { AuthRequestContext, AuthUserProfile } from "../auth.service.js";
import { AuthService } from "../auth.service.js";
import type { RbacService } from "../rbac.service.js";
import type { SecurityEventService } from "../security-event.service.js";
import { SessionService } from "../session.service.js";
import type { SessionDeviceMetadata } from "../session.service.js";
import type { TokenBlacklist } from "../token.blacklist.js";
import { TokenService } from "../token.service.js";
import type { TokenPair } from "../token.types.js";

type SelectShape<T> = {
  [K in keyof T]?: boolean;
};

interface PrismaStore {
  users: Map<string, User>;
  roles: Map<string, Role>;
  userRoles: Map<string, Set<string>>;
  userPermissions: Map<string, Set<string>>;
  rolePermissions: Map<string, Set<string>>;
  sessions: Map<string, UserSession>;
  emailTokens: Map<string, EmailVerificationToken>;
  passwordTokens: Map<string, PasswordResetToken>;
  securityEvents: SecurityEvent[];
}

const clone = <T>(value: T): T => structuredClone(value);

const applySelect = <T extends Record<string, unknown>>(
  record: T,
  select?: SelectShape<T>,
): Partial<T> => {
  if (!select) {
    return clone(record);
  }

  const projected: Partial<T> = {};
  Object.entries(select).forEach(([key, enabled]) => {
    if (enabled) {
      projected[key as keyof T] = clone(record[key as keyof T]);
    }
  });
  return projected;
};

const matchesWhere = <T extends Record<string, unknown>>(
  record: T,
  where?: Record<string, unknown>,
): boolean => {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, condition]) => {
    if (key === "NOT" && condition && typeof condition === "object") {
      return !matchesWhere(record, condition as Record<string, unknown>);
    }

    const value = record[key];

    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const typedCondition = condition as Record<string, unknown>;

      if ("equals" in typedCondition) {
        return value === typedCondition.equals;
      }

      if ("lt" in typedCondition && value instanceof Date && typedCondition.lt instanceof Date) {
        return value.getTime() < typedCondition.lt.getTime();
      }

      if ("lte" in typedCondition && value instanceof Date && typedCondition.lte instanceof Date) {
        return value.getTime() <= typedCondition.lte.getTime();
      }

      if ("in" in typedCondition && Array.isArray(typedCondition.in)) {
        return typedCondition.in.includes(value);
      }

      return matchesWhere(value as Record<string, unknown>, typedCondition);
    }

    return value === condition;
  });
};

interface InMemoryPrismaOptions {
  now: () => Date;
}

const createRole = (name: string, overrides: Partial<Role> = {}): Role => ({
  id: overrides.id ?? randomUUID(),
  name,
  description: overrides.description ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

const createUserRecord = (now: () => Date, data: Partial<User>): User => ({
  id: data.id ?? randomUUID(),
  email: data.email ?? "user@example.com",
  passwordHash: data.passwordHash ?? "hash",
  firstName: data.firstName ?? null,
  lastName: data.lastName ?? null,
  phone: data.phone ?? null,
  emailVerified: data.emailVerified ?? false,
  emailVerifiedAt: data.emailVerifiedAt ?? null,
  failedLoginCount: data.failedLoginCount ?? 0,
  lockoutUntil: data.lockoutUntil ?? null,
  twoFactorSecret: data.twoFactorSecret ?? null,
  twoFactorEnabled: data.twoFactorEnabled ?? false,
  status: (data.status ?? "ACTIVE") as User["status"],
  createdAt: data.createdAt ?? now(),
  updatedAt: data.updatedAt ?? now(),
});

const createSessionRecord = (now: () => Date, data: Partial<UserSession>): UserSession => ({
  id: data.id ?? randomUUID(),
  userId: data.userId ?? randomUUID(),
  refreshTokenHash: data.refreshTokenHash ?? "",
  fingerprint: data.fingerprint ?? null,
  ipAddress: data.ipAddress ?? null,
  userAgent: data.userAgent ?? null,
  expiresAt: data.expiresAt ?? new Date(now().getTime() + 14 * 24 * 60 * 60 * 1000),
  revokedAt: data.revokedAt ?? null,
  createdAt: data.createdAt ?? now(),
  updatedAt: data.updatedAt ?? now(),
});

const createEmailTokenRecord = (
  now: () => Date,
  data: Partial<EmailVerificationToken>,
): EmailVerificationToken => ({
  id: data.id ?? randomUUID(),
  userId: data.userId ?? randomUUID(),
  tokenHash: data.tokenHash ?? "hash",
  expiresAt: data.expiresAt ?? new Date(now().getTime() + 24 * 60 * 60 * 1000),
  consumedAt: data.consumedAt ?? null,
  createdAt: data.createdAt ?? now(),
  updatedAt: data.updatedAt ?? now(),
});

const createPasswordTokenRecord = (
  now: () => Date,
  data: Partial<PasswordResetToken>,
): PasswordResetToken => ({
  id: data.id ?? randomUUID(),
  userId: data.userId ?? randomUUID(),
  tokenHash: data.tokenHash ?? "hash",
  expiresAt: data.expiresAt ?? new Date(now().getTime() + 60 * 60 * 1000),
  consumedAt: data.consumedAt ?? null,
  requestedIp: data.requestedIp ?? null,
  userAgent: data.userAgent ?? null,
  createdAt: data.createdAt ?? now(),
  updatedAt: data.updatedAt ?? now(),
});

const createInMemoryPrisma = (options: InMemoryPrismaOptions) => {
  const { now } = options;

  const store: PrismaStore = {
    users: new Map(),
    roles: new Map(),
    userRoles: new Map(),
    userPermissions: new Map(),
    rolePermissions: new Map(),
    sessions: new Map(),
    emailTokens: new Map(),
    passwordTokens: new Map(),
    securityEvents: [],
  };

  const defaultRole = createRole("customer");
  store.roles.set(defaultRole.name, defaultRole);
  store.rolePermissions.set(defaultRole.id, new Set(["catalog:read"]));

  const cloneValue = <T>(value: T): T => {
    if (value instanceof Date) {
      return new Date(value.getTime()) as T;
    }
    if (value && typeof value === "object") {
      return structuredClone(value) as T;
    }
    return value;
  };

  const resolveScalarUpdate = (current: unknown, update: unknown): unknown => {
    if (!update || typeof update !== "object" || update instanceof Date) {
      return update;
    }

    const candidate = update as Record<string, unknown>;
    if (typeof candidate.increment === "number") {
      const base = typeof current === "number" ? (current as number) : 0;
      return base + candidate.increment;
    }

    if (typeof candidate.decrement === "number") {
      const base = typeof current === "number" ? (current as number) : 0;
      return base - candidate.decrement;
    }

    if (Object.prototype.hasOwnProperty.call(candidate, "set")) {
      return candidate.set;
    }

    return update;
  };

  const applyRecordUpdate = <T extends { updatedAt: Date }>(
    record: T,
    data: Record<string, unknown>,
  ): T => {
    const next: Record<string, unknown> = { ...record };

    Object.entries(data ?? {}).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      const current = (record as Record<string, unknown>)[key];
      const resolved = resolveScalarUpdate(current, value);
      next[key] = cloneValue(resolved);
    });

    next.updatedAt = now();
    return next as T;
  };

  const applyUserUpdate = (record: User, data: Record<string, unknown>): User =>
    applyRecordUpdate(record, data);
  const applySessionUpdate = (record: UserSession, data: Record<string, unknown>): UserSession =>
    applyRecordUpdate(record, data);

  const prisma = {
    user: {
      findUnique: async (args: any) => {
        const { where, select } = args ?? {};
        if (!where) {
          return null;
        }
        let candidate: User | undefined;
        if (typeof where.id === "string") {
          candidate = store.users.get(where.id);
        } else if (typeof where.email === "string") {
          candidate = Array.from(store.users.values()).find((user) => user.email === where.email);
        }
        if (!candidate) {
          return null;
        }
        if (select) {
          return applySelect(candidate, select) as User;
        }
        return clone(candidate);
      },
      create: async (args: any) => {
        const { data } = args ?? {};
        const record = createUserRecord(now, data as Partial<User>);
        store.users.set(record.id, record);
        store.userRoles.set(record.id, new Set());
        return clone(record);
      },
      update: async (args: any) => {
        const { where, data } = args ?? {};
        if (!where?.id) {
          throw new Error("User update requires id");
        }
        const existing = store.users.get(where.id);
        if (!existing) {
          throw new Error("User not found");
        }
        const updated = applyUserUpdate(existing, (data ?? {}) as Record<string, unknown>);
        store.users.set(updated.id, updated);
        return clone(updated);
      },
    },
    role: {
      findUnique: async (args: any) => {
        const { where } = args ?? {};
        if (!where?.name) {
          return null;
        }
        return clone(store.roles.get(where.name) ?? null);
      },
    },
    userRole: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const set = store.userRoles.get(data.userId) ?? new Set();
        set.add(data.roleId);
        store.userRoles.set(data.userId, set);
        return clone({
          userId: data.userId,
          roleId: data.roleId,
          assignedAt: now(),
          createdAt: now(),
          updatedAt: now(),
        });
      },
    },
    userSession: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const record = createSessionRecord(now, data as Partial<UserSession>);
        store.sessions.set(record.id, record);
        return clone(record);
      },
      findUnique: async (args: any) => {
        const { where, select } = args ?? {};
        if (!where?.id) {
          return null;
        }
        const record = store.sessions.get(where.id);
        if (!record) {
          return null;
        }
        if (select) {
          return applySelect(record, select) as UserSession;
        }
        return clone(record);
      },
      findFirst: async (args: any) => {
        const { where, select } = args ?? {};
        const session = Array.from(store.sessions.values()).find((candidate) =>
          matchesWhere(candidate, where),
        );
        if (!session) {
          return null;
        }
        if (select) {
          return applySelect(session, select) as UserSession;
        }
        return clone(session);
      },
      findMany: async (args: any) => {
        const { where, select } = args ?? {};
        const matches = Array.from(store.sessions.values()).filter((candidate) =>
          matchesWhere(candidate, where),
        );
        if (select) {
          return matches.map((entry) => applySelect(entry, select));
        }
        return matches.map((entry) => clone(entry));
      },
      update: async (args: any) => {
        const { where, data } = args ?? {};
        if (!where?.id) {
          throw new Error("Session update requires id");
        }
        const existing = store.sessions.get(where.id);
        if (!existing) {
          throw new Error("Session not found");
        }
        const updated = applySessionUpdate(existing, (data ?? {}) as Record<string, unknown>);
        store.sessions.set(updated.id, updated);
        return clone(updated);
      },
      updateMany: async (args: any) => {
        const { where, data } = args ?? {};
        let count = 0;
        store.sessions.forEach((session, sessionId) => {
          if (matchesWhere(session, where)) {
            const updated = applySessionUpdate(session, (data ?? {}) as Record<string, unknown>);
            store.sessions.set(sessionId, updated);
            count += 1;
          }
        });
        return { count };
      },
    },
    emailVerificationToken: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const record = createEmailTokenRecord(now, data as Partial<EmailVerificationToken>);
        store.emailTokens.set(record.id, record);
        return clone(record);
      },
      findUnique: async (args: any) => {
        const { where, include } = args ?? {};
        if (!where?.id) {
          return null;
        }
        const record = store.emailTokens.get(where.id);
        if (!record) {
          return null;
        }
        if (include?.user) {
          const user = store.users.get(record.userId);
          if (!user) {
            return null;
          }
          return {
            ...clone(record),
            user: clone(user),
          };
        }
        return clone(record);
      },
      update: async (args: any) => {
        const { where, data } = args ?? {};
        if (!where?.id) {
          throw new Error("Email token update requires id");
        }
        const existing = store.emailTokens.get(where.id);
        if (!existing) {
          throw new Error("Email token not found");
        }
        const updated: EmailVerificationToken = {
          ...existing,
          ...((data ?? {}) as Partial<EmailVerificationToken>),
          updatedAt: now(),
        };
        store.emailTokens.set(updated.id, updated);
        return clone(updated);
      },
      updateMany: async (args: any) => {
        const { where, data } = args ?? {};
        let count = 0;
        store.emailTokens.forEach((token, tokenId) => {
          if (matchesWhere(token, where)) {
            const updated: EmailVerificationToken = {
              ...token,
              ...((data ?? {}) as Partial<EmailVerificationToken>),
              updatedAt: now(),
            };
            store.emailTokens.set(tokenId, updated);
            count += 1;
          }
        });
        return { count };
      },
      findMany: async (args: any) => {
        const { where } = args ?? {};
        const matches = Array.from(store.emailTokens.values()).filter((candidate) =>
          matchesWhere(candidate, where),
        );
        return matches.map((entry) => clone(entry));
      },
    },
    passwordResetToken: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const record = createPasswordTokenRecord(now, data as Partial<PasswordResetToken>);
        store.passwordTokens.set(record.id, record);
        return clone(record);
      },
      findUnique: async (args: any) => {
        const { where, include } = args ?? {};
        if (!where?.id) {
          return null;
        }
        const record = store.passwordTokens.get(where.id);
        if (!record) {
          return null;
        }
        if (include?.user) {
          const user = store.users.get(record.userId);
          if (!user) {
            return null;
          }
          return {
            ...clone(record),
            user: clone(user),
          };
        }
        return clone(record);
      },
      update: async (args: any) => {
        const { where, data } = args ?? {};
        if (!where?.id) {
          throw new Error("Password token update requires id");
        }
        const existing = store.passwordTokens.get(where.id);
        if (!existing) {
          throw new Error("Password token not found");
        }
        const updated: PasswordResetToken = {
          ...existing,
          ...((data ?? {}) as Partial<PasswordResetToken>),
          updatedAt: now(),
        };
        store.passwordTokens.set(updated.id, updated);
        return clone(updated);
      },
      updateMany: async (args: any) => {
        const { where, data } = args ?? {};
        let count = 0;
        store.passwordTokens.forEach((token, tokenId) => {
          if (matchesWhere(token, where)) {
            const updated: PasswordResetToken = {
              ...token,
              ...((data ?? {}) as Partial<PasswordResetToken>),
              updatedAt: now(),
            };
            store.passwordTokens.set(tokenId, updated);
            count += 1;
          }
        });
        return { count };
      },
      findFirst: async (args: any) => {
        const { where } = args ?? {};
        const record = Array.from(store.passwordTokens.values()).find((candidate) =>
          matchesWhere(candidate, where),
        );
        return record ? clone(record) : null;
      },
    },
    securityEvent: {
      create: async (args: any) => {
        const { data } = args ?? {};
        const event: SecurityEvent = {
          id: randomUUID(),
          type: data.type as string,
          userId: (data.userId as string | undefined) ?? null,
          ipAddress: (data.ipAddress as string | undefined) ?? null,
          userAgent: (data.userAgent as string | undefined) ?? null,
          payload: (data.payload as Prisma.JsonObject | undefined) ?? {},
          createdAt: now(),
          updatedAt: now(),
        };
        store.securityEvents.push(event);
        return clone(event);
      },
    },
    $transaction: async (...args: unknown[]) => {
      const [first] = args;
      if (typeof first === "function") {
        return (first as (tx: Prisma.TransactionClient) => Promise<unknown>)(
          prisma as unknown as Prisma.TransactionClient,
        );
      }

      if (Array.isArray(first)) {
        return Promise.all(first as Promise<unknown>[]);
      }

      throw new Error("Unsupported transaction signature in test stub.");
    },
  };

  const getUserRoles = (userId: string): string[] => {
    const assigned = store.userRoles.get(userId);
    if (!assigned) {
      return [];
    }
    return Array.from(assigned);
  };

  const getRoleById = (roleId: string): Role | undefined =>
    Array.from(store.roles.values()).find((role) => role.id === roleId);

  const resolveRoleName = (roleId: string): string | undefined => {
    const role = getRoleById(roleId);
    return role?.name;
  };

  const listUserPermissions = (userId: string): string[] => {
    const permissions = new Set<string>();
    const direct = store.userPermissions.get(userId);
    if (direct) {
      direct.forEach((permission) => permissions.add(permission));
    }
    const roles = getUserRoles(userId);
    roles.forEach((roleId) => {
      const fromRole = store.rolePermissions.get(roleId);
      fromRole?.forEach((permission) => permissions.add(permission));
    });
    return Array.from(permissions);
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    store,
    getUserRoles,
    resolveRoleName,
    listUserPermissions,
  };
};

const createEmailServiceStub = () => {
  const welcomeEmails: Array<{ to: string; token: string }> = [];
  const verificationEmails: Array<{ to: string; token: string }> = [];
  const resetEmails: Array<{ to: string; token: string }> = [];
  const changeNotifications: Array<{ to: string; changedAt: Date }> = [];
  const deviceAlerts: Array<{ to: string; deviceSummary: string }> = [];
  const lockoutNotifications: Array<{ to: string; unlockAt: Date }> = [];

  const service = {
    async sendWelcomeEmail(payload: { to: string; token: string }) {
      welcomeEmails.push(payload);
    },
    async sendVerificationEmail(payload: { to: string; token: string }) {
      verificationEmails.push(payload);
    },
    async sendPasswordResetEmail(payload: { to: string; token: string }) {
      resetEmails.push(payload);
    },
    async sendPasswordChangedNotification(payload: { to: string; changedAt: Date }) {
      changeNotifications.push(payload);
    },
    async sendNewDeviceLoginAlert(payload: { to: string; deviceSummary: string }) {
      deviceAlerts.push(payload);
    },
    async sendAccountLockoutNotification(payload: { to: string; unlockAt: Date }) {
      lockoutNotifications.push({ to: payload.to, unlockAt: payload.unlockAt });
    },
    async sendSessionRevokedNotification() {},
    async sendTwoFactorSetupEmail() {},
    async sendSecurityAlertEmail() {},
  } as unknown as EmailService;

  return {
    service,
    welcomeEmails,
    verificationEmails,
    resetEmails,
    changeNotifications,
    deviceAlerts,
    lockoutNotifications,
  };
};

const createSecurityEventStub = () => {
  const events: Array<Parameters<SecurityEventService["log"]>[0]> = [];
  const service = {
    async log(event: Parameters<SecurityEventService["log"]>[0]) {
      events.push(event);
    },
  } as unknown as SecurityEventService;

  return { service, events };
};

const createBruteForceStub = (): BruteForceProtectionService =>
  ({
    applyDelay: async () => {},
    recordFailure: async () => ({ attempts: 0, captchaRequired: false }),
    reset: async () => {},
  }) as unknown as BruteForceProtectionService;

const createRbacStub = (context: ReturnType<typeof createInMemoryPrisma>): RbacService => {
  const resolveRoles = (userId: string) => {
    const roleIds = context.getUserRoles(userId);
    return roleIds
      .map((roleId) => {
        const name = context.resolveRoleName(roleId);
        return name ? { id: roleId, name } : undefined;
      })
      .filter((entry): entry is { id: string; name: string } => Boolean(entry));
  };

  return {
    async getUserRoles(userId: string) {
      const roles = resolveRoles(userId);
      if (roles.length === 0) {
        return [
          {
            id: "role_customer",
            name: "customer",
          },
        ];
      }
      return roles;
    },
    async getUserPermissions(userId: string) {
      const permissions = context.listUserPermissions(userId);
      return permissions.length > 0 ? permissions : ["catalog:read"];
    },
    async hasRole(userId: string, roles: string[]) {
      if (roles.length === 0) {
        return true;
      }
      const assigned = new Set(resolveRoles(userId).map((role) => role.name.toLowerCase()));
      return roles.some((role) => assigned.has(role.toLowerCase()));
    },
    async hasPermission(userId: string, permission: string | string[]) {
      const required = Array.isArray(permission) ? permission : [permission];
      if (required.length === 0) {
        return true;
      }
      const granted = new Set(context.listUserPermissions(userId));
      if (granted.has("*")) {
        return true;
      }
      return required.some((candidate) => {
        if (granted.has(candidate)) {
          return true;
        }
        const [resource, action] = candidate.split(":");
        return granted.has(`${resource}:*`) || granted.has(`*:${action}`);
      });
    },
    async invalidateUserPermissions() {},
    async assignRole(userId: string, roleId: string) {
      const set = context.store.userRoles.get(userId) ?? new Set<string>();
      set.add(roleId);
      context.store.userRoles.set(userId, set);
    },
    async revokeRole(userId: string, roleId: string) {
      context.store.userRoles.get(userId)?.delete(roleId);
    },
    async grantPermission(userId: string, permissionId: string) {
      const set = context.store.userPermissions.get(userId) ?? new Set<string>();
      set.add(permissionId);
      context.store.userPermissions.set(userId, set);
    },
    async revokePermission(userId: string, permissionId: string) {
      context.store.userPermissions.get(userId)?.delete(permissionId);
    },
    async shutdown() {},
  } as unknown as RbacService;
};

type EmailServiceStub = ReturnType<typeof createEmailServiceStub>;
type SecurityEventStub = ReturnType<typeof createSecurityEventStub>;
const createTokenBlacklistStub = (): TokenBlacklist => {
  const entries = new Map<string, Date>();

  const cleanup = () => {
    const now = Date.now();
    entries.forEach((expiresAt, key) => {
      if (expiresAt.getTime() <= now) {
        entries.delete(key);
      }
    });
  };

  return {
    async add(jti, expiresAt) {
      entries.set(jti, expiresAt);
    },
    async has(jti) {
      cleanup();
      const expiresAt = entries.get(jti);
      if (!expiresAt) {
        return false;
      }
      if (expiresAt.getTime() <= Date.now()) {
        entries.delete(jti);
        return false;
      }
      return true;
    },
    async remove(jti) {
      entries.delete(jti);
    },
    async cleanup() {
      cleanup();
    },
    async shutdown() {
      entries.clear();
    },
  };
};

interface AuthTestHarness {
  authService: AuthService;
  sessionService: SessionService;
  tokenService: TokenService;
  prismaStore: PrismaStore;
  emailStub: EmailServiceStub;
  securityStub: SecurityEventStub;
  setTime(value: Date): void;
  advanceTime(ms: number): void;
  config: ApplicationConfig;
  context(deviceOverrides?: Partial<SessionDeviceMetadata>): AuthRequestContext;
}

const createAuthTestHarness = (
  options: { configOverrides?: DeepPartial<ApplicationConfig> } = {},
): AuthTestHarness => {
  const config = createTestConfig(options.configOverrides);
  const nowState = { value: new Date() };
  const getNow = () => new Date(nowState.value.getTime());

  const prismaContext = createInMemoryPrisma({ now: getNow });
  const prisma = prismaContext.prisma;
  const emailStub = createEmailServiceStub();
  const securityStub = createSecurityEventStub();
  const bruteForce = createBruteForceStub();
  const rbacService = createRbacStub(prismaContext);
  const blacklist = createTokenBlacklistStub();
  const sessionService = new SessionService({
    prisma,
    authConfig: config.auth,
    now: getNow,
  });
  const tokenService = new TokenService({
    prisma,
    authConfig: config.auth,
    sessionService,
    rbacService,
    blacklist,
    disableCleanupJob: true,
    now: getNow,
  });
  const logger = createChildLogger("test:auth-service");

  const authService = new AuthService({
    prisma,
    config,
    sessionService,
    tokenService,
    rbacService,
    emailService: emailStub.service,
    securityEventService: securityStub.service,
    bruteForceProtection: bruteForce,
    logger,
    now: getNow,
  });

  return {
    authService,
    sessionService,
    tokenService,
    prismaStore: prismaContext.store,
    emailStub,
    securityStub,
    config,
    setTime(value: Date) {
      nowState.value = value;
    },
    advanceTime(ms: number) {
      nowState.value = new Date(nowState.value.getTime() + ms);
    },
    context(overrides: Partial<SessionDeviceMetadata> = {}): AuthRequestContext {
      return {
        device: {
          ipAddress: overrides.ipAddress ?? "203.0.113.10",
          userAgent: overrides.userAgent ?? "JestAgent/1.0",
          accept: overrides.accept ?? "application/json",
        },
      };
    },
  };
};

const expectProfile = (profile: AuthUserProfile, email: string) => {
  expect(profile.email).toBe(email);
  expect(profile.roles).toContain("customer");
  expect(profile.permissions.length).toBeGreaterThan(0);
};

const extractToken = (tokenPair: TokenPair) => ({
  access: tokenPair.accessToken.token,
  refresh: tokenPair.refreshToken.token,
});

describe("AuthService integration flows", () => {
  let harness: AuthTestHarness;

  beforeEach(() => {
    harness = createAuthTestHarness();
  });

  afterEach(async () => {
    await harness.tokenService.shutdown();
  });

  const registerAndVerify = async (email: string, password = "Str0ng!Passw0rd") => {
    const registerResult = await harness.authService.register(
      {
        email,
        password,
        firstName: "Integration",
        lastName: "User",
      },
      harness.context(),
    );

    const welcome = harness.emailStub.welcomeEmails.pop();
    expect(welcome?.token).toBeDefined();

    await harness.authService.verifyEmail(welcome!.token);

    return {
      profile: registerResult.user,
      password,
    };
  };

  it("completes full user registration, verification, login, refresh, and logout lifecycle", async () => {
    const registerResult = await harness.authService.register(
      {
        email: "new.user@example.com",
        password: "Str0ng!Passw0rd",
        firstName: "New",
        lastName: "User",
      },
      harness.context(),
    );

    expectProfile(registerResult.user, "new.user@example.com");
    expect(registerResult.emailVerification.expiresAt).toBeInstanceOf(Date);
    expect(harness.emailStub.welcomeEmails).toHaveLength(1);
    const verificationToken = harness.emailStub.welcomeEmails[0]!.token;

    const verificationResult = await harness.authService.verifyEmail(verificationToken);
    expectProfile(verificationResult.user, "new.user@example.com");

    const primaryDevice = {
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
    } as const;

    const loginResult = await harness.authService.login(
      {
        email: "new.user@example.com",
        password: "Str0ng!Passw0rd",
      },
      harness.context(primaryDevice),
    );

    expectProfile(loginResult.user, "new.user@example.com");
    expect(loginResult.tokens.accessToken.token).toEqual(expect.any(String));
    expect(loginResult.tokens.refreshToken.token).toEqual(expect.any(String));

    const refreshResult = await harness.authService.refresh(
      extractToken(loginResult.tokens).refresh,
      harness.context(primaryDevice),
    );
    expectProfile(refreshResult.user, "new.user@example.com");
    expect(refreshResult.tokens.accessToken.token).not.toBe(loginResult.tokens.accessToken.token);

    await expect(
      harness.authService.refresh(
        extractToken(loginResult.tokens).refresh,
        harness.context(primaryDevice),
      ),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "refresh_token_revoked" }),
    });

    await harness.authService.logout(refreshResult.sessionId, loginResult.user.id);

    await expect(
      harness.tokenService.verifyAccessToken(refreshResult.tokens.accessToken.token),
    ).rejects.toThrow();
  });

  it("rejects login with invalid password and records security events", async () => {
    const { profile } = await registerAndVerify("invalid.login@example.com");
    const device = { userAgent: "Mozilla/5.0" };

    await expect(
      harness.authService.login(
        {
          email: profile.email,
          password: "WrongPass!234",
        },
        harness.context(device),
      ),
    ).rejects.toMatchObject({
      message: "Invalid credentials. Please check your email and password combination.",
      details: expect.objectContaining({ reason: "invalid_credentials" }),
    });

    const storedUser = harness.prismaStore.users.get(profile.id);
    expect(storedUser?.failedLoginCount).toBe(1);

    expect(
      harness.securityStub.events.some(
        (event) => event.type === "login_failed" && event.userId === profile.id,
      ),
    ).toBe(true);
  });

  it("locks account after consecutive failed logins and blocks further attempts", async () => {
    await harness.tokenService.shutdown();
    harness = createAuthTestHarness({
      configOverrides: {
        auth: { session: { maxLoginAttempts: 2, lockoutDurationSeconds: 900 } },
      },
    });

    const { profile, password } = await registerAndVerify("lockout.user@example.com");
    const device = { userAgent: "Mozilla/5.0" };

    const attemptLogin = async () =>
      harness.authService.login(
        {
          email: profile.email,
          password: "WrongPass!234",
        },
        harness.context(device),
      );

    await expect(attemptLogin()).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "invalid_credentials" }),
    });
    await expect(attemptLogin()).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "invalid_credentials" }),
    });

    const lockedUser = harness.prismaStore.users.get(profile.id);
    expect(lockedUser?.failedLoginCount).toBe(2);
    expect(lockedUser?.lockoutUntil).toBeInstanceOf(Date);

    expect(
      harness.securityStub.events.some(
        (event) => event.type === "account_locked" && event.userId === profile.id,
      ),
    ).toBe(true);
    expect(harness.emailStub.lockoutNotifications).toHaveLength(1);
    expect(harness.emailStub.lockoutNotifications[0]?.to).toBe(profile.email);

    await expect(
      harness.authService.login(
        {
          email: profile.email,
          password,
        },
        harness.context(device),
      ),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "account_locked" }),
    });
  });

  it("processes password reset requests and completion", async () => {
    const { profile } = await registerAndVerify("reset.user@example.com");
    const device = { userAgent: "Mozilla/5.0" };

    await harness.authService.requestPasswordReset(profile.email, harness.context(device));
    expect(harness.emailStub.resetEmails).toHaveLength(1);
    const resetEmail = harness.emailStub.resetEmails[0]!;

    const newPassword = "NewPass!234567";
    await harness.authService.resetPassword(
      {
        token: resetEmail.token,
        password: newPassword,
      },
      harness.context(device),
    );

    expect(
      harness.securityStub.events.some(
        (event) => event.type === "password_reset_completed" && event.userId === profile.id,
      ),
    ).toBe(true);
    expect(harness.emailStub.changeNotifications.length).toBeGreaterThan(0);

    const loginResult = await harness.authService.login(
      {
        email: profile.email,
        password: newPassword,
      },
      harness.context(device),
    );
    expect(loginResult.user.id).toBe(profile.id);
  });

  it("changes password for authenticated users and revokes old credentials", async () => {
    const { profile, password } = await registerAndVerify("change.user@example.com");
    const device = { userAgent: "Mozilla/5.0" };

    const loginResult = await harness.authService.login(
      {
        email: profile.email,
        password,
      },
      harness.context(device),
    );

    const newPassword = "Ch@ngedPass1234";
    await harness.authService.changePassword(profile.id, loginResult.sessionId, {
      currentPassword: password,
      newPassword,
    });

    expect(
      harness.securityStub.events.some(
        (event) => event.type === "password_changed" && event.userId === profile.id,
      ),
    ).toBe(true);
    expect(harness.emailStub.changeNotifications.length).toBeGreaterThan(0);

    await expect(
      harness.authService.login({ email: profile.email, password }, harness.context(device)),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ reason: "invalid_credentials" }),
    });

    const relogin = await harness.authService.login(
      { email: profile.email, password: newPassword },
      harness.context(device),
    );
    expect(relogin.user.id).toBe(profile.id);
  });

  it("logs out all active sessions for a user", async () => {
    const { profile, password } = await registerAndVerify("multi.session@example.com");
    const device = { userAgent: "Mozilla/5.0" };

    const firstLogin = await harness.authService.login(
      { email: profile.email, password },
      harness.context(device),
    );
    await harness.authService.login(
      { email: profile.email, password },
      harness.context({ userAgent: "Mozilla/5.0 (Alt)" }),
    );

    const result = await harness.authService.logoutAll(profile.id);
    expect(result.revokedCount).toBeGreaterThanOrEqual(2);

    const sessions = Array.from(harness.prismaStore.sessions.values()).filter(
      (session) => session.userId === profile.id,
    );
    sessions.forEach((session) => {
      expect(session.revokedAt).not.toBeNull();
    });

    await expect(
      harness.tokenService.verifyAccessToken(firstLogin.tokens.accessToken.token),
    ).rejects.toThrow();
  });

  it("handles concurrent logins within performance budgets", async () => {
    const { profile, password } = await registerAndVerify("concurrency.user@example.com");
    const firstDevice = { userAgent: "Mozilla/5.0" };
    const secondDevice = { userAgent: "Mozilla/5.0 (Alt)" };

    const singleStart = performance.now();
    const first = await harness.authService.login(
      { email: profile.email, password },
      harness.context(firstDevice),
    );
    const singleDuration = performance.now() - singleStart;
    expect(singleDuration).toBeLessThan(500);

    const [concurrentOne, concurrentTwo] = await Promise.all([
      harness.authService.login({ email: profile.email, password }, harness.context(firstDevice)),
      harness.authService.login({ email: profile.email, password }, harness.context(secondDevice)),
    ]);

    expect(concurrentOne.user.id).toBe(profile.id);
    expect(concurrentTwo.user.id).toBe(profile.id);

    const sessionRecord = harness.prismaStore.sessions.get(first.sessionId);
    expect(sessionRecord).toBeDefined();

    const tokenStart = performance.now();
    await harness.tokenService.generateAccessToken({
      user: {
        id: profile.id,
        email: profile.email,
        status: "ACTIVE",
      },
      session: {
        id: sessionRecord!.id,
        userId: sessionRecord!.userId,
        refreshTokenHash: sessionRecord!.refreshTokenHash,
        expiresAt: sessionRecord!.expiresAt,
        revokedAt: sessionRecord!.revokedAt,
        fingerprint: sessionRecord!.fingerprint,
      },
    });
    const tokenDuration = performance.now() - tokenStart;

    expect(tokenDuration).toBeLessThan(75);
  });
});
