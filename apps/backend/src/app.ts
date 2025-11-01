import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
  Router,
} from "express";
import swaggerUi from "swagger-ui-express";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig } from "./config/index.js";
import { createOpenApiDocument, getSwaggerUiOptions } from "./config/swagger.js";
import {
  attachErrorHandlerAutoRefresh,
  registerErrorHandlers,
  resolveRouter,
} from "./middleware/errorHandler.js";
import { registerMiddleware } from "./middleware/index.js";
import { createApiRouter } from "./routes/index.js";
import { createInternalRouter } from "./routes/internal.js";
import {
  attachRouteRegistry,
  createRouteRegistrar,
  createRouteRegistry,
} from "./routes/registry.js";

export interface CreateAppOptions {
  /**
   * Allows dependency injection of configuration for testing scenarios.
   */
  config?: ApplicationConfig;
  apiOptions?: Parameters<typeof createApiRouter>[1];
}

export const createApp = ({
  config: providedConfig,
  apiOptions,
}: CreateAppOptions = {}): Express => {
  const config = providedConfig ?? getConfig();
  const app = express();
  const routeRegistry = createRouteRegistry();

  attachRouteRegistry(app, routeRegistry);

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

  registerMiddleware(app, config);

  const resolveConfig = (): ApplicationConfig => (app.locals.config as ApplicationConfig) ?? config;

  const docsRouter = Router();
  docsRouter.use("/", swaggerUi.serve);
  docsRouter.get("/", swaggerUi.setup(undefined, getSwaggerUiOptions(config)));
  docsRouter.get("/openapi.json", (_req, res) => {
    const document = createOpenApiDocument(resolveConfig());
    res.setHeader("Cache-Control", "no-store");
    res.json(document);
  });
  app.use("/api/docs", docsRouter);
  app.set("buildOpenApiDocument", () => createOpenApiDocument(resolveConfig()));

  const registerApiRoute = createRouteRegistrar(routeRegistry, "/api");
  const registerInternalRoute = createRouteRegistrar(routeRegistry, "/internal");

  app.use("/api", createApiRouter(config, { registerRoute: registerApiRoute, ...apiOptions }));
  app.use("/internal", createInternalRouter(config, { registerRoute: registerInternalRoute }));

  registerErrorHandlers(app, config);

  const refreshErrorHandlers = () => {
    let router = resolveRouter(app);
    if (!router?.stack) {
      const lazy = (app as unknown as { lazyrouter?: () => void }).lazyrouter;
      lazy?.call(app);
      router = resolveRouter(app);
    }
    const storedLayers = app.get("errorHandlerLayers") as
      | {
          handle?: RequestHandler | ErrorRequestHandler;
          route?: unknown;
        }[]
      | undefined;

    if (!router?.stack || !storedLayers || storedLayers.length === 0) {
      return;
    }

    router.stack = router.stack.filter((layer) => !storedLayers.includes(layer));
    router.stack.push(...storedLayers);
  };

  refreshErrorHandlers();
  app.set("refreshErrorHandlers", refreshErrorHandlers);
  attachErrorHandlerAutoRefresh(app, refreshErrorHandlers);

  return app;
};
