import { getConfig, onConfigChange } from "./config/index.js";

export const createBackendApp = () => {
  let activeConfig = getConfig();

  const unsubscribe = onConfigChange(({ snapshot, changedKeys, reason }) => {
    activeConfig = snapshot;
    if (changedKeys.length > 0) {
      console.info(`Config reloaded (${reason}): ${changedKeys.join(", ")}`);
    }
  });

  return {
    start() {
      const { app } = activeConfig;
      console.info(`[${app.environment}] Backend service starting on port ${app.port}`);
      return () => unsubscribe();
    },
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const shutdown = createBackendApp().start();
  process.on("exit", () => shutdown());
}
