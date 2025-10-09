import { EventEmitter } from "node:events";
import { existsSync, watch } from "node:fs";
import path from "node:path";

import { config as loadEnvFile } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

import type { FeatureFlagMap, ResolvedEnvironment, RuntimeEnvironment } from "@lumi/types";

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const NODE_ENVS = [
  "development",
  "test",
  "staging",
  "production",
] as const satisfies readonly RuntimeEnvironment[];
const ALERT_SEVERITIES = ["info", "warn", "error", "fatal"] as const;

const booleanTransformer = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return fallback;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return fallback;
};

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default("development"),
    APP_NAME: z.string().min(1, "APP_NAME is required"),
    APP_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    API_BASE_URL: z.string().url("API_BASE_URL must be a valid URL"),
    FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required"),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    SENTRY_DSN: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    LOG_DIRECTORY: z.string().min(1).default("logs"),
    LOG_MAX_SIZE: z.string().min(2).default("20m"),
    LOG_MAX_FILES: z.string().min(2).default("14d"),
    LOG_ENABLE_CONSOLE: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    METRICS_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    METRICS_ENDPOINT: z.string().default("/metrics"),
    METRICS_PREFIX: z
      .string()
      .optional()
      .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
    METRICS_COLLECT_DEFAULT: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    METRICS_DEFAULT_INTERVAL: z.coerce
      .number()
      .int()
      .min(1, "METRICS_DEFAULT_INTERVAL must be a positive integer")
      .default(5000),
    ALERTING_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
    ALERTING_WEBHOOK_URL: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    ALERTING_SEVERITY: z.enum(ALERT_SEVERITIES).default("error"),
    HEALTH_UPTIME_GRACE_PERIOD: z.coerce
      .number()
      .int()
      .min(0, "HEALTH_UPTIME_GRACE_PERIOD must be zero or positive")
      .default(30),
    FEATURE_FLAGS: z.string().default("{}"),
    CONFIG_HOT_RELOAD: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
    CONFIG_ENCRYPTION_KEY: z
      .string()
      .optional()
      .transform((value) => {
        /* istanbul ignore if -- zod pre-validates string types */
        if (typeof value !== "string") {
          // eslint-disable-next-line unicorn/no-useless-undefined
          return undefined;
        }

        const trimmed = value.trim();
        if (trimmed.length === 0) {
          // eslint-disable-next-line unicorn/no-useless-undefined
          return undefined;
        }

        return trimmed;
      })
      .refine(
        (value) => value === undefined || value.length >= 32,
        "CONFIG_ENCRYPTION_KEY must be at least 32 characters when provided",
      ),
    CI: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
  })
  .transform((value) => ({
    ...value,
    FEATURE_FLAGS: value.FEATURE_FLAGS,
  }));

type EnvParseResult = z.infer<typeof EnvSchema>;

const envEmitter = new EventEmitter();

let cachedEnv: ResolvedEnvironment | undefined;
const watchers = new Map<string, ReturnType<typeof watch>>();

const resolveRuntimeEnv = (): RuntimeEnvironment =>
  (process.env.NODE_ENV as RuntimeEnvironment | undefined) ?? "development";

const getEnvDirectory = () => process.cwd();

const envFileOrder = (env: RuntimeEnvironment): string[] => {
  const baseDir = getEnvDirectory();

  return [
    path.resolve(baseDir, ".env"),
    path.resolve(baseDir, ".env.local"),
    path.resolve(baseDir, `.env.${env}`),
    path.resolve(baseDir, `.env.${env}.local`),
    path.resolve(baseDir, `.env.${env}.secrets`),
  ];
};

const applyEnvFile = (filePath: string) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(filePath)) {
    return;
  }

  expand(
    loadEnvFile({
      path: filePath,
      override: false,
    }),
  );
};

