import type { AuditLog, Prisma } from "@prisma/client";

import { prisma } from "../database/prisma.js";
import { logger } from "../lib/logger.js";
import { type PaginationMeta, buildPaginationMeta } from "../middleware/response-formatter.js";

export type AuditActorType = "ADMIN" | "SYSTEM" | "CUSTOMER" | "ANONYMOUS";

export interface AuditLogEntry {
  action: string;
  entity: string;
  entityId: string;
  userId?: string;
  actorType?: AuditActorType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  page?: number;
  perPage?: number;
  entity?: string;
  actorType?: AuditActorType;
  userId?: string;
}

export interface AuditLogQueryResult {
  data: AuditLog[];
  pagination: PaginationMeta;
}

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "authorization", "refreshtoken"]);

const clampPerPage = (value: number): number => {
  const size = Math.trunc(value);
  if (Number.isNaN(size) || size <= 0) {
    return 20;
  }

  return Math.min(100, size);
};

const normalisePage = (value: number): number => {
  const page = Math.trunc(value);
  if (Number.isNaN(page) || page <= 0) {
    return 1;
  }

  return page;
};

function scrubPayload(input?: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!input) {
    return undefined;
  }

  const sanitisedEntries = Object.entries(input)
    .map<[string, Prisma.InputJsonValue] | undefined>(([key, value]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        return [key, "[REDACTED]"];
      }

      const sanitised = scrubValue(value);
      return sanitised === undefined ? undefined : [key, sanitised];
    })
    .filter((entry): entry is [string, Prisma.InputJsonValue] => entry !== undefined);

  return sanitisedEntries.length > 0 ? Object.fromEntries(sanitisedEntries) : undefined;
}

function scrubValue(value: unknown): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value
      .map((entry) => scrubValue(entry))
      .filter(
        (entry): entry is Prisma.InputJsonValue => entry !== undefined,
      ) as Prisma.InputJsonValue;
  }

  if (value && typeof value === "object") {
    return scrubPayload(value as Record<string, unknown>) ?? "[NULL]";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return "[NULL]";
  }

  return String(value);
}

export const recordAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  const actorType = entry.actorType ?? (entry.userId ? "ADMIN" : "SYSTEM");

  const afterSnapshot = scrubPayload(entry.after);
  const metadataPayload = scrubPayload(entry.metadata);

  const mergedAfter: Record<string, Prisma.InputJsonValue> = {};
  if (afterSnapshot !== undefined) {
    mergedAfter.after = afterSnapshot;
  }
  if (metadataPayload !== undefined) {
    mergedAfter.metadata = metadataPayload;
  }

  const afterPayload: Prisma.InputJsonValue | undefined =
    Object.keys(mergedAfter).length > 0 ? mergedAfter : undefined;

  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        actorType,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: scrubPayload(entry.before),
        after: afterPayload,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    logger.error("Failed to persist audit log entry", {
      error,
      entry: {
        ...entry,
        before: undefined,
        after: undefined,
      },
    });
    throw error;
  }
};

export const queryAuditLogs = async (query: AuditLogQuery = {}): Promise<AuditLogQueryResult> => {
  const page = normalisePage(query.page ?? 1);
  const perPage = clampPerPage(query.perPage ?? 20);

  const where: Prisma.AuditLogWhereInput = {};

  if (query.entity) {
    where.entity = query.entity;
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  if (query.actorType) {
    where.actorType = query.actorType;
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    pagination: buildPaginationMeta({ page, perPage, total }),
  };
};
