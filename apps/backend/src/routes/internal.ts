import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { asyncHandler } from "../lib/asyncHandler.js";
import { errorResponse, successResponse } from "../lib/response.js";
import {
  evaluateHealth,
  getMetricsSnapshot,
  isMetricsCollectionEnabled,
  metricsRegistry,
} from "../observability/index.js";

const BASIC_AUTH_REALM = "Lumi Metrics";
const CACHE_CONTROL_HEADER = "no-store";

const parseBasicAuthHeader = (
  header: string | undefined,
): { username: string; password: string } | undefined => {
  let credentials: { username: string; password: string } | undefined;

  if (typeof header === "string") {
    const [scheme, encoded] = header.split(" ");

    if (scheme && scheme.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        const separatorIndex = decoded.indexOf(":");

        if (separatorIndex !== -1) {
          credentials = {
            username: decoded.slice(0, separatorIndex),
            password: decoded.slice(separatorIndex + 1),
          };
        }
      } catch {
        credentials = undefined;
      }
    }
  }

  return credentials;
};

const getActiveConfig = (req: Request, fallback: ApplicationConfig): ApplicationConfig => {
  const current = req.app?.locals?.config as ApplicationConfig | undefined;
  return current ?? fallback;
};

const createMetricsAuthMiddleware =
  (initialConfig: ApplicationConfig): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const { basicAuth } = getActiveConfig(req, initialConfig).observability.metrics;
    if (!basicAuth) {
      next();
      return;
    }

    const credentials = parseBasicAuthHeader(req.headers.authorization);
    if (
      !credentials ||
      credentials.username !== basicAuth.username ||
      credentials.password !== basicAuth.password
    ) {
      res.setHeader("WWW-Authenticate", `Basic realm="${BASIC_AUTH_REALM}", charset="UTF-8"`);
      res.status(401).json(
        errorResponse(
          {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
          {
            realm: BASIC_AUTH_REALM,
          },
        ),
      );
      return;
    }

    next();
  };

const formatUnknownError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };

const metricsHandler: RequestHandler = asyncHandler(async (_req, res) => {
  if (!isMetricsCollectionEnabled()) {
    res.status(503).json(
      errorResponse({
        code: "METRICS_DISABLED",
        message: "Metrics collection is disabled",
      }),
    );
    return;
  }

  try {
    const snapshot = await getMetricsSnapshot();
    res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);

    if (snapshot && snapshot.length > 0) {
      res.type(metricsRegistry.contentType);
      res.status(200).send(snapshot);
      return;
    }

    res.status(204).end();
  } catch (error) {
    res.status(500).json(
      errorResponse({
        code: "METRICS_SNAPSHOT_ERROR",
        message: "Failed to collect metrics snapshot",
        details: {
          error: formatUnknownError(error),
        },
      }),
    );
  }
});

const createHealthHandler = (initialConfig: ApplicationConfig): RequestHandler =>
  asyncHandler(async (req, res) => {
    try {
      const snapshot = await evaluateHealth();
      const activeConfig = getActiveConfig(req, initialConfig);
      res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);
      res.status(200).json(
        successResponse(snapshot, {
          environment: activeConfig.app.environment,
          generatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      res.status(500).json(
        errorResponse(
          {
            code: "HEALTH_EVALUATION_FAILED",
            message: "Failed to evaluate service health",
            details: {
              error: formatUnknownError(error),
            },
          },
          {
            environment: initialConfig.app.environment,
            generatedAt: new Date().toISOString(),
          },
        ),
      );
    }
  });

const normalisePath = (path: string): string => {
  if (!path || path === "/") {
    return "/metrics";
  }

  return path.startsWith("/") ? path : `/${path}`;
};

interface InternalRouterOptions {
  registerRoute?: (method: string, path: string) => void;
}

const registerInternalRoute = (
  registerRoute: ((method: string, path: string) => void) | undefined,
  method: string,
  path: string,
) => {
  registerRoute?.(method, path);
};

export const createInternalRouter = (
  config: ApplicationConfig,
  options: InternalRouterOptions = {},
): Router => {
  const router = Router();
  const metricsPath = normalisePath(config.observability.metrics.endpoint);
  const metricsAuthMiddleware = createMetricsAuthMiddleware(config);

  router.get(metricsPath, metricsAuthMiddleware, metricsHandler);
  registerInternalRoute(options.registerRoute, "GET", metricsPath);

  router.get("/health", createHealthHandler(config));
  registerInternalRoute(options.registerRoute, "GET", "/health");

  return router;
};
