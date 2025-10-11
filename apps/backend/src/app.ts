import express, { type Express } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig } from "./config/index.js";

export interface CreateAppOptions {
  /**
   * Allows dependency injection of configuration for testing scenarios.
   */
  config?: ApplicationConfig;
}

export const createApp = ({ config: providedConfig }: CreateAppOptions = {}): Express => {
  const config = providedConfig ?? getConfig();
  const app = express();

  app.locals.config = config;
  app.set("port", config.app.port ?? 4000);

  /**
   * Enables reverse proxy support when running behind load balancers (production/staging).
   * Express expects numeric hop count; we default to trusting the first proxy hop.
   */
  const trustProxy =
    config.app.environment === "production" || config.app.environment === "staging" ? 1 : false;

  app.set("trust proxy", trustProxy);
  app.disable("x-powered-by");

  return app;
};
