import * as Sentry from "@sentry/node";
import { httpIntegration, linkedErrorsIntegration } from "@sentry/node";

import { getConfig, onConfigChange } from "../config/index.js";
import { logger } from "../lib/logger.js";

let sentryInitialised = false;

const configureSentry = (config = getConfig()) => {
  const { sentryDsn } = config.observability;

  if (!sentryDsn) {
    if (sentryInitialised) {
      // eslint-disable-next-line promise/catch-or-return
      Sentry.close(2000)
        .catch((error) => {
          logger.warn("Failed to flush Sentry events on shutdown", { error });
        })
        .finally(() => {
          sentryInitialised = false;
        });
    }
    return;
  }

  if (sentryInitialised) {
    Sentry.setTag("environment", config.app.environment);
    Sentry.setContext("service", {
      name: config.app.name,
      environment: config.app.environment,
    });
  } else {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: config.app.environment === "production" ? 0.2 : 0.01,
      environment: config.app.environment,
      release: process.env.GIT_SHA,
      integrations: [httpIntegration(), linkedErrorsIntegration()],
    });

    sentryInitialised = true;
    logger.info("Sentry telemetry initialised");
  }
};

configureSentry();

onConfigChange(({ snapshot }) => {
  configureSentry(snapshot);
});

export const isSentryEnabled = (): boolean => sentryInitialised;

export const getSentryInstance = () => Sentry;
