import type { NextFunction, Request, RequestHandler, Response } from "express";

import { isMetricsCollectionEnabled, observeHttpRequest } from "../observability/index.js";

type CompletionEvent = "finish" | "close" | "error";

const COMPLETION_EVENTS: CompletionEvent[] = ["finish", "close", "error"];
const FALLBACK_ROUTE = "unmatched";

const normaliseMethod = (method: unknown): string => {
  if (typeof method === "string" && method.length > 0) {
    return method.toUpperCase();
  }

  return "UNKNOWN";
};

const normaliseStatus = (statusCode: number): string => {
  if (Number.isInteger(statusCode) && statusCode > 0) {
    return String(statusCode);
  }

  return "0";
};

const extractRoute = (req: Request): string => {
  const { baseUrl } = req;
  const rawRoute = req.route?.path;

  if (typeof rawRoute === "string" && rawRoute.length > 0) {
    return baseUrl ? `${baseUrl}${rawRoute}` : rawRoute;
  }

  if (typeof req.path === "string" && req.path.length > 0) {
    return req.path;
  }

  const original = typeof req.originalUrl === "string" ? req.originalUrl.split("?")[0] : undefined;
  return original && original.length > 0 ? original : FALLBACK_ROUTE;
};

const toSeconds = (durationNs: bigint): number => {
  const seconds = Number(durationNs) / 1_000_000_000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
};

const createCompletionHandler = (req: Request, res: Response, start: bigint) => {
  let hasRecorded = false;

  return () => {
    if (hasRecorded) {
      return;
    }

    hasRecorded = true;
    const durationSeconds = toSeconds(process.hrtime.bigint() - start);

    const method = normaliseMethod(req.method);
    const route = extractRoute(req);
    const status = normaliseStatus(res.statusCode);

    observeHttpRequest(
      {
        method,
        route,
        status,
      },
      durationSeconds,
    );
  };
};

export const createMetricsMiddleware = (): RequestHandler => {
  if (!isMetricsCollectionEnabled()) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (!isMetricsCollectionEnabled()) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    const finalise = createCompletionHandler(req, res, start);

    COMPLETION_EVENTS.forEach((event) => {
      res.once(event, finalise);
    });

    next();
  };
};
