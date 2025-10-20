import type { Prisma, PrismaClient } from "@prisma/client";

import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { getSentryInstance, isSentryEnabled } from "@/observability/index.js";

export type SecurityEventPayload = Record<string, unknown>;

export type SecurityEventSeverity = "info" | "warning" | "critical";

export interface LogSecurityEventInput {
  type: string;
  userId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  payload?: SecurityEventPayload;
  severity?: SecurityEventSeverity;
}

export interface SecurityEventServiceOptions {
  prisma?: PrismaClient;
  logger?: ReturnType<typeof createChildLogger>;
}

const SECURITY_EVENT_COMPONENT = "auth:security-events";
const CRITICAL_EVENT_TYPES = new Set<string>([
  "refresh_token_replay_detected",
  "session_fingerprint_mismatch",
  "admin_access_denied",
]);
const WARNING_EVENT_TYPES = new Set<string>([
  "account_locked",
  "permission_denied",
  "role_denied",
  "account_unlock_manual",
]);

const inferSeverity = (type: string, explicit?: SecurityEventSeverity): SecurityEventSeverity => {
  if (explicit) {
    return explicit;
  }

  if (CRITICAL_EVENT_TYPES.has(type)) {
    return "critical";
  }

  if (WARNING_EVENT_TYPES.has(type)) {
    return "warning";
  }

  return "info";
};

export class SecurityEventService {
  private readonly prisma: PrismaClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: SecurityEventServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.logger = options.logger ?? createChildLogger(SECURITY_EVENT_COMPONENT);
  }

  async log(input: LogSecurityEventInput): Promise<void> {
    const { type, userId, ipAddress, userAgent, payload } = input;
    const severity = inferSeverity(type, input.severity);
    const data: Prisma.SecurityEventCreateInput = {
      type,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
      payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      user: userId ? { connect: { id: userId } } : undefined,
    };

    try {
      await this.prisma.securityEvent.create({ data });
    } catch (error) {
      this.logger.error("Failed to persist security event", {
        error,
        eventType: type,
        userId,
      });
      return;
    }

    if (severity !== "critical" || !isSentryEnabled()) {
      return;
    }

    try {
      const sentry = getSentryInstance();
      sentry.withScope((scope) => {
        scope.setLevel("error");
        scope.setTag("security_event_type", type);
        if (userId) {
          scope.setUser({ id: userId });
        }
        scope.setContext("security_event", {
          ipAddress: ipAddress ?? undefined,
          userAgent: userAgent ?? undefined,
          payload,
        });
        sentry.captureMessage(`Security event recorded: ${type}`, "error");
      });
    } catch (error) {
      this.logger.error("Failed to forward security event to Sentry", {
        error,
        eventType: type,
        userId,
      });
    }
  }
}

export const createSecurityEventService = (
  options: SecurityEventServiceOptions = {},
): SecurityEventService => new SecurityEventService(options);
