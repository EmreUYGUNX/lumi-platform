import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import * as configModule from "@/config/index.js";
import * as loggerModule from "@/lib/logger.js";
import { createTestConfig } from "@/testing/config.js";
import type { ApplicationConfig } from "@lumi/types";

import { EmailService, createEmailService } from "../email.service.js";

const createTransportStub = () => {
  const sendMail = jest.fn(async (_options: Mail.Options) => ({
    messageId: "message-123",
    envelope: { from: "notifications@lumi.dev", to: ["user@example.com"] },
    accepted: [],
    rejected: [],
    pending: [],
    response: "250 accepted",
  }));

  const transport = {
    sendMail: sendMail as unknown as Transporter<SMTPTransport.SentMessageInfo>["sendMail"],
  } as unknown as jest.Mocked<Transporter<SMTPTransport.SentMessageInfo>>;

  return { transport, sendMail };
};

const createQueueStub = () => ({
  enqueue: jest.fn(async (task: () => Promise<void>) => {
    await task();
  }),
});

const createLoggerStub = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe("EmailService", () => {
  const config = createTestConfig();

  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const createService = (
    overrides: Partial<ConstructorParameters<typeof EmailService>[0]> = {},
  ): EmailService => {
    const { transport } = createTransportStub();
    const logger = createLoggerStub();

    return new EmailService({
      config,
      transport: transport as never,
      logger: logger as never,
      ...overrides,
    });
  };

  it("dispatches verification emails with signed URLs", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    const expiresAt = new Date("2025-01-01T00:00:00.000Z");

    await service.sendVerificationEmail({
      to: "user@example.com",
      firstName: "Ada",
      token: "token-123",
      expiresAt,
    });

    expect(rateLimiter.allow).toHaveBeenCalledWith("user@example.com");
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);

    expect(sendMail.mock.calls.length).toBeGreaterThan(0);
    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options | undefined;
    if (!mailOptions) {
      throw new Error("Expected mail options to be provided.");
    }
    expect(mailOptions.from).toBe("Lumi Notifications <notifications@lumi.dev>");
    expect(mailOptions.replyTo).toBe("support@lumi.dev");
    expect(mailOptions.to).toBe("user@example.com");
    expect(mailOptions.subject).toContain("Verify your");
    const headers = mailOptions.headers as Record<string, unknown> | undefined;
    expect(headers?.["X-Lumi-Template"]).toBe("auth.verify-email");
    expect(headers?.["X-Lumi-Environment"]).toBe(config.app.environment);
    expect(headers?.["X-Entity-Preview"]).toEqual(expect.any(String));

    const html = String(mailOptions.html);
    expect(html).toContain("Verify email");
    expect(html).toContain("token-123");
    expect(html).toContain("signature=");

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Email dispatched successfully."),
      expect.objectContaining({
        templateId: "auth.verify-email",
        to: "user@example.com",
      }),
    );
  });

  it("skips delivery when rate limit is exceeded", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const logger = createLoggerStub();
    const rateLimiter = { allow: jest.fn(() => false) };

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendPasswordResetEmail({
      to: "user@example.com",
      token: "reset-token",
      expiresAt: new Date("2025-01-02T00:00:00.000Z"),
    });

    expect(rateLimiter.allow).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Email rate limit reached"),
      expect.objectContaining({
        recipient: "user@example.com",
        templateId: "auth.password-reset",
      }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("formats security alert emails with metadata", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendSecurityAlertEmail({
      to: "user@example.com",
      firstName: "Grace",
      category: "refresh_token_replay",
      metadata: {
        sessionId: "session-1",
        ipAddress: "203.0.113.42",
      },
      occurredAt: new Date("2025-03-01T12:00:00.000Z"),
    });

    expect(transport.sendMail.mock.calls.length).toBeGreaterThan(0);
    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options | undefined;
    if (!mailOptions) {
      throw new Error("Expected mail options to be provided.");
    }
    expect(mailOptions.subject).toContain("Security alert");
    expect(String(mailOptions.html)).toContain("refresh_token_replay");
    expect(String(mailOptions.html)).toContain("203.0.113.42");
    const headers = mailOptions.headers as Record<string, unknown> | undefined;
    expect(headers?.["X-Lumi-Template"]).toBe("security.alert");
  });

  it("formats security alert emails without metadata or timestamp", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendSecurityAlertEmail({
      to: "plain@example.com",
      firstName: "Plain",
      category: "suspicious_activity",
    });

    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options | undefined;
    if (!mailOptions) {
      throw new Error("Expected mail options to be provided.");
    }

    const html = String(mailOptions.html);
    expect(html).toContain("suspicious_activity");
    expect(html).not.toContain("Detected");
  });

  it("sends order confirmation emails with line items", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendOrderConfirmationEmail({
      to: "order@example.com",
      firstName: "Nova",
      orderReference: "LM-ORDER-1",
      status: "confirmed",
      total: { amount: "249.00", currency: "TRY" },
      items: [
        { title: "Aurora Lamp", quantity: 1, total: { amount: "199.00", currency: "TRY" } },
        { title: "Nimbus Shade", quantity: 1, total: { amount: "50.00", currency: "TRY" } },
      ],
      orderUrl: "https://example.com/orders/LM-ORDER-1",
    });

    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options;
    expect(mailOptions.subject).toContain("LM-ORDER-1");
    expect(String(mailOptions.html)).toContain("Aurora Lamp");
    expect(String(mailOptions.html)).toContain("View order details");
    const headers = mailOptions.headers as Record<string, unknown>;
    expect(headers?.["X-Lumi-Template"]).toBe("commerce.order-confirmation");
  });

  it("sends order refund notifications", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendOrderRefundEmail({
      to: "refund@example.com",
      orderReference: "LM-REFUND-1",
      status: "refunded",
      total: { amount: "120.00", currency: "TRY" },
      items: [{ title: "Desk Mat", quantity: 1, total: { amount: "120.00", currency: "TRY" } }],
    });

    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options;
    expect(mailOptions.subject).toContain("LM-REFUND-1");
    expect(String(mailOptions.html)).toContain("Desk Mat");
    const headers = mailOptions.headers as Record<string, unknown>;
    expect(headers?.["X-Lumi-Template"]).toBe("commerce.order-confirmation");
  });

  it("uses memory queue driver when configured", async () => {
    const memoryConfig = createTestConfig({
      email: {
        queue: {
          driver: "memory",
          concurrency: 1,
        },
        rateLimit: {
          windowSeconds: 60,
          maxPerRecipient: 10,
        },
      },
    });
    const { transport, sendMail } = createTransportStub();
    const logger = createLoggerStub();

    const service = new EmailService({
      config: memoryConfig,
      transport: transport as never,
      logger: logger as never,
    });

    await Promise.all([
      service.sendPasswordResetEmail({
        to: "memory@example.com",
        token: "memory-token",
        expiresAt: new Date("2025-04-01T00:00:00.000Z"),
      }),
      service.sendPasswordChangedNotification({
        to: "memory@example.com",
        firstName: "Memory",
        changedAt: new Date("2025-04-01T00:10:00.000Z"),
        ipAddress: "198.51.100.42",
      }),
    ]);

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to inline queue when BullMQ driver is configured", async () => {
    const bullConfig = createTestConfig({
      email: {
        queue: {
          driver: "bullmq",
          concurrency: 2,
        },
      },
    });
    const { transport, sendMail } = createTransportStub();
    const logger = createLoggerStub();

    const service = new EmailService({
      config: bullConfig,
      transport: transport as never,
      logger: logger as never,
    });

    await service.sendAccountLockoutNotification({
      to: "bull@example.com",
      firstName: "Bull",
      unlockAt: new Date("2025-05-01T00:00:00.000Z"),
      failedAttempts: 5,
      ipAddress: "203.0.113.99",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("BullMQ driver not yet configured"),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("falls back to inline queue for unknown driver", async () => {
    const unknownDriverConfig = createTestConfig({
      email: {
        queue: {
          driver: "rocket" as unknown as ApplicationConfig["email"]["queue"]["driver"],
        },
      },
    });
    const { transport, sendMail } = createTransportStub();
    const logger = createLoggerStub();

    const service = new EmailService({
      config: unknownDriverConfig,
      transport: transport as never,
      logger: logger as never,
    });

    await service.sendWelcomeEmail({
      to: "unknown@example.com",
      firstName: "Unknown",
      token: "unknown-token",
      expiresAt: new Date("2025-05-02T00:00:00.000Z"),
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown email queue driver"));
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("uses default configuration when options are omitted", async () => {
    const defaultConfig = createTestConfig();
    const configSpy = jest.spyOn(configModule, "getConfig").mockReturnValue(defaultConfig);
    const defaultLogger = createLoggerStub();
    jest
      .spyOn(loggerModule, "createChildLogger")
      .mockReturnValue(
        defaultLogger as unknown as ReturnType<typeof loggerModule.createChildLogger>,
      );
    const { transport, sendMail } = createTransportStub();
    jest.spyOn(nodemailer, "createTransport").mockReturnValue(transport as never);

    const service = new EmailService();

    await service.sendPasswordResetEmail({
      to: "default@example.com",
      token: "default-token",
      expiresAt: new Date("2025-10-01T00:00:00.000Z"),
    });

    expect(configSpy).toHaveBeenCalledTimes(1);
    expect(loggerModule.createChildLogger).toHaveBeenCalledWith("email:service");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(defaultLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Email dispatched successfully."),
      expect.objectContaining({
        to: "default@example.com",
        templateId: "auth.password-reset",
      }),
    );
  });

  it("enforces default rate limiter when threshold exceeded", async () => {
    const { transport, sendMail } = createTransportStub();
    const logger = createLoggerStub();
    const rateLimitedConfig = createTestConfig({
      email: {
        queue: {
          driver: "inline",
        },
      },
    });

    jest.spyOn(nodemailer, "createTransport").mockReturnValue(transport as never);

    const service = new EmailService({
      config: rateLimitedConfig,
      logger: logger as never,
    });

    const payload = {
      to: "limited@example.com",
      firstName: "Rate",
      token: "token",
      expiresAt: new Date("2025-06-01T00:00:00.000Z"),
    };

    const allowed = rateLimitedConfig.email.rateLimit.maxPerRecipient;
    await Promise.all(
      Array.from({ length: allowed }, (_, index) =>
        service.sendVerificationEmail({
          ...payload,
          token: `token-${index}`,
        }),
      ),
    );

    await service.sendVerificationEmail({
      ...payload,
      token: "token-exceeded",
    });

    expect(sendMail).toHaveBeenCalledTimes(allowed);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Email rate limit reached"),
      expect.objectContaining({
        recipient: "limited@example.com",
        templateId: "auth.verify-email",
      }),
    );
  });

  it("omits reply-to header when not configured", async () => {
    const noReplyConfig = createTestConfig({
      email: {
        defaultSender: {
          email: "notifications@lumi.dev",
          name: "",
        },
      },
    });
    delete noReplyConfig.email.defaultSender.replyTo;
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config: noReplyConfig,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendPasswordChangedNotification({
      to: "reply@example.com",
      firstName: "No Reply",
      changedAt: new Date("2025-07-01T00:00:00.000Z"),
    });

    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options | undefined;
    if (!mailOptions) {
      throw new Error("Expected mail options to be provided.");
    }

    expect(mailOptions.from).toBe("notifications@lumi.dev");
    expect(mailOptions.replyTo).toBeUndefined();
  });

  it("builds verification links with frontend fallback when template base URL missing", async () => {
    const fallbackConfig = createTestConfig({
      email: {
        template: {
          baseUrl: "",
        },
      },
    });
    delete (fallbackConfig.email.template as { baseUrl?: string }).baseUrl;
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config: fallbackConfig,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendVerificationEmail({
      to: "fallback@example.com",
      firstName: "Fallback",
      token: "fallback-token",
      expiresAt: new Date("2025-11-01T00:00:00.000Z"),
    });

    const mailCall = sendMail.mock.calls[0];
    if (!mailCall) {
      throw new Error("Expected sendMail to receive mail options.");
    }
    const mailOptions = mailCall[0] as Mail.Options | undefined;
    if (!mailOptions) {
      throw new Error("Expected mail options to be provided.");
    }

    expect(String(mailOptions.html)).toContain(fallbackConfig.app.frontendUrl);
  });

  it("does not log deliveries when delivery logging disabled", async () => {
    const disabledLoggingConfig = createTestConfig({
      email: {
        logging: {
          deliveries: false,
        },
      },
    });
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    const service = new EmailService({
      config: disabledLoggingConfig,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await service.sendVerificationEmail({
      to: "logging@example.com",
      firstName: "Log",
      token: "token-log",
      expiresAt: new Date("2025-08-01T00:00:00.000Z"),
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Email dispatched successfully."),
      expect.anything(),
    );
  });

  it("logs and rethrows when transport fails", async () => {
    const { transport, sendMail } = createTransportStub();
    const queue = createQueueStub();
    const rateLimiter = { allow: jest.fn(() => true) };
    const logger = createLoggerStub();

    sendMail.mockRejectedValueOnce(new Error("smtp down"));

    const service = new EmailService({
      config,
      transport: transport as never,
      queue,
      rateLimiter: rateLimiter as never,
      logger: logger as never,
    });

    await expect(
      service.sendVerificationEmail({
        to: "error@example.com",
        firstName: "Err",
        token: "token-error",
        expiresAt: new Date("2025-09-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow("smtp down");

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to dispatch email."),
      expect.objectContaining({
        templateId: "auth.verify-email",
        to: "error@example.com",
      }),
    );
  });

  it("creates service via factory helper", () => {
    const defaultConfig = createTestConfig();
    jest.spyOn(configModule, "getConfig").mockReturnValue(defaultConfig);
    const defaultLogger = createLoggerStub();
    jest
      .spyOn(loggerModule, "createChildLogger")
      .mockReturnValue(
        defaultLogger as unknown as ReturnType<typeof loggerModule.createChildLogger>,
      );
    const { transport } = createTransportStub();
    jest.spyOn(nodemailer, "createTransport").mockReturnValue(transport as never);

    const service = createEmailService();

    expect(service).toBeInstanceOf(EmailService);
  });

  it("exposes template listing utilities", () => {
    const service = createService();
    expect(service).toBeInstanceOf(EmailService);
  });
});
