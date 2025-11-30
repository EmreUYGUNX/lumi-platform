/* eslint-disable import/order */

import * as Sentry from "@sentry/nextjs";
import type { NextWebVitalsMetric } from "next/app";

import { env } from "@/lib/env";

const SENTRY_DSN = env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;

let initialized = false;

const ensureSentry = (): boolean => {
  if (initialized) {
    return true;
  }

  if (!SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: Boolean(SENTRY_DSN),
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 0.1,
    attachStacktrace: true,
  });

  initialized = true;
  return true;
};

const withSentry = (): boolean => ensureSentry();

const applyScope =
  (tags?: Record<string, string | undefined>, extra?: Record<string, unknown>) =>
  (scope: Sentry.Scope): void => {
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined) {
          scope.setTag(key, value);
        }
      });
    }
    if (extra) {
      scope.setExtras(extra);
    }
  };

export const setSentryUser = (user?: { id?: string; email?: string } | null): void => {
  if (!withSentry()) return;
  // eslint-disable-next-line unicorn/no-null -- Sentry API expects null to clear user context
  Sentry.setUser(user ? { id: user.id, email: user.email } : null);
};

export const setSentryTags = (tags: Record<string, string | undefined>): void => {
  if (!withSentry()) return;
  Object.entries(tags).forEach(([key, value]) => {
    if (value !== undefined) {
      Sentry.setTag(key, value);
    }
  });
};

export const addSentryBreadcrumb = (
  message: string,
  data?: Record<string, unknown>,
  category?: string,
): void => {
  if (!withSentry()) return;
  Sentry.addBreadcrumb({
    message,
    category,
    data,
  });
};

export const captureException = (
  error: unknown,
  context?: {
    tags?: Record<string, string | undefined>;
    extra?: Record<string, unknown>;
    hint?: unknown;
  },
): void => {
  if (!withSentry()) return;
  const serializableError =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

  Sentry.withScope((scope) => {
    applyScope(context?.tags, context?.extra)(scope);
    Sentry.captureException(serializableError);
  });
};

export const captureMessage = (
  message: string,
  context?: { tags?: Record<string, string | undefined>; extra?: Record<string, unknown> },
  level: Sentry.SeverityLevel = "warning",
): void => {
  if (!withSentry()) return;
  Sentry.withScope((scope) => {
    applyScope(context?.tags, context?.extra)(scope);
    Sentry.captureMessage(message, level);
  });
};

export const captureApiError = (
  error: unknown,
  context: {
    path: string;
    method?: string;
    status?: number;
    code?: string;
    feature?: string;
    attempt?: number;
  },
): void => {
  const { status } = context;
  if (typeof status === "number" && status < 500) {
    return;
  }

  captureException(error, {
    tags: {
      route: context.path,
      method: context.method,
      feature: context.feature,
      status: status?.toString(),
      code: context.code,
      source: "api-client",
    },
    extra: {
      attempt: context.attempt,
    },
  });
};

type ExtendedWebVital = NextWebVitalsMetric & {
  rating?: "good" | "needs-improvement" | "poor";
  delta?: number;
  navigationType?: string;
};

export const captureWebVital = (metric: NextWebVitalsMetric): void => {
  if (!withSentry()) return;
  const extended = metric as ExtendedWebVital;
  const rating = extended.rating ?? "unknown";
  const delta = extended.delta ?? 0;
  if (rating === "good") return;

  Sentry.captureEvent({
    message: `Web Vital ${metric.name}`,
    level: rating === "poor" ? "error" : "warning",
    tags: {
      metric: metric.name,
      rating,
    },
    extra: {
      value: metric.value,
      delta,
      id: metric.id,
      navigationType: extended.navigationType,
    },
  });
};
