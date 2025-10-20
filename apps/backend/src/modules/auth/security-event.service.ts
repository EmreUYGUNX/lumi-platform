import type { Prisma, PrismaClient } from "@prisma/client";

import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

export type SecurityEventPayload = Record<string, unknown>;

export interface LogSecurityEventInput {
  type: string;
  userId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  payload?: SecurityEventPayload;
}

export interface SecurityEventServiceOptions {
  prisma?: PrismaClient;
  logger?: ReturnType<typeof createChildLogger>;
}

const SECURITY_EVENT_COMPONENT = "auth:security-events";

export class SecurityEventService {
  private readonly prisma: PrismaClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: SecurityEventServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.logger = options.logger ?? createChildLogger(SECURITY_EVENT_COMPONENT);
  }

  async log(input: LogSecurityEventInput): Promise<void> {
    const { type, userId, ipAddress, userAgent, payload } = input;
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
    }
  }
}

export const createSecurityEventService = (
  options: SecurityEventServiceOptions = {},
): SecurityEventService => new SecurityEventService(options);
