import type { Counter as PromCounter } from "prom-client";

import { logger } from "../lib/logger.js";
import { createCounter, isMetricsCollectionEnabled } from "./metrics.js";

type LoginMethod = string | undefined;
type LoginFailureReason = string | undefined;
type RegistrationMethod = string | undefined;
type PasswordResetStage = "requested" | "completed" | string;
type TokenRefreshStatus = "success" | "replay_detected" | string;
type AccountLockoutReason = string | undefined;
type SessionRevocationReason = string | undefined;
type PermissionViolationType = string | undefined;

const DEFAULT_LABEL_UNKNOWN = "unknown";

const normaliseLabel = (value: string | undefined, fallback = DEFAULT_LABEL_UNKNOWN): string => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  return trimmed.toLowerCase();
};

const loginSuccessCounter = createCounter({
  name: "login_success_total",
  help: "Counts successful user login attempts partitioned by authentication method.",
  labelNames: ["method"],
});

const loginFailureCounter = createCounter({
  name: "login_failure_total",
  help: "Counts failed user login attempts partitioned by failure reason.",
  labelNames: ["reason"],
});

const registrationCounter = createCounter({
  name: "registration_total",
  help: "Counts successful user registrations partitioned by registration method.",
  labelNames: ["method"],
});

const passwordResetCounter = createCounter({
  name: "password_reset_total",
  help: "Counts password reset events partitioned by stage.",
  labelNames: ["stage"],
});

const tokenRefreshCounter = createCounter({
  name: "token_refresh_total",
  help: "Counts refresh token operations partitioned by status.",
  labelNames: ["status"],
});

const accountLockoutCounter = createCounter({
  name: "account_lockout_total",
  help: "Counts account lockouts partitioned by reason.",
  labelNames: ["reason"],
});

const sessionRevokedCounter = createCounter({
  name: "session_revoked_total",
  help: "Counts revoked authentication sessions partitioned by reason.",
  labelNames: ["reason"],
});

const permissionViolationCounter = createCounter({
  name: "permission_violation_total",
  help: "Counts authorization denials partitioned by violation type.",
  labelNames: ["type"],
});

const incrementCounter = (
  counter: PromCounter<string>,
  metricName: string,
  label: string,
  value = 1,
) => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  try {
    counter.labels(label).inc(value);
  } catch (error) {
    logger.debug("Failed to increment authentication counter", {
      metric: metricName,
      label,
      value,
      error,
    });
  }
};

export const recordLoginSuccess = (method: LoginMethod = "password"): void => {
  incrementCounter(loginSuccessCounter, "login_success_total", normaliseLabel(method, "password"));
};

export const recordLoginFailure = (reason: LoginFailureReason = DEFAULT_LABEL_UNKNOWN): void => {
  incrementCounter(loginFailureCounter, "login_failure_total", normaliseLabel(reason));
};

export const recordRegistration = (method: RegistrationMethod = "email_password"): void => {
  incrementCounter(
    registrationCounter,
    "registration_total",
    normaliseLabel(method, "email_password"),
  );
};

export const recordPasswordReset = (stage: PasswordResetStage): void => {
  incrementCounter(passwordResetCounter, "password_reset_total", normaliseLabel(stage));
};

export const recordTokenRefresh = (status: TokenRefreshStatus = "success"): void => {
  incrementCounter(tokenRefreshCounter, "token_refresh_total", normaliseLabel(status));
};

export const recordAccountLockout = (
  reason: AccountLockoutReason = DEFAULT_LABEL_UNKNOWN,
): void => {
  incrementCounter(accountLockoutCounter, "account_lockout_total", normaliseLabel(reason));
};

export const recordSessionRevoked = (
  reason: SessionRevocationReason = DEFAULT_LABEL_UNKNOWN,
  count = 1,
): void => {
  incrementCounter(sessionRevokedCounter, "session_revoked_total", normaliseLabel(reason), count);
};

export const recordPermissionViolation = (
  type: PermissionViolationType = DEFAULT_LABEL_UNKNOWN,
): void => {
  incrementCounter(permissionViolationCounter, "permission_violation_total", normaliseLabel(type));
};

export const authMetricsInternals = {
  get loginSuccessCounter() {
    return loginSuccessCounter;
  },
  get loginFailureCounter() {
    return loginFailureCounter;
  },
  get registrationCounter() {
    return registrationCounter;
  },
  get passwordResetCounter() {
    return passwordResetCounter;
  },
  get tokenRefreshCounter() {
    return tokenRefreshCounter;
  },
  get accountLockoutCounter() {
    return accountLockoutCounter;
  },
  get sessionRevokedCounter() {
    return sessionRevokedCounter;
  },
  get permissionViolationCounter() {
    return permissionViolationCounter;
  },
};
