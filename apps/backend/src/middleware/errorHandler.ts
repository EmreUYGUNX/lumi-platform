import type {
  ErrorRequestHandler,
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import type { ApplicationConfig } from "@lumi/types";

import type { AppError, ErrorDetails } from "../lib/errors.js";
import {
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  isAppError,
  normaliseUnknownError,
} from "../lib/errors.js";
import { logger, mergeRequestContext } from "../lib/logger.js";
import {
  buildRequestPath,
  getAllowedMethodsForPath,
  getRouteRegistry,
} from "../routes/registry.js";

type SerializedDetails = Record<string, unknown>;

interface ErrorPayload {
  code: string;
  message: string;
  details?: SerializedDetails;
  stack?: string;
}

interface ErrorResponse {
  success: false;
  error: ErrorPayload;
  meta?: Record<string, unknown>;
}

const serialiseDetails = (details?: ErrorDetails): SerializedDetails | undefined => {
  if (!details) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(details)) as SerializedDetails;
  } catch {
    return undefined;
  }
};

const buildMeta = (req: Request, config: ApplicationConfig): Record<string, unknown> => {
  const meta: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: config.app.environment,
  };

  if (req.id) {
    meta.requestId = req.id;
    meta.correlationId = req.id;
  }

  if (req.originalUrl) {
    meta.path = req.originalUrl;
  }

  return meta;
};

const buildErrorResponse = (
  req: Request,
  config: ApplicationConfig,
  error: AppError,
  includeStack: boolean,
): ErrorResponse => {
  const payload: ErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
    meta: buildMeta(req, config),
  };

  if (error.exposeDetails) {
    payload.error.details = serialiseDetails(error.details);
  }

  if (includeStack && error.stack) {
    payload.error.stack = error.stack;
  }

  return payload;
};

export type ExpressErrorMiddleware = RequestHandler | ErrorRequestHandler;

const determineLogLevel = (statusCode: number): "warn" | "error" => {
  if (statusCode >= 500) {
    return "error";
  }

  return "warn";
};

const resolveActiveConfig = (req: Request, fallback: ApplicationConfig): ApplicationConfig => {
  const localsConfig = req.app?.locals?.config as ApplicationConfig | undefined;
  return localsConfig ?? fallback;
};

const ERROR_HANDLER_REFRESH_FLAG = "__errorHandlerAutoRefreshAttached";

export const attachErrorHandlerAutoRefresh = (app: Express, refresh: () => void): void => {
  if (app.get(ERROR_HANDLER_REFRESH_FLAG)) {
    return;
  }

  const hasRegisteredHandlers = (): boolean => {
    const storedLayers = app.get("errorHandlerLayers") as ExpressErrorMiddleware[] | undefined;
    return Boolean(storedLayers?.length);
  };

  const invokeRefresh = (): void => {
    if (hasRegisteredHandlers()) {
      refresh();
    }
  };

  const targetApp = app;

  const originalUse = targetApp.use.bind(targetApp);
  targetApp.use = ((...args: Parameters<typeof originalUse>) => {
    const result = originalUse(...args);
    invokeRefresh();
    return result;
  }) as typeof app.use;

  const routeMethods = ["all", "delete", "get", "head", "options", "patch", "post", "put"] as const;

  routeMethods.forEach((method) => {
    type PatchableApp = Record<typeof method, (...args: unknown[]) => unknown>;
    const methodCollection = targetApp as unknown as PatchableApp;

    // eslint-disable-next-line security/detect-object-injection -- `method` originates from the fixed `routeMethods` tuple.
    const originalMethod = methodCollection[method].bind(targetApp);

    // eslint-disable-next-line security/detect-object-injection -- `method` originates from the fixed `routeMethods` tuple.
    methodCollection[method] = (...args: unknown[]) => {
      const result = originalMethod(...args);
      if (!(method === "get" && args.length === 1)) {
        invokeRefresh();
      }
      return result;
    };
  });

  targetApp.set(ERROR_HANDLER_REFRESH_FLAG, true);
};

interface RouterStack {
  stack: {
    handle?: RequestHandler | ErrorRequestHandler;
    route?: unknown;
  }[];
}

export const resolveRouter = (app: Express): RouterStack | undefined => {
  const directRouter = Reflect.get(app, "_router") as RouterStack | undefined;
  if (directRouter?.stack) {
    return directRouter;
  }

  const legacyRouter = (app as unknown as { router?: RouterStack }).router;
  if (legacyRouter?.stack) {
    return legacyRouter;
  }

  return undefined;
};

