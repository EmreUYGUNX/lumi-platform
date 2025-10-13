import { afterEach, beforeEach } from "@jest/globals";

import { resetEnvironmentCache } from "../config/env.js";
import { listRegisteredTransports, unregisterLogTransport } from "../lib/logger.js";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

afterEach(async () => {
  resetEnvironmentCache();

  const transports = listRegisteredTransports();
  transports.forEach((name) => {
    unregisterLogTransport(name);
  });

  process.env.SENTRY_DSN = "";
});
