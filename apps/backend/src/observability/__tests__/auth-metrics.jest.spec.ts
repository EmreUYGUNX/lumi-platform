import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { logger } from "@/lib/logger.js";
import {
  authMetricsInternals,
  recordAccountLockout,
  recordLoginFailure,
  recordLoginSuccess,
  recordPasswordReset,
  recordPermissionViolation,
  recordRegistration,
  recordSessionRevoked,
  recordTokenRefresh,
} from "@/observability/auth-metrics.js";
import * as metricsModule from "@/observability/metrics.js";

interface MetricCounter {
  get: () => Promise<{
    values: {
      value: number;
      labels?: Record<string, unknown>;
    }[];
  }>;
  reset: () => void;
}

const selectValue = async (
  counter: MetricCounter,
  labels: Record<string, string>,
): Promise<number> => {
  const metric = await counter.get();
  const match = metric.values.find((entry) =>
    Object.entries(labels).every(([key, value]) => entry.labels?.[key] === value),
  );

  return match?.value ?? 0;
};

const resetCounters = () => {
  authMetricsInternals.loginSuccessCounter.reset();
  authMetricsInternals.loginFailureCounter.reset();
  authMetricsInternals.registrationCounter.reset();
  authMetricsInternals.passwordResetCounter.reset();
  authMetricsInternals.tokenRefreshCounter.reset();
  authMetricsInternals.accountLockoutCounter.reset();
  authMetricsInternals.sessionRevokedCounter.reset();
  authMetricsInternals.permissionViolationCounter.reset();
};

describe("auth-metrics", () => {
  beforeEach(() => {
    resetCounters();
  });

  it("records login successes by method", async () => {
    recordLoginSuccess("Password");
    await expect(
      selectValue(authMetricsInternals.loginSuccessCounter, { method: "password" }),
    ).resolves.toBe(1);
  });

  it("records login failures by reason", async () => {
    recordLoginFailure("Invalid_Credentials");
    recordLoginFailure("invalid_credentials");

    await expect(
      selectValue(authMetricsInternals.loginFailureCounter, { reason: "invalid_credentials" }),
    ).resolves.toBe(2);
  });

  it("records registrations by method", async () => {
    recordRegistration("Email_Password");
    await expect(
      selectValue(authMetricsInternals.registrationCounter, { method: "email_password" }),
    ).resolves.toBe(1);
  });

  it("records password reset stages", async () => {
    recordPasswordReset("requested");
    recordPasswordReset("Completed");
    recordPasswordReset(undefined as unknown as string);

    await expect(
      selectValue(authMetricsInternals.passwordResetCounter, { stage: "requested" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.passwordResetCounter, { stage: "completed" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.passwordResetCounter, { stage: "unknown" }),
    ).resolves.toBe(1);
  });

  it("records token refresh outcomes", async () => {
    recordTokenRefresh("success");
    recordTokenRefresh("replay_detected");

    await expect(
      selectValue(authMetricsInternals.tokenRefreshCounter, { status: "success" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.tokenRefreshCounter, { status: "replay_detected" }),
    ).resolves.toBe(1);
  });

  it("records account lockouts", async () => {
    recordAccountLockout("Failed_Login");
    await expect(
      selectValue(authMetricsInternals.accountLockoutCounter, { reason: "failed_login" }),
    ).resolves.toBe(1);
  });

  it("records session revocations with count", async () => {
    recordSessionRevoked("bulk_logout", 3);
    await expect(
      selectValue(authMetricsInternals.sessionRevokedCounter, { reason: "bulk_logout" }),
    ).resolves.toBe(3);
  });

  it("records permission violations", async () => {
    recordPermissionViolation("Role");
    recordPermissionViolation();
    await expect(
      selectValue(authMetricsInternals.permissionViolationCounter, { type: "role" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.permissionViolationCounter, { type: "unknown" }),
    ).resolves.toBe(1);
  });

  it("skips recording when metrics collection is disabled", async () => {
    const metricsSpy = jest
      .spyOn(metricsModule, "isMetricsCollectionEnabled")
      .mockReturnValue(false);
    try {
      recordLoginSuccess("sso");
      recordLoginFailure("invalid");
      recordPermissionViolation("test");

      await expect(
        selectValue(authMetricsInternals.loginSuccessCounter, { method: "sso" }),
      ).resolves.toBe(0);
      await expect(
        selectValue(authMetricsInternals.loginFailureCounter, { reason: "invalid" }),
      ).resolves.toBe(0);
      await expect(
        selectValue(authMetricsInternals.permissionViolationCounter, { type: "test" }),
      ).resolves.toBe(0);
    } finally {
      metricsSpy.mockRestore();
    }
  });

  it("logs and continues when counter updates fail", () => {
    const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => logger);
    const labelsSpy = jest
      .spyOn(authMetricsInternals.loginSuccessCounter, "labels")
      .mockImplementation(() => {
        throw new Error("metric unavailable");
      });

    recordLoginSuccess("password");

    expect(debugSpy).toHaveBeenCalledWith(
      "Failed to increment authentication counter",
      expect.objectContaining({
        metric: "login_success_total",
        label: "password",
      }),
    );

    labelsSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it("normalises undefined and blank labels to their defaults", async () => {
    recordLoginSuccess("   ");
    recordAccountLockout("");

    await expect(
      selectValue(authMetricsInternals.loginSuccessCounter, { method: "password" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.accountLockoutCounter, { reason: "unknown" }),
    ).resolves.toBe(1);
  });

  it("uses default labels when optional parameters are omitted", async () => {
    recordLoginSuccess();
    recordLoginFailure();
    recordRegistration();
    recordTokenRefresh();
    recordSessionRevoked();

    await expect(
      selectValue(authMetricsInternals.loginSuccessCounter, { method: "password" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.loginFailureCounter, { reason: "unknown" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.registrationCounter, { method: "email_password" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.tokenRefreshCounter, { status: "success" }),
    ).resolves.toBe(1);
    await expect(
      selectValue(authMetricsInternals.sessionRevokedCounter, { reason: "unknown" }),
    ).resolves.toBe(1);
  });
});
