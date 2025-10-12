import { EventEmitter } from "node:events";

import type { ApplicationConfig, ConfigurationChange, ResolvedEnvironment } from "@lumi/types";

import { getEnvironment, loadEnvironment, onEnvironmentChange } from "./env.js";
import { createFeatureFlagRegistry } from "./feature-flags.js";

const configEmitter = new EventEmitter();

const flatten = (input: unknown, prefix = ""): Record<string, unknown> => {
  if (typeof input !== "object" || input === null) {
    if (!prefix) {
      return {};
    }

    return { [prefix]: input };
  }

  const result: Record<string, unknown> = {};

  Object.entries(input).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (typeof value !== "object" || value === null) {
      // eslint-disable-next-line security/detect-object-injection
      result[nextPrefix] = value;
    } else {
      Object.assign(result, flatten(value, nextPrefix));
    }
  });

  return result;
};

const computeDiffKeys = (
  previous: ApplicationConfig | undefined,
  next: ApplicationConfig,
): string[] => {
  if (!previous) {
    return Object.keys(flatten(next));
  }

  const currentFlat = flatten(previous);
  const nextFlat = flatten(next);

  const allKeys = new Set([...Object.keys(currentFlat), ...Object.keys(nextFlat)]);

  const changed: string[] = [];

  allKeys.forEach((key) => {
    // eslint-disable-next-line security/detect-object-injection
    if (currentFlat[key] !== nextFlat[key]) {
      changed.push(key);
    }
  });

  return changed;
};

const buildConfig = (env: ResolvedEnvironment = getEnvironment()): ApplicationConfig => ({
  app: {
    name: env.appName,
    environment: env.nodeEnv,
    port: env.appPort,
    apiBaseUrl: env.apiBaseUrl,
    frontendUrl: env.frontendUrl,
    logLevel: env.logLevel,
  },
  database: {
    url: env.databaseUrl,
  },
  cache: {
    redisUrl: env.redisUrl,
  },
  storage: {
    bucket: env.storageBucket,
  },
  security: {
    jwtSecret: env.jwtSecret,
    cors: env.cors,
    headers: env.securityHeaders,
    rateLimit: env.rateLimit,
    validation: env.validation,
  },
  observability: {
    sentryDsn: env.sentryDsn,
    logs: {
      directory: env.logDirectory,
      rotation: {
        maxFiles: env.logMaxFiles,
        maxSize: env.logMaxSize,
        zippedArchive: true,
      },
      consoleEnabled: env.logConsoleEnabled,
      request: {
        sampleRate: env.logRequestSampleRate,
        maxBodyLength: env.logRequestMaxBodyLength,
        redactFields: env.logRequestRedactFields,
      },
    },
    metrics: {
      enabled: env.metricsEnabled,
      endpoint: env.metricsEndpoint,
      prefix: env.metricsPrefix,
      collectDefaultMetrics: env.metricsCollectDefault,
      defaultMetricsInterval: env.metricsDefaultInterval,
    },
    alerting: {
      enabled: env.alertingEnabled,
      webhookUrl: env.alertingWebhookUrl,
      severityThreshold: env.alertingSeverity,
    },
    health: {
      uptimeGracePeriodSeconds: env.healthUptimeGracePeriodSeconds,
    },
  },
  featureFlags: env.featureFlags,
  runtime: {
    ci: env.ci,
  },
});

let cachedConfig: ApplicationConfig;
let lastChange: ConfigurationChange<ApplicationConfig> | undefined;

const featureFlagRegistry = createFeatureFlagRegistry();

const applyConfigUpdate = (
  env: ResolvedEnvironment,
  reason: string,
): ConfigurationChange<ApplicationConfig> | undefined => {
  const nextConfig = buildConfig(env);
  const changedKeys = computeDiffKeys(cachedConfig, nextConfig);

  if (changedKeys.length === 0) {
    return undefined;
  }

  const previous = cachedConfig;
  cachedConfig = nextConfig;
  featureFlagRegistry.update(env.featureFlags);

  const change: ConfigurationChange<ApplicationConfig> = {
    snapshot: cachedConfig,
    previous,
    changedKeys,
  };

  lastChange = change;
  configEmitter.emit("change", { ...change, reason });

  return change;
};

const initialise = () => {
  const env = loadEnvironment();
  featureFlagRegistry.update(env.featureFlags);
  cachedConfig = buildConfig(env);
};

initialise();

onEnvironmentChange(({ env, reason }) => {
  applyConfigUpdate(env, reason);
});

export const getConfig = (): ApplicationConfig => cachedConfig;

export const getFeatureFlags = () => featureFlagRegistry.snapshot();

export const isFeatureEnabled = (flag: string): boolean => featureFlagRegistry.isEnabled(flag);

export const reloadConfiguration = (
  reason = "manual",
): ConfigurationChange<ApplicationConfig> | undefined => {
  const beforeChange = lastChange;
  loadEnvironment({ reload: true, reason });

  if (beforeChange === lastChange) {
    return undefined;
  }

  return lastChange;
};

export const onConfigChange = (
  listener: (payload: ConfigurationChange<ApplicationConfig> & { reason: string }) => void,
): (() => void) => {
  configEmitter.on("change", listener);
  if (lastChange) {
    listener({ ...lastChange, reason: "initial" });
  }
  return () => configEmitter.off("change", listener);
};

export const getLastConfigChange = () => lastChange;

/**
 * @internal Exposes internal helpers strictly for unit testing. Do not rely on these in production code.
 */
export const configInternals = {
  flatten,
  computeDiffKeys,
};
