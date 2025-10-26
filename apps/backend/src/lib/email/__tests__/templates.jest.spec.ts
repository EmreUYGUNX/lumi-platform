import { describe, expect, it } from "@jest/globals";

import { listEmailTemplates, renderEmailTemplate } from "@/lib/email/templates/index.js";
import { buildTemplateContext } from "@/lib/email/types.js";
import { createTestConfig } from "@/testing/config.js";

const context = buildTemplateContext(createTestConfig().email);

describe("Email templates", () => {
  it("renders welcome template with verification link", () => {
    const result = renderEmailTemplate(
      "auth.welcome",
      {
        firstName: "Ada",
        verificationUrl: "https://app.example.com/verify?token=abc",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).toContain("Verify email");
    expect(result.text).toContain("Verify email");
    expect(result.templateId).toBe("auth.welcome");
  });

  it("renders verification template with expiry", () => {
    const result = renderEmailTemplate(
      "auth.verify-email",
      {
        firstName: "Grace",
        verificationUrl: "https://app.example.com/verify?token=def",
        expiresAt: new Date("2025-01-02T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).toMatch(/confirm your email address/i);
    expect(result.text).toContain("Verify email:");
  });

  it("renders password reset template with link", () => {
    const result = renderEmailTemplate(
      "auth.password-reset",
      {
        firstName: "Niels",
        resetUrl: "https://app.example.com/reset?token=ghi",
        expiresAt: new Date("2025-01-03T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).toContain("Reset password");
    expect(result.text).toContain("Reset password");
  });

  it("renders password changed notification with ip details", () => {
    const result = renderEmailTemplate(
      "auth.password-changed",
      {
        firstName: "Katherine",
        changedAt: new Date("2025-01-04T00:00:00.000Z"),
        ipAddress: "198.51.100.24",
      },
      context,
    );

    expect(result.html).toMatch(/password was changed/i);
    expect(result.text).toContain("198.51.100.24");
  });

  it("renders account locked notification with failed attempts", () => {
    const result = renderEmailTemplate(
      "auth.account-locked",
      {
        firstName: "Alan",
        unlockAt: new Date("2025-01-05T00:00:00.000Z"),
        failedAttempts: 6,
        ipAddress: "203.0.113.10",
      },
      context,
    );

    expect(result.html).toContain("temporarily locked");
    expect(result.html).toContain("Failed attempts");
  });

  it("renders new device login alert with optional fields", () => {
    const result = renderEmailTemplate(
      "auth.new-device",
      {
        firstName: "Dorothy",
        deviceSummary: "Chrome on macOS",
        time: new Date("2025-01-06T00:00:00.000Z"),
        location: "London, UK",
        ipAddress: "192.0.2.10",
      },
      context,
    );

    expect(result.html).toContain("New sign-in");
    expect(result.html).toContain("London, UK");
  });

  it("renders session revoked notification with reason", () => {
    const result = renderEmailTemplate(
      "auth.session-revoked",
      {
        firstName: "Barbara",
        revokedAt: new Date("2025-01-07T00:00:00.000Z"),
        reason: "token_reuse_detected",
        ipAddress: "203.0.113.20",
      },
      context,
    );

    expect(result.html).toContain("signed out");
    expect(result.html).toContain("token_reuse_detected");
  });

  it("renders two-factor setup template with backup codes", () => {
    const result = renderEmailTemplate(
      "auth.two-factor-setup",
      {
        firstName: "Margaret",
        setupUrl: "https://app.example.com/security/2fa",
        backupCodesUrl: "https://app.example.com/security/2fa/codes",
      },
      context,
    );

    expect(result.html).toContain("Two-factor authentication");
    expect(result.html).toContain("Download backup codes");
  });

  it("renders account locked template without optional metadata", () => {
    const result = renderEmailTemplate(
      "auth.account-locked",
      {
        unlockAt: new Date("2025-01-05T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).not.toContain("Failed attempts");
    expect(result.text).not.toContain("Last attempt IP");
  });

  it("renders new device template without location details", () => {
    const result = renderEmailTemplate(
      "auth.new-device",
      {
        deviceSummary: "Firefox on Linux",
        time: new Date("2025-01-06T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).not.toMatch(/Location:/);
    expect(result.text).not.toMatch(/IP address/);
  });

  it("renders password change notification without ip address", () => {
    const result = renderEmailTemplate(
      "auth.password-changed",
      {
        changedAt: new Date("2025-01-04T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).not.toMatch(/IP address/);
    expect(result.text).not.toMatch(/IP address/);
  });

  it("renders session revoked notification without reason", () => {
    const result = renderEmailTemplate(
      "auth.session-revoked",
      {
        revokedAt: new Date("2025-01-07T00:00:00.000Z"),
      },
      context,
    );

    expect(result.html).not.toMatch(/Reason/);
    expect(result.text).not.toMatch(/Reason/);
  });

  it("renders two-factor setup template without backup codes", () => {
    const result = renderEmailTemplate(
      "auth.two-factor-setup",
      {
        setupUrl: "https://app.example.com/security/2fa",
      },
      context,
    );

    expect(result.html).not.toContain("Download backup codes");
    expect(result.text).not.toContain("Download backup codes");
  });

  it("lists registered email templates", () => {
    const templates = listEmailTemplates();

    expect(templates).toContain("auth.password-reset");
  });
});
