import { createConnection } from "node:net";
import { loadavg } from "node:os";
import { performance } from "node:perf_hooks";

import { Router } from "express";
import type { Router as ExpressRouter, RequestHandler } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { errorResponse, successResponse } from "../lib/response.js";
import {
  evaluateHealth,
  registerHealthCheck,
  unregisterHealthCheck,
} from "../observability/index.js";
import type { HealthCheckResult } from "../observability/index.js";

interface DependencyTarget {
  host: string;
  port: number;
  protocol: string;
}

const DEPENDENCY_CONFIG = {
  database: {
    id: "database",
    label: "PostgreSQL",
    defaultPort: 5432,
    timeoutMs: 1000,
    degradedThresholdMs: 350,
  },
  redis: {
    id: "redis",
    label: "Redis",
    defaultPort: 6379,
    timeoutMs: 750,
    degradedThresholdMs: 250,
  },
} as const;

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
};

const parseTarget = (uri: string, fallbackPort: number): DependencyTarget | undefined => {
  try {
    const parsed = new URL(uri);

    const port =
      parsed.port && parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : fallbackPort;

    if (!Number.isFinite(port)) {
      return undefined;
    }

    return {
      host: parsed.hostname,
      port,
      protocol: parsed.protocol.replace(/:$/, ""),
    };
  } catch {
    return undefined;
  }
};

