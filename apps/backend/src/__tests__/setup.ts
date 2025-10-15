import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, jest } from "@jest/globals";

import { resetEnvironmentCache } from "../config/env.js";
import { listRegisteredTransports, unregisterLogTransport } from "../lib/logger.js";
import { disposeSharedTestDatabase, getTestDatabaseManager } from "./helpers/db.js";

// eslint-disable-next-line security/detect-non-literal-fs-filename -- resolves a controlled temp directory root for tests
const LOG_DIR_ROOT = fs.realpathSync(os.tmpdir());

const testDatabaseManager = getTestDatabaseManager();

jest.setTimeout(120_000);

beforeAll(async () => {
  await testDatabaseManager.getPrismaClient();
});

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
  await testDatabaseManager.resetDatabase();
});

afterAll(async () => {
  await disposeSharedTestDatabase();
});
