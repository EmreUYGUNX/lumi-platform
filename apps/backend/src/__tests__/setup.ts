import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach } from "@jest/globals";

import { resetEnvironmentCache } from "../config/env.js";
import { listRegisteredTransports, unregisterLogTransport } from "../lib/logger.js";

// eslint-disable-next-line security/detect-non-literal-fs-filename -- resolves a controlled temp directory root for tests
const LOG_DIR_ROOT = fs.realpathSync(os.tmpdir());

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();

  const logDir = fs.mkdtempSync(path.join(LOG_DIR_ROOT, "lumi-test-logs-"));
  process.env.LOG_DIRECTORY = logDir;
});

afterEach(async () => {
  resetEnvironmentCache();

  const transports = listRegisteredTransports();
  transports.forEach((name) => {
    unregisterLogTransport(name);
  });

  process.env.SENTRY_DSN = "";
});