const parseFeatureFlags = (raw: string): FeatureFlagMap => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, booleanTransformer(value ?? false)]),
    );
  } catch {
    console.warn("Invalid FEATURE_FLAGS payload, falling back to empty object.");
    return {};
  }
};

const toResolvedEnvironment = (parsed: EnvParseResult): ResolvedEnvironment => ({
  nodeEnv: parsed.NODE_ENV,
  appName: parsed.APP_NAME,
  appPort: parsed.APP_PORT,
  apiBaseUrl: parsed.API_BASE_URL,
  frontendUrl: parsed.FRONTEND_URL,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  storageBucket: parsed.STORAGE_BUCKET,
  logLevel: parsed.LOG_LEVEL,
  jwtSecret: parsed.JWT_SECRET,
  sentryDsn: parsed.SENTRY_DSN ?? undefined,
  logDirectory: parsed.LOG_DIRECTORY,
  logMaxSize: parsed.LOG_MAX_SIZE,
  logMaxFiles: parsed.LOG_MAX_FILES,
  logConsoleEnabled: parsed.LOG_ENABLE_CONSOLE,
  metricsEnabled: parsed.METRICS_ENABLED,
  metricsEndpoint: parsed.METRICS_ENDPOINT,
  metricsPrefix: parsed.METRICS_PREFIX,
  metricsCollectDefault: parsed.METRICS_COLLECT_DEFAULT,
  metricsDefaultInterval: parsed.METRICS_DEFAULT_INTERVAL,
  alertingEnabled: parsed.ALERTING_ENABLED,
  alertingWebhookUrl: parsed.ALERTING_WEBHOOK_URL,
  alertingSeverity: parsed.ALERTING_SEVERITY,
  healthUptimeGracePeriodSeconds: parsed.HEALTH_UPTIME_GRACE_PERIOD,
  featureFlags: parseFeatureFlags(parsed.FEATURE_FLAGS),
  configHotReload: parsed.CONFIG_HOT_RELOAD,
  configEncryptionKey: parsed.CONFIG_ENCRYPTION_KEY ?? undefined,
  ci: parsed.CI,
});

interface LoadEnvironmentOptions {
  reload?: boolean;
  reason?: string;
}

export function loadEnvironment(options: LoadEnvironmentOptions = {}): ResolvedEnvironment {
  if (cachedEnv && !options.reload) {
    return cachedEnv;
  }

  const activeEnv = resolveRuntimeEnv();
  const files = envFileOrder(activeEnv);

  files.forEach((file) => {
    applyEnvFile(file);
  });

  const parsed = EnvSchema.parse(process.env);
  const resolved = toResolvedEnvironment(parsed);

  cachedEnv = resolved;

  if (resolved.configHotReload && resolved.nodeEnv !== "production") {
    startWatching(files);
  } else {
    stopWatching();
  }

  envEmitter.emit("reloaded", { env: resolved, reason: options.reason ?? "manual" });

  return resolved;
}

function stopWatching() {
  watchers.forEach((watcher) => watcher.close());
  watchers.clear();
}

function startWatching(files: string[]) {
  stopWatching();

  files.forEach((filePath) => {
    // Dynamic filenames are constrained to repository-managed .env files.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(filePath)) {
      return;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const watcher = watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === "change" || eventType === "rename") {
        loadEnvironment({ reload: true, reason: "file-change" });
      }
    });

    watchers.set(filePath, watcher);
  });
}

export const getEnvironment = (): ResolvedEnvironment => loadEnvironment();

export const onEnvironmentChange = (
  listener: (payload: { env: ResolvedEnvironment; reason: string }) => void,
): (() => void) => {
  envEmitter.on("reloaded", listener);
  return () => envEmitter.off("reloaded", listener);
};

export const getEnvFileOrder = (env: RuntimeEnvironment = resolveRuntimeEnv()): string[] =>
  envFileOrder(env);

export const resetEnvironmentCache = () => {
  cachedEnv = undefined;
  stopWatching();
};
