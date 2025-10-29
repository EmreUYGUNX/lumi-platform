import http from "node:http";

import { getConfig, onConfigChange } from "./config/index.js";
import { createHttpApp } from "./http/app.js";
import { logger } from "./lib/logger.js";
import { registerPrismaMiddlewares } from "./lib/prisma/middleware.js";
import { initializeObservability } from "./observability/index.js";
import { type ServerController, startServer } from "./server.js";

export const createBackendApp = () => {
  let activeConfig = getConfig();
  let httpServer: http.Server | undefined;

  const unsubscribe = onConfigChange(({ snapshot, changedKeys, reason }) => {
    activeConfig = snapshot;
    if (changedKeys.length > 0) {
      logger.info("Configuration reloaded", { reason, changedKeys });
    }
  });

  return {
    start() {
      const { app } = activeConfig;
      const expressApp = createHttpApp();

      initializeObservability();

      logger.info("Backend service starting", {
        environment: initialConfig.app.environment,
        port: initialConfig.app.port,
      });

      unsubscribeConfig = onConfigChange(({ snapshot, changedKeys, reason }) => {
        if (changedKeys.length > 0) {
          logger.info("Configuration reloaded", { reason, changedKeys });
        }

        if (serverController) {
          serverController.app.locals.config = snapshot;
        }
      });

      httpServer = http.createServer(expressApp);

      httpServer.listen(app.port, () => {
        logger.info("Backend HTTP server listening", {
          port: app.port,
          environment: app.environment,
        });
      });

      httpServer.on("error", (error) => {
        logger.error("HTTP server encountered an error", { error });
      });

      return () => {
        unsubscribe();
        if (httpServer) {
          httpServer.close((error) => {
            if (error) {
              logger.error("Error while shutting down HTTP server", { error });
            } else {
              logger.info("HTTP server stopped");
            }
          });
          httpServer = undefined;
        }
      };
    },
  };
};

const isExecutedDirectly = import.meta.url === `file://${process.argv[1]}`;

const registerShutdownCleanup = (cleanup: () => Promise<void>) => {
  process.once("exit", () => {
    cleanup().catch((error) => {
      logger.error("Error during shutdown cleanup", { error });
    });
  });
};

const bootstrapBackend = async () => {
  const cleanup = await createBackendApp().start();
  registerShutdownCleanup(cleanup);
};

if (isExecutedDirectly) {
  try {
    await bootstrapBackend();
  } catch (error) {
    logger.error("Failed to start backend application", { error });
    process.exitCode = 1;
  }
}
