import type { AlertSeverityLevel } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";
import { logger } from "../lib/logger.js";
import { createCounter, isMetricsCollectionEnabled } from "./metrics.js";

export interface AlertPayload {
  severity: AlertSeverityLevel;
  message: string;
  source: string;
  details?: Record<string, unknown>;
  tags?: Record<string, string>;
  triggeredAt?: string;
}

type AlertChannel = (payload: AlertPayload) => Promise<void> | void;

const severityRank = new Map<AlertSeverityLevel, number>([
  ["info", 0],
  ["warn", 1],
  ["error", 2],
  ["fatal", 3],
]);

let alertConfig = getConfig().observability.alerting;

const channels = new Map<string, AlertChannel>();

const shouldDispatch = (severity: AlertSeverityLevel): boolean => {
  const threshold =
    severityRank.get(alertConfig.severityThreshold) ?? severityRank.get("error") ?? 2;
  const current = severityRank.get(severity) ?? 0;
  return current >= threshold;
};

const DEFAULT_WEBHOOK_CHANNEL = "default-webhook";

const dispatchViaWebhook: AlertChannel = async (payload) => {
  const { webhookUrl } = alertConfig;

  if (!webhookUrl || typeof fetch !== "function") {
    logger.warn("Alert webhook dispatch skipped: webhook misconfigured or fetch unavailable", {
      enabled: alertConfig.enabled,
      hasWebhook: Boolean(webhookUrl),
    });
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        triggeredAt: payload.triggeredAt ?? new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error("Alert webhook dispatch failed", { error, webhookUrl });
  }
};

const synchroniseDefaultChannel = () => {
  if (alertConfig.enabled && alertConfig.webhookUrl) {
    channels.set(DEFAULT_WEBHOOK_CHANNEL, dispatchViaWebhook);
  } else {
    channels.delete(DEFAULT_WEBHOOK_CHANNEL);
  }
};

synchroniseDefaultChannel();

onConfigChange(({ snapshot }) => {
  alertConfig = snapshot.observability.alerting;
  synchroniseDefaultChannel();
});

const alertCounter = createCounter({
  name: "alerts_total",
  help: "Counts dispatched alerts partitioned by severity and source.",
  labelNames: ["severity", "source"],
});

export const registerAlertChannel = (name: string, handler: AlertChannel): void => {
  channels.set(name, handler);
};

export const unregisterAlertChannel = (name: string): void => {
  channels.delete(name);
};

export const listAlertChannels = (): string[] => [...channels.keys()];

export const sendAlert = async (payload: AlertPayload): Promise<void> => {
  if (!alertConfig.enabled) {
    logger.debug("Alert suppressed because alerting is disabled", { source: payload.source });
    return;
  }

  if (!shouldDispatch(payload.severity)) {
    logger.debug("Alert suppressed due to severity threshold", {
      severity: payload.severity,
      threshold: alertConfig.severityThreshold,
    });
    return;
  }

  if (channels.size === 0) {
    logger.warn("Alert dispatch skipped: no channels registered", { payload });
    return;
  }

  const enrichedPayload = {
    ...payload,
    triggeredAt: payload.triggeredAt ?? new Date().toISOString(),
  };

  if (isMetricsCollectionEnabled()) {
    alertCounter.labels(enrichedPayload.severity, enrichedPayload.source).inc();
  }

  await Promise.allSettled(
    [...channels.entries()].map(async ([name, handler]) => {
      try {
        await handler(enrichedPayload);
      } catch (error) {
        logger.error("Alert handler failed", { name, error });
      }
    }),
  );
};
