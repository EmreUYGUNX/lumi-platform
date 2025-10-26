import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { createTestConfig } from "@/testing/config.js";

import { EmailService } from "../email.service.js";

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

    const html = String(mailOptions.html);
    expect(html).toContain("Verify email");
    expect(html).toContain("token-123");
    expect(html).toContain("signature=");
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
});
