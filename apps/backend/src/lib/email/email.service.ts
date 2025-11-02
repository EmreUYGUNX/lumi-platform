import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { getConfig } from "@/config/index.js";
import { createChildLogger } from "@/lib/logger.js";
import type { ApplicationConfig } from "@lumi/types";

import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderDetailsSection,
} from "./helpers.js";
import { renderLayout } from "./layout.js";
import { createSignedUrl } from "./signed-url.js";
import { renderEmailTemplate } from "./templates/index.js";
import { buildTemplateContext } from "./types.js";
import type {
  CartRecoveryEmailPayload,
  EmailContent,
  EmailTemplateContext,
  EmailTemplateId,
  EmailTemplatePayload,
} from "./types.js";

const EMAIL_LOGGER_COMPONENT = "email:service";

interface EmailDeliveryQueue {
  enqueue(task: () => Promise<void>): Promise<void>;
}

interface EmailRateLimiter {
  allow(recipient: string, referenceTime?: number): boolean;
}

const createInlineQueue = (): EmailDeliveryQueue => ({
  enqueue: async (task) => {
    await task();
  },
});

const createMemoryQueue = (concurrency: number): EmailDeliveryQueue => {
  const maxConcurrency = Math.max(1, concurrency);
  const pending: (() => Promise<void>)[] = [];
  let active = 0;

  const schedule = (): Promise<void> | undefined => {
    if (active >= maxConcurrency) {
      return undefined;
    }

    const next = pending.shift();
    if (!next) {
      return undefined;
    }

    active += 1;

    return next()
      .catch(() => {
        // Errors are surfaced via the promise returned from enqueue.
      })
      .finally(() => {
        active = Math.max(0, active - 1);
        schedule();
      });
  };

  return {
    enqueue: (task) =>
      new Promise<void>((resolve, reject) => {
        const wrapped = async () => {
          try {
            await task();
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        pending.push(wrapped);
        schedule();
      }),
  };
};

const createQueueFromConfig = (
  config: ApplicationConfig["email"],
  logger: ReturnType<typeof createChildLogger>,
): EmailDeliveryQueue => {
  switch (config.queue.driver) {
    case "inline": {
      return createInlineQueue();
    }
    case "memory": {
      return createMemoryQueue(config.queue.concurrency);
    }
    case "bullmq": {
      logger.warn(
        "BullMQ driver not yet configured for email delivery; falling back to inline execution.",
      );
      return createInlineQueue();
    }
    default: {
      logger.warn(
        `Unknown email queue driver '${config.queue.driver}'; using inline delivery as fallback.`,
      );
      return createInlineQueue();
    }
  }
};

const createRateLimiter = (windowSeconds: number, maxPerRecipient: number): EmailRateLimiter => {
  const windowMs = windowSeconds * 1000;
  const state = new Map<string, { count: number; windowEndsAt: number }>();

  return {
    allow: (recipient, referenceTime = Date.now()) => {
      const entry = state.get(recipient);

      if (!entry || entry.windowEndsAt <= referenceTime) {
        state.set(recipient, {
          count: 1,
          windowEndsAt: referenceTime + windowMs,
        });
        return true;
      }

      if (entry.count >= maxPerRecipient) {
        return false;
      }

      entry.count += 1;
      return true;
    },
  };
};

type NodemailerTransport = nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

export interface EmailServiceOptions {
  config?: ApplicationConfig;
  logger?: ReturnType<typeof createChildLogger>;
  transport?: NodemailerTransport;
  queue?: EmailDeliveryQueue;
  rateLimiter?: EmailRateLimiter;
}

export interface BaseEmailPayload {
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

export interface PasswordChangedEmailPayload extends BaseEmailPayload {
  changedAt: Date;
  ipAddress?: string | null;
}

export interface AccountLockoutEmailPayload extends BaseEmailPayload {
  unlockAt: Date;
  ipAddress?: string | null;
  failedAttempts?: number;
}

export interface NewDeviceLoginEmailPayload extends BaseEmailPayload {
  deviceSummary: string;
  time: Date;
  location?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SessionRevokedEmailPayload extends BaseEmailPayload {
  revokedAt: Date;
  reason?: string | null;
  ipAddress?: string | null;
}

export interface TwoFactorSetupEmailPayload extends BaseEmailPayload {
  setupUrl: string;
  backupCodesUrl?: string;
}

export interface SecurityAlertEmailPayload extends BaseEmailPayload {
  category: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

const buildSender = (config: ApplicationConfig["email"]) => {
  const senderName = config.defaultSender.name?.trim();
  const senderAddress = config.defaultSender.email;

  return senderName && senderName.length > 0 ? `${senderName} <${senderAddress}>` : senderAddress;
};

const createTransport = (config: ApplicationConfig["email"]): NodemailerTransport => {
  const smtpConfig: SMTPTransport.Options = {
    host: config.transport.smtp.host,
    port: config.transport.smtp.port,
    secure: config.transport.smtp.secure,
    tls: {
      rejectUnauthorized: config.transport.smtp.tls.rejectUnauthorized,
    },
  };

  if (config.transport.smtp.username && config.transport.smtp.password) {
    smtpConfig.auth = {
      user: config.transport.smtp.username,
      pass: config.transport.smtp.password,
    };
  }

  return nodemailer.createTransport(smtpConfig);
};

interface EmailJob<TTemplateId extends EmailTemplateId | "security.alert"> {
  templateId: TTemplateId;
  to: string;
  subject: string;
  html: string;
  text: string;
  previewText?: string;
  tags?: string[];
}

export class EmailService {
  private readonly config: ApplicationConfig;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly transport: NodemailerTransport;

  private readonly queue: EmailDeliveryQueue;

  private readonly rateLimiter: EmailRateLimiter;

  private readonly sender: string;

  private readonly replyTo?: string;

  constructor(options: EmailServiceOptions = {}) {
    this.config = options.config ?? getConfig();
    this.logger = options.logger ?? createChildLogger(EMAIL_LOGGER_COMPONENT);
    this.transport = options.transport ?? createTransport(this.config.email);
    this.queue = options.queue ?? createQueueFromConfig(this.config.email, this.logger);
    this.rateLimiter =
      options.rateLimiter ??
      createRateLimiter(
        this.config.email.rateLimit.windowSeconds,
        this.config.email.rateLimit.maxPerRecipient,
      );

    this.sender = buildSender(this.config.email);
    this.replyTo = this.config.email.defaultSender.replyTo ?? undefined;
  }

  private buildContext(): EmailTemplateContext {
    return buildTemplateContext(this.config.email);
  }

  private createSignedLink(path: string, token: string, expiresAt: Date): string {
    const baseUrl = this.config.email.template.baseUrl || this.config.app.frontendUrl;
    return createSignedUrl({
      baseUrl,
      path,
      secret: this.config.email.signingSecret,
      params: { token },
      expiresAt,
    }).url;
  }

  private logRateLimit(recipient: string, templateId: string) {
    this.logger.warn("Email rate limit reached; skipping delivery.", {
      recipient,
      templateId,
      windowSeconds: this.config.email.rateLimit.windowSeconds,
      maxPerRecipient: this.config.email.rateLimit.maxPerRecipient,
    });
  }

  private async dispatch<TTemplateId extends EmailTemplateId | "security.alert">(
    job: EmailJob<TTemplateId>,
  ): Promise<void> {
    if (!this.rateLimiter.allow(job.to)) {
      this.logRateLimit(job.to, job.templateId);
      return;
    }

    await this.queue.enqueue(async () => {
      const mailOptions: Mail.Options = {
        from: this.sender,
        to: job.to,
        subject: job.subject,
        html: job.html,
        text: job.text,
        headers: {
          "X-Lumi-Template": job.templateId,
          "X-Lumi-Environment": this.config.app.environment,
        },
      };

      if (this.replyTo) {
        mailOptions.replyTo = this.replyTo;
      }

      if (job.previewText) {
        mailOptions.headers = {
          ...mailOptions.headers,
          "X-Entity-Preview": job.previewText,
        };
      }

      try {
        const info = await this.transport.sendMail(mailOptions);
        if (this.config.email.logging.deliveries) {
          this.logger.info("Email dispatched successfully.", {
            templateId: job.templateId,
            to: job.to,
            messageId: info.messageId,
            envelope: info.envelope,
          });
        }
      } catch (error) {
        this.logger.error("Failed to dispatch email.", {
          templateId: job.templateId,
          to: job.to,
          error,
        });
        throw error;
      }
    });
  }

  private async sendTemplate<TTemplateId extends EmailTemplateId>(
    recipient: string,
    templateId: TTemplateId,
    payload: EmailTemplatePayload<TTemplateId>,
    tags?: string[],
  ): Promise<void> {
    const context = this.buildContext();
    const email = renderEmailTemplate(templateId, payload, context);

    await this.dispatch({
      templateId,
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
      previewText: email.previewText,
      tags,
    });
  }

  private buildSecurityAlertEmail(
    payload: SecurityAlertEmailPayload,
  ): Omit<EmailContent, "templateId"> {
    const context = this.buildContext();
    const subject = `Security alert for your ${context.brand.productName} account`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);

    const metadataEntries = payload.metadata
      ? Object.entries(payload.metadata).map(([key, value]) => ({
          label: key,
          value: String(value),
        }))
      : [];

    const detailsEntries = [
      { label: "Category", value: payload.category },
      payload.occurredAt
        ? { label: "Detected", value: formatDateTime(payload.occurredAt, context.locale) }
        : undefined,
      ...metadataEntries,
    ].filter((entry): entry is { label: string; value: string } => entry !== undefined);

    const details = renderDetailsSection(detailsEntries);

    const bodyHtml = [
      greeting.html,
      `<p>We detected unusual activity that triggered a security alert on your ${context.brand.productName} account.</p>`,
      details.html,
      `<p>If you do not recognise this activity, please reset your password and review your active sessions immediately.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `We detected unusual activity that triggered a security alert on your ${context.brand.productName} account.`,
      details.text,
      "If you do not recognise this activity, reset your password and review your active sessions immediately.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "We detected unusual activity on your account.",
    });
  }

  async sendWelcomeEmail(payload: VerificationEmailPayload): Promise<void> {
    const verificationUrl = this.createSignedLink(
      "/verify-email",
      payload.token,
      payload.expiresAt,
    );

    await this.sendTemplate(payload.to, "auth.welcome", {
      firstName: payload.firstName,
      verificationUrl,
      expiresAt: payload.expiresAt,
    });
  }

  async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
    const verificationUrl = this.createSignedLink(
      "/verify-email",
      payload.token,
      payload.expiresAt,
    );

    await this.sendTemplate(payload.to, "auth.verify-email", {
      firstName: payload.firstName,
      verificationUrl,
      expiresAt: payload.expiresAt,
    });
  }

  async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
    const resetUrl = this.createSignedLink("/reset-password", payload.token, payload.expiresAt);

    await this.sendTemplate(payload.to, "auth.password-reset", {
      firstName: payload.firstName,
      resetUrl,
      expiresAt: payload.expiresAt,
    });
  }

  async sendPasswordChangedNotification(payload: PasswordChangedEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "auth.password-changed", {
      firstName: payload.firstName,
      changedAt: payload.changedAt,
      ipAddress: payload.ipAddress,
    });
  }

  async sendAccountLockoutNotification(payload: AccountLockoutEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "auth.account-locked", {
      firstName: payload.firstName,
      unlockAt: payload.unlockAt,
      ipAddress: payload.ipAddress,
      failedAttempts: payload.failedAttempts,
    });
  }

  async sendNewDeviceLoginAlert(payload: NewDeviceLoginEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "auth.new-device", {
      firstName: payload.firstName,
      deviceSummary: payload.deviceSummary,
      time: payload.time,
      location: payload.location,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    });
  }

  async sendSessionRevokedNotification(payload: SessionRevokedEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "auth.session-revoked", {
      firstName: payload.firstName,
      revokedAt: payload.revokedAt,
      reason: payload.reason,
      ipAddress: payload.ipAddress,
    });
  }

  async sendTwoFactorSetupEmail(payload: TwoFactorSetupEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "auth.two-factor-setup", {
      firstName: payload.firstName,
      setupUrl: payload.setupUrl,
      backupCodesUrl: payload.backupCodesUrl,
    });
  }

  async sendSecurityAlertEmail(payload: SecurityAlertEmailPayload): Promise<void> {
    const email = this.buildSecurityAlertEmail(payload);

    await this.dispatch({
      templateId: "security.alert",
      to: payload.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      previewText: email.previewText,
    });
  }

  async sendCartRecoveryEmail(payload: CartRecoveryEmailPayload): Promise<void> {
    await this.sendTemplate(payload.to, "commerce.cart-recovery", {
      firstName: payload.firstName ?? undefined,
      cartId: payload.cartId,
      resumeUrl: payload.resumeUrl,
      itemCount: payload.itemCount,
      total: payload.total,
    });
  }
}

export const createEmailService = (options: EmailServiceOptions = {}): EmailService =>
  new EmailService(options);
