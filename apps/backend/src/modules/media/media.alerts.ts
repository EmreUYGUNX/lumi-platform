/* istanbul ignore file -- alert fan-out relies on Sentry side-effects */
import { getSentryInstance, isSentryEnabled } from "@/observability/index.js";

type SentryLevel = "fatal" | "error" | "warning" | "info";

const captureMediaAlert = (
  type: string,
  level: SentryLevel,
  details: Record<string, unknown>,
  message?: string,
): void => {
  if (!isSentryEnabled()) {
    return;
  }

  try {
    const sentry = getSentryInstance();
    sentry.withScope((scope) => {
      scope.setLevel(level);
      scope.setTag("media_event_type", type);
      scope.setContext("media_event", details);
      if (typeof details.userId === "string") {
        scope.setUser({ id: details.userId });
      }
      sentry.captureMessage(message ?? `Media event: ${type}`, level);
    });
  } catch {
    // Never throw inside alert helpers; failures are logged by upstream callers.
  }
};

export interface MediaUploadFailureAlert {
  fileName?: string;
  folder: string;
  status?: number;
  code?: string;
  userId?: string;
  bytes?: number;
  errorMessage?: string;
}

export const reportMediaUploadFailure = (details: MediaUploadFailureAlert): void => {
  captureMediaAlert(
    "upload.failure",
    details.status && details.status >= 500 ? "error" : "warning",
    {
      ...details,
      severity: details.status && details.status >= 500 ? "error" : "warn",
    },
    "Media upload failure detected",
  );
};

export interface MediaCloudinaryErrorAlert extends Record<string, unknown> {
  operation: string;
  publicId?: string;
  folder?: string | null;
  errorMessage?: string;
}

export const reportMediaCloudinaryError = (details: MediaCloudinaryErrorAlert): void => {
  captureMediaAlert("cloudinary.error", "error", details, `Cloudinary ${details.operation} error`);
};

export interface MediaWebhookFailureAlert {
  jobId?: string;
  eventId?: string;
  attempt?: number;
  eventType?: string;
  errorMessage?: string;
}

export const reportMediaWebhookFailure = (details: MediaWebhookFailureAlert): void => {
  captureMediaAlert(
    "webhook.failure",
    "error",
    {
      ...details,
      severity: "error",
    },
    "Cloudinary webhook processing failure",
  );
};
