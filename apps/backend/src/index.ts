import process from "node:process";

import { getConfig, onConfigChange } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { initializeObservability } from "./observability/index.js";
import { type ServerController, startServer } from "./server.js";

export const createBackendApp = () => {
  let serverController: ServerController | undefined;
  let unsubscribeConfig: (() => void) | undefined;

  return {
    async start() {
      const initialConfig = getConfig();

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

      serverController = await startServer({ config: initialConfig });

      return async () => {
        unsubscribeConfig?.();
        await serverController?.shutdown({ reason: "app:shutdown" });
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
