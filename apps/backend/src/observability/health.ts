import type { AlertSeverityLevel } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";
import { logger } from "../lib/logger.js";
import { recordUptimeNow } from "./metrics.js";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  summary: string;
  details?: Record<string, unknown>;
  severity?: AlertSeverityLevel;
}

export interface HealthSnapshot {
  status: HealthStatus;
  uptimeSeconds: number;
  components: Record<
    string,
    HealthCheckResult & {
      observedAt: string;
    }
  >;
}

type HealthCheck = () => Promise<HealthCheckResult> | HealthCheckResult;

const healthChecks = new Map<string, HealthCheck>();

let { uptimeGracePeriodSeconds } = getConfig().observability.health;

onConfigChange(({ snapshot }) => {
  uptimeGracePeriodSeconds = snapshot.observability.health.uptimeGracePeriodSeconds;
});

export const registerHealthCheck = (id: string, check: HealthCheck): void => {
  healthChecks.set(id, check);
};

export const unregisterHealthCheck = (id: string): void => {
  healthChecks.delete(id);
};

const statusPriority = new Map<HealthStatus, number>([
  ["healthy", 0],
  ["degraded", 1],
  ["unhealthy", 2],
]);

const determineOverallStatus = (components: Record<string, HealthCheckResult>): HealthStatus => {
  let highestPriority = 0;

  Object.values(components).forEach((component) => {
    const currentPriority = statusPriority.get(component.status) ?? 0;
    if (currentPriority > highestPriority) {
      highestPriority = currentPriority;
    }
  });

  if (highestPriority === 0) {
    return "healthy";
  }

  if (highestPriority === 1) {
    return "degraded";
  }

  return "unhealthy";
};

const computeUptimeStatus = (): HealthCheckResult => {
  const uptimeSeconds = process.uptime();

  if (uptimeSeconds < uptimeGracePeriodSeconds) {
    return {
      status: "degraded",
      summary: "Service is within warm-up period.",
      details: {
        uptimeSeconds,
        remainingWarmupSeconds: Math.max(uptimeGracePeriodSeconds - uptimeSeconds, 0),
      },
      severity: "warn",
    };
  }

  return {
    status: "healthy",
    summary: "Service uptime healthy.",
    details: { uptimeSeconds },
  };
};

export const evaluateHealth = async (): Promise<HealthSnapshot> => {
  const components: HealthSnapshot["components"] = {};

  const entries = [...healthChecks.entries()];

  // Always include uptime component.
  entries.unshift(["uptime", computeUptimeStatus]);

  await Promise.all(
    entries.map(async ([id, check]) => {
      try {
        const result = await check();
        // eslint-disable-next-line security/detect-object-injection
        components[id] = {
          ...result,
          observedAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error("Health check failed", { id, error });
        // eslint-disable-next-line security/detect-object-injection
        components[id] = {
          status: "unhealthy",
          summary: "Health probe threw an error.",
          details: {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : { message: String(error) },
          },
          observedAt: new Date().toISOString(),
          severity: "error",
        };
      }
    }),
  );

  recordUptimeNow();

  const status = determineOverallStatus(components);

  return {
    status,
    uptimeSeconds: process.uptime(),
    components,
  };
};

export const listHealthChecks = (): string[] => [...healthChecks.keys()];
