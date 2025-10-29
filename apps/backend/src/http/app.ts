import express from "express";
import type { Express } from "express";

import { getConfig } from "../config/index.js";
import { errorHandler } from "../middleware/error-handler.js";
import { requestLogger } from "../middleware/request-logger.js";
import { responseFormatter } from "../middleware/response-formatter.js";
import { auditAdminRouter } from "../routes/admin/audit.js";

export const createHttpApp = (): Express => {
  const app = express();
  const config = getConfig();

  app.disable("x-powered-by");

  app.use(responseFormatter);
  app.use(requestLogger);

  const bodyLimit = `${config.security.validation.maxBodySizeKb}kb`;
  app.use(
    express.json({
      limit: bodyLimit,
      strict: config.security.validation.strict,
    }),
  );
  app.use(
    express.urlencoded({
      limit: bodyLimit,
      extended: true,
    }),
  );

  app.use("/api/v1/admin/audit-logs", auditAdminRouter);

  app.use(errorHandler);

  return app;
};
