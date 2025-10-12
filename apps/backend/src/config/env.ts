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
const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "https://localhost:3000"] as const;
const DEFAULT_CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const DEFAULT_CORS_HEADERS = ["Content-Type", "Authorization", "X-Request-Id"] as const;
const DEFAULT_CORS_EXPOSED_HEADERS = [DEFAULT_CORS_HEADERS[2]] as const;
const DEFAULT_CORS_ALLOWED_ORIGINS = DEFAULT_CORS_ORIGINS.join(",");
const DEFAULT_CORS_ALLOWED_HEADERS = DEFAULT_CORS_HEADERS.join(",");
const DEFAULT_CSP =
  "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';";
const DEFAULT_PERMISSIONS_POLICY =
  "accelerometer=(),camera=(),geolocation=(),gyroscope=(),microphone=(),payment=()";
const CROSS_ORIGIN_OPENER_OPTIONS = [
  "same-origin",
  "same-origin-allow-popups",
  "unsafe-none",
] as const;
const CROSS_ORIGIN_RESOURCE_OPTIONS = ["same-origin", "same-site", "cross-origin"] as const;
const DEFAULT_COOP = CROSS_ORIGIN_OPENER_OPTIONS[0];
const DEFAULT_CORP = CROSS_ORIGIN_RESOURCE_OPTIONS[1];
const DEFAULT_REQUEST_REDACT_FIELDS = [
  "password",
  "pass",
  "token",
  "secret",
  "authorization",
  "apikey",
  "refreshToken",
  "accessToken",
  "clientSecret",
  "creditCard",
] as const;
const hasLength = (value: string) => value.length > 0;

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

const csvTransformer = (value: unknown, fallback: string[]): string[] => {
  if (typeof value !== "string") {
    return fallback;
  }

  const entries = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => hasLength(token));

  return entries.length > 0 ? entries : fallback;
};

const optionalString = (value: unknown) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
};

const normaliseRedactFields = (raw: string[]): string[] => {
  const unique = new Set<string>();
  raw.forEach((value) => {
    const normalised = value.trim().toLowerCase();
    if (normalised.length > 0) {
      unique.add(normalised);
    }
  });

  return [...unique];
};

const parseOptionalPort = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    if (!/^\d+$/.test(trimmed)) {
      throw new Error("PORT must be a positive integer");
    }

    return Number.parseInt(trimmed, 10);
  }

  throw new Error("PORT must be a number or numeric string");
};

