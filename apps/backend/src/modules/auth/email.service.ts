import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import type { ApplicationConfig } from "@lumi/types";

const EMAIL_LOGGER_COMPONENT = "auth:email-service";

export interface EmailServiceOptions {
  config?: ApplicationConfig;
  logger?: ReturnType<typeof createChildLogger>;
}

interface BaseEmailPayload {
  to: string;
  firstName?: string | null;
}

export interface VerificationEmailPayload extends BaseEmailPayload {
  token: string;
  expiresAt: Date;
}

export interface PasswordResetEmailPayload extends BaseEmailPayload {
  token: string;
  expiresAt: Date;
}

export type PasswordChangedEmailPayload = BaseEmailPayload;

export interface AccountLockoutEmailPayload extends BaseEmailPayload {
  unlockAt: Date;
}

export interface NewDeviceLoginEmailPayload extends BaseEmailPayload {
  deviceSummary: string;
  ipAddress?: string | null;
  time: Date;
}

export interface SecurityAlertEmailPayload extends BaseEmailPayload {
  category: string;
  metadata?: Record<string, unknown>;
}

const buildUrl = (base: string, path: string, params: Record<string, string>): string => {
  const url = new URL(path, base);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

export class EmailService {
  private readonly config: ApplicationConfig;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: EmailServiceOptions = {}) {
    this.config = options.config ?? getConfig();
    this.logger = options.logger ?? createChildLogger(EMAIL_LOGGER_COMPONENT);
  }

  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    const verificationUrl = buildUrl(this.config.app.frontendUrl, "/verify-email", {
      token: payload.token,
    });

    this.logger.info("Queued email verification message", {
      to: payload.to,
      verificationUrl,
      expiresAt: payload.expiresAt.toISOString(),
    });
  }

  async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    const resetUrl = buildUrl(this.config.app.frontendUrl, "/reset-password", {
      token: payload.token,
    });

    this.logger.info("Queued password reset email", {
      to: payload.to,
      resetUrl,
      expiresAt: payload.expiresAt.toISOString(),
    });
  }

  async sendPasswordChangedNotification(payload: PasswordChangedEmailPayload): Promise<void> {
    this.logger.info("Queued password changed notification", {
      to: payload.to,
    });
  }

  async sendAccountLockoutNotification(payload: AccountLockoutEmailPayload): Promise<void> {
    this.logger.warn("Queued account lockout notification", {
      to: payload.to,
      unlockAt: payload.unlockAt.toISOString(),
    });
  }

  async sendNewDeviceLoginAlert(payload: NewDeviceLoginEmailPayload): Promise<void> {
    this.logger.info("Queued new device login alert", {
      to: payload.to,
      deviceSummary: payload.deviceSummary,
      ipAddress: payload.ipAddress,
      time: payload.time.toISOString(),
    });
  }

  async sendSecurityAlertEmail(payload: SecurityAlertEmailPayload): Promise<void> {
    this.logger.error("Queued security alert email", {
      to: payload.to,
      category: payload.category,
      metadata: payload.metadata,
    });
  }
}

export const createEmailService = (options: EmailServiceOptions = {}): EmailService =>
  new EmailService(options);
