import type { RequestHandler } from "express";
import helmet from "helmet";

import type { ApplicationConfig } from "@lumi/types";

import { resolveSecurityHeaderMap } from "../security/headers.js";

const NOOP_HANDLER: RequestHandler = (_request, _response, next) => {
  next();
};

const createHelmetMiddleware = (): RequestHandler =>
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false,
    hsts: false,
    referrerPolicy: false,
    xssFilter: false,
    dnsPrefetchControl: true,
    hidePoweredBy: true,
    ieNoOpen: true,
    noSniff: false,
    originAgentCluster: true,
  });

const createSecurityHeaderSetter = (
  config: ApplicationConfig["security"]["headers"],
): RequestHandler => {
  if (!config.enabled) {
    return NOOP_HANDLER;
  }

  const headers = resolveSecurityHeaderMap(config);

  return (_request, response, next) => {
    Object.entries(headers).forEach(([header, value]) => {
      response.setHeader(header, value);
    });

    next();
  };
};

export const createSecurityMiddleware = (
  config: ApplicationConfig["security"]["headers"],
): RequestHandler[] => [createHelmetMiddleware(), createSecurityHeaderSetter(config)];
