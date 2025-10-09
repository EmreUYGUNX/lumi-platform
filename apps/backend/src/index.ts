import { getConfig, onConfigChange } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { initializeObservability } from "./observability/index.js";

export const createBackendApp = () => {
  let activeConfig = getConfig();

  const unsubscribe = onConfigChange(({ snapshot, changedKeys, reason }) => {
    activeConfig = snapshot;
    if (changedKeys.length > 0) {
      logger.info("Configuration reloaded", { reason, changedKeys });
    }
  });

  return {
    start() {
      const { app } = activeConfig;
      initializeObservability();
      logger.info("Backend service starting", {
        environment: app.environment,
        port: app.port,
      });
      return () => unsubscribe();
    },
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const shutdown = createBackendApp().start();
  process.on("exit", () => shutdown());
}
