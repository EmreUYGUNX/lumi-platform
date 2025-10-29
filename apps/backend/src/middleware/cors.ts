import cors, { type CorsOptions } from "cors";
import type { RequestHandler } from "express";

import { isOriginAllowed } from "@lumi/shared";
import type { ApplicationConfig } from "@lumi/types";

import { logger } from "../lib/logger.js";
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
  options: ReturnType<typeof buildCorsOptions>,
): CorsOptions["origin"] => {
  if (!options.enabled) {
    return false;
  }

  if (options.origin.length === 0) {
    if (options.unsafeWildcardDetected) {
      logger.warn(
        "CORS wildcard origin '*' ignored; configure explicit allowedOrigins to enable cross-origin access.",
      );
    }
    return false;
  }

  const sanitisedConfig = {
    ...config,
    allowedOrigins: options.origin,
  };

  return (origin, callback) => {
    if (!origin) {
      // eslint-disable-next-line unicorn/no-null -- Express callback expects a nullable error argument.
      callback(null, true);
      return;
    }

    if (isOriginAllowed(origin, sanitisedConfig)) {
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

  const options = buildCorsOptions(config);
  const origin = createOriginValidator(config, options);

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