const createTimeoutError = (service: string, timeoutMs: number) => {
  const error = new Error(`${service} health probe exceeded timeout of ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
};

const connectTcpNative = (target: DependencyTarget, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = createConnection({ host: target.host, port: target.port });
    let isSettled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const settle = (handler: () => void) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      try {
        handler();
      } finally {
        cleanup();
      }
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onTimeout = () => {
      settle(() => reject(createTimeoutError(target.protocol, timeoutMs)));
    };

    const onConnect = () => {
      settle(() => resolve());
    };

    socket.once("error", onError);
    socket.once("connect", onConnect);
    socket.setTimeout(timeoutMs, onTimeout);
    socket.unref?.();
  });

let connectTcp = connectTcpNative;

const setConnectTcp = (override?: typeof connectTcpNative) => {
  connectTcp = override ?? connectTcpNative;
};

const withLatencyMeasurement = async <TResult>(
  execute: () => Promise<TResult>,
): Promise<{ result: TResult; latencyMs: number }> => {
  const startedAt = performance.now();
  const result = await execute();
  const latencyMs = performance.now() - startedAt;

  return {
    result,
    latencyMs,
  };
};

const createDependencyCheck =
  (dependency: typeof DEPENDENCY_CONFIG.database | typeof DEPENDENCY_CONFIG.redis) =>
  async (uri: string): Promise<HealthCheckResult> => {
    const target = parseTarget(uri, dependency.defaultPort);

    if (!target) {
      return {
        status: "unhealthy",
        summary: `${dependency.label} configuration invalid.`,
        details: {
          uri,
        },
        severity: "error",
      };
    }

    try {
      const { latencyMs } = await withLatencyMeasurement(() =>
        connectTcp(target, dependency.timeoutMs),
      );

      const details = {
        host: target.host,
        port: target.port,
        latencyMs: Number(latencyMs.toFixed(2)),
      };

      if (latencyMs > dependency.degradedThresholdMs) {
        return {
          status: "degraded",
          summary: `${dependency.label} reachable with elevated latency.`,
          details,
          severity: "warn",
        };
      }

      return {
        status: "healthy",
        summary: `${dependency.label} reachable.`,
        details,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        summary: `${dependency.label} unreachable.`,
        details: {
          host: target.host,
          port: target.port,
          error: formatError(error),
        },
        severity: "error",
      };
    }
  };

const checkDatabaseConnectivity = createDependencyCheck(DEPENDENCY_CONFIG.database);
const checkRedisConnectivity = createDependencyCheck(DEPENDENCY_CONFIG.redis);

let activeConfig: ApplicationConfig | undefined;

onConfigChange(({ snapshot }) => {
  activeConfig = snapshot;
});

const getActiveConfig = (): ApplicationConfig => {
  if (activeConfig) {
    return activeConfig;
  }

  activeConfig = getConfig();
  return activeConfig;
};

let dependencyChecksRegistered = false;

const ensureHealthChecksRegistered = () => {
  if (dependencyChecksRegistered) {
    return;
  }

  unregisterHealthCheck(DEPENDENCY_CONFIG.database.id);
  unregisterHealthCheck(DEPENDENCY_CONFIG.redis.id);

  registerHealthCheck(DEPENDENCY_CONFIG.database.id, async () => {
    const config = getActiveConfig();
    return checkDatabaseConnectivity(config.database.url);
  });

  registerHealthCheck(DEPENDENCY_CONFIG.redis.id, async () => {
    const config = getActiveConfig();
    return checkRedisConnectivity(config.cache.redisUrl);
  });

  dependencyChecksRegistered = true;
};

const roundTo = (value: number, precision: number) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const resetInternalState = () => {
  dependencyChecksRegistered = false;
  activeConfig = undefined;
  setConnectTcp();
};

const captureProcessMetrics = () => {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();

  const memoryMetrics: Record<string, number> = {};
  Object.entries(memory).forEach(([segment, value]) => {
    // eslint-disable-next-line security/detect-object-injection -- Keys originate from Node.js process memory usage snapshot.
    memoryMetrics[segment] = value;
  });

  return {
    memory: memoryMetrics,
    cpu: {
      userMs: roundTo(cpu.user / 1000, 2),
      systemMs: roundTo(cpu.system / 1000, 2),
    },
    load: {
      averages: loadavg(),
    },
  };
};

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Retrieve comprehensive service health
 *     description: >
 *       Aggregates component health checks, latency measurements, and process diagnostics to
 *       provide a production-grade snapshot of the service state.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Service health snapshot available.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthComprehensiveResponse'
 *       '500':
 *         description: Failed to evaluate health checks or collect metrics.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Evaluates dependency health to determine whether the service can accept traffic.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Service is ready to accept traffic.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthReadinessResponse'
 *       '503':
 *         description: One or more dependencies are unhealthy; traffic should not yet be routed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 * /api/v1/health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Lightweight probe used by orchestrators to confirm the process is responsive.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Service process is healthy and responsive.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthLivenessResponse'
 */
const createComprehensiveHealthHandler = (
  configResolver: () => ApplicationConfig,
): RequestHandler =>
  asyncHandler(async (_req, res) => {
    const startedAt = performance.now();
    const snapshot = await evaluateHealth();
    const metrics = captureProcessMetrics();
    const responseTimeMs = performance.now() - startedAt;
    const config = configResolver();

    res.status(200).json(
      successResponse(
        {
          status: snapshot.status,
          uptimeSeconds: snapshot.uptimeSeconds,
          responseTimeMs: Number(responseTimeMs.toFixed(2)),
          timestamp: new Date().toISOString(),
          components: snapshot.components,
          metrics,
        },
        {
          environment: config.app.environment,
          service: config.app.name,
          check: "comprehensive",
        },
      ),
    );
  });

const createReadinessHandler = (configResolver: () => ApplicationConfig): RequestHandler =>
  asyncHandler(async (_req, res) => {
    const snapshot = await evaluateHealth();
    const config = configResolver();
    const isHealthy = snapshot.status === "healthy";

    if (!isHealthy) {
      res.status(503).json(
        errorResponse(
          {
            code: "SERVICE_NOT_READY",
            message: "Service dependencies are not fully healthy.",
            details: {
              status: snapshot.status,
              components: snapshot.components,
            },
          },
          {
            environment: config.app.environment,
            service: config.app.name,
            check: "readiness",
          },
        ),
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          status: snapshot.status,
          timestamp: new Date().toISOString(),
        },
        {
          environment: config.app.environment,
          service: config.app.name,
          check: "readiness",
        },
      ),
    );
  });

const createLivenessHandler =
  (configResolver: () => ApplicationConfig): RequestHandler =>
  (_req, res) => {
    const config = configResolver();
    res.status(200).json(
      successResponse(
        {
          status: "healthy",
          uptimeSeconds: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        {
          environment: config.app.environment,
          service: config.app.name,
          check: "liveness",
        },
      ),
    );
  };

interface HealthRouterOptions {
  registerRoute?: (method: string, path: string) => void;
}

const registerHealthRoute = (
  registerRoute: ((method: string, path: string) => void) | undefined,
  method: string,
  path: string,
) => {
  registerRoute?.(method, path);
};

export const createHealthRouter = (
  config: ApplicationConfig,
  options: HealthRouterOptions = {},
): ExpressRouter => {
  activeConfig = config;
  ensureHealthChecksRegistered();

  const resolveConfig = () => activeConfig ?? getActiveConfig();

  const router = Router();
  router.get("/health", createComprehensiveHealthHandler(resolveConfig));
  registerHealthRoute(options.registerRoute, "GET", "/health");

  router.get("/health/ready", createReadinessHandler(resolveConfig));
  registerHealthRoute(options.registerRoute, "GET", "/health/ready");

  router.get("/health/live", createLivenessHandler(resolveConfig));
  registerHealthRoute(options.registerRoute, "GET", "/health/live");

  return router;
};

export const testingHarness = {
  formatError,
  parseTarget,
  createDependencyCheck,
  dependencyConfig: DEPENDENCY_CONFIG,
  setConnectTcp,
  resetConnectTcp: () => setConnectTcp(),
  createTimeoutError,
  resetState: resetInternalState,
};