const createMethodNotAllowedHandler =
  (config: ApplicationConfig): RequestHandler =>
  (req, res, next) => {
    const registry = req.app ? getRouteRegistry(req.app) : undefined;
    if (!registry) {
      next();
      return;
    }

    const requestPath = buildRequestPath(req.baseUrl, req.path);
    const allowedMethods = getAllowedMethodsForPath(registry, requestPath).filter(
      (method) => method !== req.method.toUpperCase(),
    );
    if (allowedMethods.includes("GET") && !allowedMethods.includes("HEAD")) {
      allowedMethods.push("HEAD");
    }

    if (allowedMethods.length === 0) {
      next();
      return;
    }

    const error = new MethodNotAllowedError();
    if (res.headersSent) {
      next(error);
      return;
    }

    mergeRequestContext({ requestId: req.id, correlationId: req.id });

    res.setHeader("Allow", allowedMethods.join(", "));
    logger.warn("Method not allowed", {
      method: req.method,
      path: req.originalUrl,
      allowedMethods,
      requestId: req.id,
    });

    const activeConfig = resolveActiveConfig(req, config);

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          allowedMethods,
        },
      },
      meta: buildMeta(req, activeConfig),
    });
  };

const createNotFoundHandler =
  (config: ApplicationConfig): RequestHandler =>
  (req, res) => {
    const registry = req.app ? getRouteRegistry(req.app) : undefined;
    const requestPath = buildRequestPath(req.baseUrl, req.path);
    const knownMethods = registry ? getAllowedMethodsForPath(registry, requestPath) : [];
    const error = new NotFoundError();

    mergeRequestContext({ requestId: req.id, correlationId: req.id });

    logger.warn("Route not found", {
      method: req.method,
      path: req.originalUrl,
      requestId: req.id,
    });

    const activeConfig = resolveActiveConfig(req, config);

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(knownMethods.length > 0 ? { details: { allowedMethods: knownMethods } } : {}),
      },
      meta: buildMeta(req, activeConfig),
    });
  };

const createGlobalErrorHandler =
  (config: ApplicationConfig) =>
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    mergeRequestContext({ requestId: req.id, correlationId: req.id });
    const activeConfig = resolveActiveConfig(req, config);

    let resolvedError: AppError;

    if (isAppError(err)) {
      resolvedError = err;
    } else if (err instanceof Error) {
      resolvedError = new InternalServerError(undefined, { cause: err });
    } else {
      const normalised = normaliseUnknownError(err);
      resolvedError = new InternalServerError(undefined, { cause: normalised });
    }

    const statusCode = resolvedError.statusCode ?? 500;
    const includeStack = activeConfig.app.environment === "development";
    const logLevel = determineLogLevel(statusCode);

    const payload = buildErrorResponse(req, activeConfig, resolvedError, includeStack);

    const logMetadata = {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      requestId: req.id,
      error: {
        name: resolvedError.name,
        message: resolvedError.message,
        code: resolvedError.code,
        stack: includeStack ? resolvedError.stack : undefined,
      },
    };

    if (resolvedError.cause) {
      // eslint-disable-next-line security/detect-object-injection -- `cause` comes from controlled error construction.
      (logMetadata.error as Record<string, unknown>).cause = resolvedError.cause;
    }

    if (logLevel === "error") {
      logger.error("Unhandled error processed by global error handler", logMetadata);
    } else {
      logger.warn("Operational error processed by global error handler", logMetadata);
    }

    res.status(statusCode).json(payload);
  };

export const registerErrorHandlers = (
  app: Express,
  config: ApplicationConfig,
): ExpressErrorMiddleware[] => {
  const handlers: ExpressErrorMiddleware[] = [
    createMethodNotAllowedHandler(config),
    createNotFoundHandler(config),
    createGlobalErrorHandler(config),
  ];

  const initialRouter = resolveRouter(app);
  const routerBeforeLength = initialRouter?.stack?.length ?? 0;
  handlers.forEach((handler) => {
    app.use(handler);
  });

  const router = resolveRouter(app);
  const addedLayers = router?.stack?.slice(routerBeforeLength) ?? [];

  app.set("errorHandlers", handlers);
  app.set("errorHandlerLayers", addedLayers);

  return handlers;
};
