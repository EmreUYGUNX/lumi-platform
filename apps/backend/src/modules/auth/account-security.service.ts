import type { PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

import { createSecurityEventService } from "./security-event.service.js";
import type { SecurityEventService } from "./security-event.service.js";

const ACCOUNT_SECURITY_LOGGER = "auth:account-security";

export interface AccountSecurityServiceOptions {
  prisma?: PrismaClient;
  logger?: ReturnType<typeof createChildLogger>;
  securityEvents?: SecurityEventService;
}

export interface UnlockAccountInput {
  userId: string;
  performedBy: string;
  reason?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AccountSecurityService {
  private readonly prisma: PrismaClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly securityEvents: SecurityEventService;

  constructor(options: AccountSecurityServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.logger = options.logger ?? createChildLogger(ACCOUNT_SECURITY_LOGGER);
    this.securityEvents =
      options.securityEvents ??
      createSecurityEventService({
        prisma: this.prisma,
        logger: createChildLogger(`${ACCOUNT_SECURITY_LOGGER}:events`),
      });
  }

  async unlockUserAccount(input: UnlockAccountInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        failedLoginCount: true,
        lockoutUntil: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found.", {
        details: { userId: input.userId },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        // eslint-disable-next-line unicorn/no-null -- Prisma requires explicit null to clear lockout timestamp.
        lockoutUntil: null,
      },
    });

    await this.securityEvents.log({
      type: "account_unlock_manual",
      userId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent ?? undefined,
      payload: {
        performedBy: input.performedBy,
        reason: input.reason ?? "manual_unlock",
        previousLockoutUntil: user.lockoutUntil?.toISOString(),
        previousFailedLoginCount: user.failedLoginCount,
      },
      severity: "warning",
    });

    this.logger.info("Administrator unlocked user account", {
      userId: user.id,
      performedBy: input.performedBy,
      reason: input.reason,
    });
  }
}

export const createAccountSecurityService = (
  options: AccountSecurityServiceOptions = {},
): AccountSecurityService => new AccountSecurityService(options);