const validatePortRange = (
  port: number | undefined,
  ctx: z.RefinementCtx,
  pathSegments: (string | number)[],
) => {
  if (port === undefined) {
    return;
  }

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PORT must be between 1 and 65535",
      path: pathSegments,
    });
  }
};

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default("development"),
    APP_NAME: z.string().min(1, "APP_NAME is required"),
    APP_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    PORT: z
      .any()
      .transform(parseOptionalPort)
      .superRefine((value, ctx) => validatePortRange(value, ctx, ["PORT"])),
    API_BASE_URL: z.string().url("API_BASE_URL must be a valid URL"),
    FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required"),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    CORS_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    CORS_ALLOWED_ORIGINS: z.string().default(DEFAULT_CORS_ALLOWED_ORIGINS),
    CORS_ORIGIN: z.string().optional().transform(optionalString),
    CORS_ALLOWED_METHODS: z.string().default("GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS"),
    CORS_ALLOWED_HEADERS: z.string().default(DEFAULT_CORS_ALLOWED_HEADERS),
    CORS_EXPOSED_HEADERS: z.string().default("X-Request-Id"),
    CORS_ALLOW_CREDENTIALS: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    CORS_MAX_AGE: z.coerce
      .number()
      .int()
      .min(0, "CORS_MAX_AGE must be zero or positive")
      .default(600),
    SECURITY_HEADERS_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    SECURITY_HEADERS_CSP: z.string().default(DEFAULT_CSP),
    SECURITY_HEADERS_REFERRER_POLICY: z.string().default("strict-origin-when-cross-origin"),
    SECURITY_HEADERS_FRAME_GUARD: z.enum(["DENY", "SAMEORIGIN"]).default("DENY"),
    SECURITY_HEADERS_PERMISSIONS_POLICY: z.string().default(DEFAULT_PERMISSIONS_POLICY),
    SECURITY_HEADERS_HSTS_MAX_AGE: z.coerce
      .number()
      .int()
      .min(0, "SECURITY_HEADERS_HSTS_MAX_AGE must be zero or positive")
      .default(63_072_000),
    SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    SECURITY_HEADERS_HSTS_PRELOAD: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    SECURITY_HEADERS_EXPECT_CT_ENFORCE: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
    SECURITY_HEADERS_EXPECT_CT_MAX_AGE: z.coerce
      .number()
      .int()
      .min(0, "SECURITY_HEADERS_EXPECT_CT_MAX_AGE must be zero or positive")
      .default(86_400),
    SECURITY_HEADERS_EXPECT_CT_REPORT_URI: z.string().optional().transform(optionalString),
    SECURITY_HEADERS_CROSS_ORIGIN_EMBEDDER_POLICY: z
      .enum(["require-corp", "credentialless", "unsafe-none"])
      .default("require-corp"),
    SECURITY_HEADERS_CROSS_ORIGIN_OPENER_POLICY: z
      .enum(CROSS_ORIGIN_OPENER_OPTIONS)
      .default(DEFAULT_COOP),
    SECURITY_HEADERS_CROSS_ORIGIN_RESOURCE_POLICY: z
      .enum(CROSS_ORIGIN_RESOURCE_OPTIONS)
      .default(DEFAULT_CORP),
    SECURITY_HEADERS_X_CONTENT_TYPE_OPTIONS: z.enum(["nosniff"]).default("nosniff"),
    RATE_LIMIT_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    RATE_LIMIT_STRATEGY: z.enum(["memory", "redis"]).default("memory"),
    RATE_LIMIT_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_POINTS must be at least 1")
      .default(100),
    RATE_LIMIT_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_DURATION must be at least 1 second")
      .default(900),
    RATE_LIMIT_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_BLOCK_DURATION must not be negative")
      .default(900),
    RATE_LIMIT_AUTH_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_POINTS must be at least 1")
      .default(5),
    RATE_LIMIT_AUTH_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_DURATION must be at least 1 second")
      .default(900),
    RATE_LIMIT_AUTH_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_BLOCK_DURATION must not be negative")
      .default(900),
    RATE_LIMIT_KEY_PREFIX: z.string().default("lumi:rate-limit"),
    RATE_LIMIT_REDIS_URL: z.string().optional().transform(optionalString),
    VALIDATION_STRICT: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    VALIDATION_SANITIZE: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    VALIDATION_STRIP_UNKNOWN: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    VALIDATION_MAX_BODY_KB: z.coerce
      .number()
      .int()
      .min(16, "VALIDATION_MAX_BODY_KB must be at least 16KB")
      .max(1024, "VALIDATION_MAX_BODY_KB must not exceed 1024KB")
      .default(512),
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
    LOG_REQUEST_SAMPLE_RATE: z.coerce
      .number()
      .min(0, "LOG_REQUEST_SAMPLE_RATE must be between 0 and 1")
      .max(1, "LOG_REQUEST_SAMPLE_RATE must be between 0 and 1")
      .default(1),
    LOG_REQUEST_MAX_BODY_LENGTH: z.coerce
      .number()
      .int()
      .min(0, "LOG_REQUEST_MAX_BODY_LENGTH must not be negative")
      .max(65_536, "LOG_REQUEST_MAX_BODY_LENGTH must not exceed 65536 bytes")
      .default(2048),
    LOG_REQUEST_REDACT_FIELDS: z.string().default(DEFAULT_REQUEST_REDACT_FIELDS.join(",")),
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
    METRICS_BASIC_AUTH_USERNAME: z.union([z.string(), z.undefined()]).transform(optionalString),
    METRICS_BASIC_AUTH_PASSWORD: z.union([z.string(), z.undefined()]).transform(optionalString),
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
  .superRefine((value, ctx) => {
    if (value.METRICS_BASIC_AUTH_USERNAME && !value.METRICS_BASIC_AUTH_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "METRICS_BASIC_AUTH_PASSWORD is required when username is provided",
        path: ["METRICS_BASIC_AUTH_PASSWORD"],
      });
    }

    if (value.METRICS_BASIC_AUTH_PASSWORD && !value.METRICS_BASIC_AUTH_USERNAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "METRICS_BASIC_AUTH_USERNAME is required when password is provided",
        path: ["METRICS_BASIC_AUTH_USERNAME"],
      });
    }
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
  appPort: parsed.PORT ?? parsed.APP_PORT,
  apiBaseUrl: parsed.API_BASE_URL,
  frontendUrl: parsed.FRONTEND_URL,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  storageBucket: parsed.STORAGE_BUCKET,
  logLevel: parsed.LOG_LEVEL,
  jwtSecret: parsed.JWT_SECRET,
  cors: {
    enabled: parsed.CORS_ENABLED,
    allowedOrigins: csvTransformer(parsed.CORS_ORIGIN ?? parsed.CORS_ALLOWED_ORIGINS, [
      ...DEFAULT_CORS_ORIGINS,
    ]),
    allowedMethods: csvTransformer(parsed.CORS_ALLOWED_METHODS, [...DEFAULT_CORS_METHODS]),
    allowedHeaders: csvTransformer(parsed.CORS_ALLOWED_HEADERS, [...DEFAULT_CORS_HEADERS]),
    exposedHeaders: csvTransformer(parsed.CORS_EXPOSED_HEADERS, [...DEFAULT_CORS_EXPOSED_HEADERS]),
    allowCredentials: parsed.CORS_ALLOW_CREDENTIALS,
    maxAgeSeconds: parsed.CORS_MAX_AGE,
  },
  securityHeaders: {
    enabled: parsed.SECURITY_HEADERS_ENABLED,
    contentSecurityPolicy: parsed.SECURITY_HEADERS_CSP,
    referrerPolicy: parsed.SECURITY_HEADERS_REFERRER_POLICY,
    frameGuard: parsed.SECURITY_HEADERS_FRAME_GUARD,
    permissionsPolicy: parsed.SECURITY_HEADERS_PERMISSIONS_POLICY,
    strictTransportSecurity: {
      maxAgeSeconds: parsed.SECURITY_HEADERS_HSTS_MAX_AGE,
      includeSubDomains: parsed.SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS,
      preload: parsed.SECURITY_HEADERS_HSTS_PRELOAD,
    },
    expectCt: {
      enforce: parsed.SECURITY_HEADERS_EXPECT_CT_ENFORCE,
      maxAgeSeconds: parsed.SECURITY_HEADERS_EXPECT_CT_MAX_AGE,
      reportUri: parsed.SECURITY_HEADERS_EXPECT_CT_REPORT_URI,
    },
    crossOriginEmbedderPolicy: parsed.SECURITY_HEADERS_CROSS_ORIGIN_EMBEDDER_POLICY,
    crossOriginOpenerPolicy: parsed.SECURITY_HEADERS_CROSS_ORIGIN_OPENER_POLICY,
    crossOriginResourcePolicy: parsed.SECURITY_HEADERS_CROSS_ORIGIN_RESOURCE_POLICY,
    xContentTypeOptions: parsed.SECURITY_HEADERS_X_CONTENT_TYPE_OPTIONS,
  },
  rateLimit: {
    enabled: parsed.RATE_LIMIT_ENABLED,
    keyPrefix: parsed.RATE_LIMIT_KEY_PREFIX,
    points: parsed.RATE_LIMIT_POINTS,
    durationSeconds: parsed.RATE_LIMIT_DURATION,
    blockDurationSeconds: parsed.RATE_LIMIT_BLOCK_DURATION,
    strategy: parsed.RATE_LIMIT_STRATEGY,
    redis:
      parsed.RATE_LIMIT_STRATEGY === "redis" && parsed.RATE_LIMIT_REDIS_URL
        ? {
            url: parsed.RATE_LIMIT_REDIS_URL,
          }
        : undefined,
    routes: {
      auth: {
        points: parsed.RATE_LIMIT_AUTH_POINTS,
        durationSeconds: parsed.RATE_LIMIT_AUTH_DURATION,
        blockDurationSeconds: parsed.RATE_LIMIT_AUTH_BLOCK_DURATION,
      },
    },
  },
  validation: {
    strict: parsed.VALIDATION_STRICT,
    sanitize: parsed.VALIDATION_SANITIZE,
    stripUnknown: parsed.VALIDATION_STRIP_UNKNOWN,
    maxBodySizeKb: parsed.VALIDATION_MAX_BODY_KB,
  },
  sentryDsn: parsed.SENTRY_DSN ?? undefined,
  logDirectory: parsed.LOG_DIRECTORY,
  logMaxSize: parsed.LOG_MAX_SIZE,
  logMaxFiles: parsed.LOG_MAX_FILES,
  logConsoleEnabled: parsed.LOG_ENABLE_CONSOLE,
  logRequestSampleRate: parsed.LOG_REQUEST_SAMPLE_RATE,
  logRequestMaxBodyLength: parsed.LOG_REQUEST_MAX_BODY_LENGTH,
  logRequestRedactFields: normaliseRedactFields(
    csvTransformer(parsed.LOG_REQUEST_REDACT_FIELDS, [...DEFAULT_REQUEST_REDACT_FIELDS]),
  ),
  metricsEnabled: parsed.METRICS_ENABLED,
  metricsEndpoint: parsed.METRICS_ENDPOINT,
  metricsPrefix: parsed.METRICS_PREFIX,
  metricsCollectDefault: parsed.METRICS_COLLECT_DEFAULT,
  metricsDefaultInterval: parsed.METRICS_DEFAULT_INTERVAL,
  metricsBasicAuthUsername: parsed.METRICS_BASIC_AUTH_USERNAME ?? undefined,
  metricsBasicAuthPassword: parsed.METRICS_BASIC_AUTH_PASSWORD ?? undefined,
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
