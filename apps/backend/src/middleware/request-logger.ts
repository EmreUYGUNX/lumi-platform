import { performance } from "node:perf_hooks";

import type { NextFunction, Request, Response } from "express";

import { recordAuditLog } from "../audit/audit-log.service.js";
import type { AuditLogEntry } from "../audit/audit-log.service.js";
import { logger, mergeRequestContext } from "../lib/logger.js";

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "authorization", "refreshtoken"]);

const maskSensitive = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map((value) => maskSensitive(value));
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          return [key, "[REDACTED]"];
        }

        return [key, maskSensitive(value)];
      }),
    );
  }

  return input;
};

const resolveLogLevel = (status: number): "info" | "warn" | "error" => {
  if (status >= 500) {
    return "error";
  }

  if (status >= 400) {
    return "warn";
  }

  return "info";
};

const isAdminRoute = (req: Request): boolean =>
  req.originalUrl.startsWith("/api/v1/admin") || req.path.startsWith("/api/v1/admin");

const isMutationMethod = (method: string): boolean =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(method);

const resolveAuditEntity = (req: Request, explicit?: { entity?: string; entityId?: string }) => {
  if (explicit?.entity) {
    return {
      entity: explicit.entity,
      entityId: explicit.entityId ?? "unknown",
    };
  }

  const pathWithoutQuery = (req.originalUrl ?? "").split("?")[0] ?? "";
  const segments = pathWithoutQuery.split("/").filter(Boolean);

  const adminSegments = segments.slice(3); // strip api/v1/admin

  if (adminSegments.length === 0) {
    return { entity: "admin", entityId: "root" };
  }

  const [entity, entityId] = adminSegments;

  return {
    entity: entity ?? "admin",
    entityId: entityId ?? "n/a",
  };
};

const sanitiseForLog = (payload: unknown) => {
  const masked = maskSensitive(payload);

  if (typeof masked === "object") {
    try {
      return JSON.parse(
        JSON.stringify(masked, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
    } catch {
      return masked;
    }
  }

  return masked;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = performance.now();
  const requestId = res.requestId ?? req.requestId ?? "unknown";

  mergeRequestContext({
    requestId,
    userId: req.user?.id,
    role: req.user?.role,
  });

  logger.info("HTTP request received", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get("user-agent"),
  });

  res.on("finish", () => {
    const duration = performance.now() - start;
    const level = resolveLogLevel(res.statusCode);

    const basePayload = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(duration.toFixed(2)),
      userId: req.user?.id,
      ip: req.ip,
    };

    const diagnosticPayload =
      level === "info"
        ? {}
        : {
            body: sanitiseForLog(req.body),
            query: sanitiseForLog(req.query),
          };

    logger.log(level, "HTTP request completed", {
      ...basePayload,
      ...diagnosticPayload,
    });

    if (isAdminRoute(req) && isMutationMethod(req.method) && res.statusCode < 500) {
      const auditContext = (res.locals?.audit ?? {}) as Partial<AuditLogEntry>;
      const { entity, entityId } = resolveAuditEntity(req, auditContext);

      recordAuditLog({
        userId: req.user?.id,
        actorType: "ADMIN",
        action: auditContext.action ?? `${entity}.${req.method.toLowerCase()}`,
        entity,
        entityId,
        before: auditContext.before ?? undefined,
        after: auditContext.after ?? undefined,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
        metadata: {
          requestId,
          requestBody: sanitiseForLog(req.body),
          responseStatus: res.statusCode,
        },
      }).catch((error) => {
        logger.error("Failed to write audit log entry after request", {
          error,
          requestId,
          path: req.originalUrl,
          method: req.method,
        });
      });
    }
  });

  next();
};
