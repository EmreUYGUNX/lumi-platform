import http from "node:http";

import { getConfig, onConfigChange } from "./config/index.js";
import { createHttpApp } from "./http/app.js";
import { logger } from "./lib/logger.js";
import { initializeObservability } from "./observability/index.js";

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
        environment: app.environment,
        port: app.port,
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const shutdown = createBackendApp().start();
  process.on("exit", () => shutdown());
}
