import * as Sentry from "@sentry/node";
import { httpIntegration, linkedErrorsIntegration } from "@sentry/node";
import type { Scope } from "@sentry/node";
import type { Request, RequestHandler, Response } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";
import { logger } from "./logger.js";

type RequestLifecycle = "finish" | "close" | "error";

let sentryActive = false;
let activeDsn: string | undefined;

const shutdownSentry = async () => {
  if (!sentryActive) {
    return;
  }

  try {
    await Sentry.close(2000);
  } catch (error) {
    logger.warn("Failed to flush Sentry events on shutdown", { error });
  } finally {
    sentryActive = false;
    activeDsn = undefined;
  }
};

const configureStaticScope = (config: ApplicationConfig) => {
  Sentry.setTag("service", config.app.name);
  Sentry.setTag("environment", config.app.environment);
};

const initialiseClient = async (config: ApplicationConfig) => {
  const { sentryDsn } = config.observability;

  if (!sentryDsn) {
    await shutdownSentry();
    return;
  }

  if (activeDsn && activeDsn === sentryDsn) {
    configureStaticScope(config);
    sentryActive = true;
    return;
  }

  if (sentryActive) {
    await shutdownSentry();
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: config.app.environment,
    release: process.env.GIT_SHA,
    tracesSampleRate: config.app.environment === "production" ? 0.2 : 0.01,
    integrations: [httpIntegration(), linkedErrorsIntegration()],
    maxBreadcrumbs: 50,
  });

  configureStaticScope(config);

  sentryActive = true;
  activeDsn = sentryDsn;

  logger.info("Sentry telemetry initialised", {
    environment: config.app.environment,
    release: process.env.GIT_SHA,
  });
};

export const initializeSentry = async (config: ApplicationConfig = getConfig()): Promise<void> => {
  await initialiseClient(config);
};

const resolveRequestId = (req: Request, res: Response): string | undefined =>
  (req.id as string | undefined) ?? (res.locals.requestId as string | undefined);

const addRequestBreadcrumb = (req: Request, res: Response, event: RequestLifecycle) => {
  if (!sentryActive) {
    return;
  }

  Sentry.addBreadcrumb({
    category: "http",
    message: `${req.method} ${req.originalUrl ?? req.url}`,
    level: "info",
    data: {
      statusCode: res.statusCode,
      lifecycle: event,
      requestId: resolveRequestId(req, res),
    },
  });
};

interface ScopeSnapshot {
  user: ReturnType<Scope["getUser"]>;
  requestContext?: Record<string, unknown>;
}

const snapshotScope = (scope: Scope | undefined): ScopeSnapshot | undefined => {
  if (!scope) {
    return undefined;
  }

  return {
    user: scope.getUser(),
    requestContext: scope.getScopeData().contexts?.request as Record<string, unknown> | undefined,
  };
};

const restoreScope = (scope: Scope | undefined, snapshot: ScopeSnapshot | undefined) => {
  if (!scope || !snapshot) {
    return;
  }

  if (snapshot.user) {
    scope.setUser(snapshot.user);
  } else {
    // eslint-disable-next-line unicorn/no-null -- Sentry expects an explicit null to clear user context.
    scope.setUser(null);
  }

  if (snapshot.requestContext) {
    scope.setContext("request", snapshot.requestContext);
  } else {
    // eslint-disable-next-line unicorn/no-null -- Sentry expects an explicit null to clear scoped context.
    scope.setContext("request", null);
  }
};

export const createSentryRequestMiddleware = (): RequestHandler => {
  return (req, res, next) => {
    if (!sentryActive) {
      next();
      return;
    }

    const scope = Sentry.getCurrentScope();
    const snapshot = snapshotScope(scope);

    if (scope) {
      const requestId = resolveRequestId(req, res);
      scope.setContext("request", {
        method: req.method,
        path: req.originalUrl ?? req.url,
        userAgent: req.get("user-agent") ?? "unknown",
        ip: req.ip,
        requestId,
      });
    }

    let cleanedUp = false;

    const finalize = (event: RequestLifecycle, error?: unknown) => {
      if (!sentryActive || cleanedUp) {
        return;
      }

      addRequestBreadcrumb(req, res, event);

      if (error) {
        Sentry.captureException(error);
      }

      restoreScope(scope, snapshot);

      cleanedUp = true;
    };

    res.once("finish", () => finalize("finish"));
    res.once("close", () => finalize("close"));
    res.once("error", (error) => finalize("error", error));

    next();
  };
};

export interface SentryUserContext {
  id?: string;
  email?: string;
  username?: string;
  role?: string;
  roles?: string[];
}

export const setSentryUser = (user?: SentryUserContext | null): void => {
  if (!sentryActive) {
    return;
  }

  if (!user) {
    // eslint-disable-next-line unicorn/no-null -- Sentry expects null to clear the active user.
    Sentry.setUser(null);
    Sentry.setTag("user_role", "unauthenticated");
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });

  const primaryRole = user.role ?? user.roles?.[0];
  if (primaryRole) {
    Sentry.setTag("user_role", primaryRole);
  }
};

export const isSentryEnabled = (): boolean => sentryActive;

export const getSentryInstance = () => Sentry;

onConfigChange(({ snapshot }) => {
  initialiseClient(snapshot).catch((error: unknown) => {
    logger.error("Failed to refresh Sentry configuration", { error });
  });
});
