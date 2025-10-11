import cors, { type CorsOptions } from "cors";
import type { RequestHandler } from "express";

import { isOriginAllowed } from "@lumi/shared";
import type { ApplicationConfig } from "@lumi/types";

import { buildCorsOptions } from "../security/cors.js";

export interface CorsMiddlewareBundle {
  middleware: RequestHandler;
  preflight: RequestHandler;
}

const NOOP_HANDLER: RequestHandler = (_request, _response, next) => {
  next();
};

const createOriginValidator = (
  config: ApplicationConfig["security"]["cors"],
): CorsOptions["origin"] => {
  const originConfig = buildCorsOptions(config);

  if (!originConfig.enabled) {
    return false;
  }

  if (originConfig.origin === "*") {
    return true;
  }

  return (origin, callback) => {
    if (!origin) {
      // eslint-disable-next-line unicorn/no-null -- Express callback expects a nullable error argument.
      callback(null, true);
      return;
    }

    if (isOriginAllowed(origin, config)) {
      // eslint-disable-next-line unicorn/no-null -- Express callback expects a nullable error argument.
      callback(null, true);
      return;
    }

    // eslint-disable-next-line unicorn/no-null -- Express callback expects a nullable error argument.
    callback(null, false);
  };
};

export const createCorsMiddleware = (
  config: ApplicationConfig["security"]["cors"],
): CorsMiddlewareBundle => {
  if (!config.enabled) {
    return {
      middleware: NOOP_HANDLER,
      preflight: NOOP_HANDLER,
    };
  }

  const origin = createOriginValidator(config);
  const options = buildCorsOptions(config);

  const corsOptions: CorsOptions = {
    origin,
    methods: options.methods,
    allowedHeaders: options.allowedHeaders,
    exposedHeaders: options.exposedHeaders,
    credentials: options.credentials,
    maxAge: options.maxAge,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  const middleware = cors(corsOptions);

  return {
    middleware,
    preflight: cors(corsOptions),
  };
};
