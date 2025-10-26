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

const MAX_QUERY_TIMEOUT_MS = 120 * 1e3;
const DEFAULT_QUERY_TIMEOUT_MS = 5 * 1e3;
const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 200;
const MIN_SLOW_QUERY_THRESHOLD_MS = 50;

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

/* eslint-disable security/detect-object-injection */
const setEnvDefault = (key: keyof NodeJS.ProcessEnv, value: string) => {
  if (!process.env[key] || process.env[key] === "") {
    process.env[key] = value;
  }
};
/* eslint-enable security/detect-object-injection */

const applyTestEnvironmentDefaults = () => {
  if (process.env.NODE_ENV !== "test") {
    return;
  }

  if (process.env.LUMI_TEST_SKIP_DEFAULTS === "1") {
    return;
  }

  setEnvDefault("JWT_SECRET", "test-secret-placeholder-32-chars!!");
  setEnvDefault("JWT_ACCESS_SECRET", "test-access-secret-placeholder-32-chars!!");
  setEnvDefault("JWT_REFRESH_SECRET", "test-refresh-secret-placeholder-32-chars!!");
  setEnvDefault("JWT_ACCESS_TTL", "900");
  setEnvDefault("JWT_REFRESH_TTL", `${14 * 24 * 60 * 60}`);
  setEnvDefault("COOKIE_DOMAIN", "localhost");
  setEnvDefault("COOKIE_SECRET", "test-cookie-secret-placeholder-32-chars!!");
  setEnvDefault("EMAIL_VERIFICATION_TTL", `${24 * 60 * 60}`);
  setEnvDefault("PASSWORD_RESET_TTL", `${60 * 60}`);
  setEnvDefault("SESSION_FINGERPRINT_SECRET", "test-fingerprint-secret-placeholder-32-chars!!");
  setEnvDefault("LOCKOUT_DURATION", "900");
  setEnvDefault("MAX_LOGIN_ATTEMPTS", "5");
  setEnvDefault("EMAIL_ENABLED", "true");
  setEnvDefault("EMAIL_FROM_ADDRESS", "no-reply@lumi.test");
  setEnvDefault("EMAIL_FROM_NAME", "Lumi Commerce");
  setEnvDefault("EMAIL_REPLY_TO_ADDRESS", "support@lumi.test");
  setEnvDefault("EMAIL_SIGNING_SECRET", "test-email-signing-secret-placeholder-32!!");
  setEnvDefault("EMAIL_SMTP_HOST", "localhost");
  setEnvDefault("EMAIL_SMTP_PORT", "1025");
  setEnvDefault("EMAIL_SMTP_SECURE", "false");
  setEnvDefault("EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED", "false");
  setEnvDefault("EMAIL_RATE_LIMIT_WINDOW", "1m");
  setEnvDefault("EMAIL_RATE_LIMIT_MAX_PER_RECIPIENT", "5");
  setEnvDefault("EMAIL_QUEUE_DRIVER", "inline");
  setEnvDefault("EMAIL_QUEUE_CONCURRENCY", "2");
  setEnvDefault("EMAIL_LOG_DELIVERIES", "true");
  setEnvDefault("EMAIL_TEMPLATE_BASE_URL", "http://localhost:3100");
  setEnvDefault("EMAIL_SUPPORT_ADDRESS", "support@lumi.test");
  setEnvDefault("EMAIL_SUPPORT_URL", "http://localhost:3100/support");
  setEnvDefault("EMAIL_TEMPLATE_DEFAULT_LOCALE", "en-US");
};

const DURATION_UNITS_IN_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
} as const;

type DurationUnit = keyof typeof DURATION_UNITS_IN_SECONDS;

const durationUnits: DurationUnit[] = ["s", "m", "h", "d"];

interface DurationParseOptions {
  minSeconds?: number;
}

const isPlainNumeric = (value: string): boolean => {
  if (value.length === 0) {
    return false;
  }

  let seenDecimalSeparator = false;
  return [...value].every((char, index) => {
    if (char === ".") {
      if (seenDecimalSeparator || index === 0 || index === value.length - 1) {
        return false;
      }

      seenDecimalSeparator = true;
      return true;
    }

    return char >= "0" && char <= "9";
  });
};

const parseDurationToSeconds = (
  raw: string,
  ctx: z.RefinementCtx,
  field: string,
  { minSeconds = 1 }: DurationParseOptions = {},
): number => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} is required`,
    });

    return z.NEVER;
  }

  if (isPlainNumeric(trimmed)) {
    const numericSeconds = Number.parseFloat(trimmed);

    if (!Number.isFinite(numericSeconds)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} must be a positive number of seconds`,
      });

      return z.NEVER;
    }

    const seconds = Math.floor(numericSeconds);
    if (seconds < minSeconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} must be at least ${minSeconds} seconds`,
      });

      return z.NEVER;
    }

    return seconds;
  }

  const unit = trimmed.slice(-1).toLowerCase() as DurationUnit;
  if (!durationUnits.includes(unit)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must end with one of: ${durationUnits.join(", ")}`,
    });

    return z.NEVER;
  }

  const magnitudePortion = trimmed.slice(0, -1);
  if (!isPlainNumeric(magnitudePortion)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must use a numeric magnitude (e.g. 15m, 1h)`,
    });

    return z.NEVER;
  }

  const magnitude = Number.parseFloat(magnitudePortion);
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must be greater than zero`,
    });

    return z.NEVER;
  }

  let unitSeconds: number;
  switch (unit) {
    case "s": {
      unitSeconds = DURATION_UNITS_IN_SECONDS.s;
      break;
    }
    case "m": {
      unitSeconds = DURATION_UNITS_IN_SECONDS.m;
      break;
    }
    case "h": {
      unitSeconds = DURATION_UNITS_IN_SECONDS.h;
      break;
    }
    case "d": {
      unitSeconds = DURATION_UNITS_IN_SECONDS.d;
      break;
    }
    default: {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} must end with one of: ${durationUnits.join(", ")}`,
      });

      return z.NEVER;
    }
  }

  const seconds = Math.round(magnitude * unitSeconds);
  if (seconds < minSeconds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must be at least ${minSeconds} seconds`,
    });

    return z.NEVER;
  }

  return seconds;
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
    DATABASE_POOL_MIN: z.coerce
      .number()
      .int()
      .min(5, "DATABASE_POOL_MIN must be at least 5")
      .default(5),
    DATABASE_POOL_MAX: z.coerce
      .number()
      .int()
      .min(5, "DATABASE_POOL_MAX must be at least 5")
      .default(20),
    DATABASE_SLOW_QUERY_THRESHOLD_MS: z.coerce
      .number()
      .int()
      .min(MIN_SLOW_QUERY_THRESHOLD_MS, "DATABASE_SLOW_QUERY_THRESHOLD_MS must be at least 50ms")
      .max(
        MAX_QUERY_TIMEOUT_MS,
        "DATABASE_SLOW_QUERY_THRESHOLD_MS should not exceed QUERY_TIMEOUT_MS",
      )
      .default(DEFAULT_SLOW_QUERY_THRESHOLD_MS),
    QUERY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100, "QUERY_TIMEOUT_MS must be at least 100ms")
      .max(MAX_QUERY_TIMEOUT_MS, "QUERY_TIMEOUT_MS should not exceed 120000ms")
      .default(DEFAULT_QUERY_TIMEOUT_MS),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required"),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_TTL: z
      .string()
      .min(1, "JWT_ACCESS_TTL is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "JWT_ACCESS_TTL", { minSeconds: 60 }),
      ),
    JWT_REFRESH_TTL: z
      .string()
      .min(1, "JWT_REFRESH_TTL is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "JWT_REFRESH_TTL", { minSeconds: 60 }),
      ),
    COOKIE_DOMAIN: z.string().optional().transform(optionalString),
    COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
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
    RATE_LIMIT_AUTH_LOGIN_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_LOGIN_POINTS must be at least 1")
      .default(5),
    RATE_LIMIT_AUTH_LOGIN_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_LOGIN_DURATION must be at least 1 second")
      .default(900),
    RATE_LIMIT_AUTH_LOGIN_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_LOGIN_BLOCK_DURATION must not be negative")
      .default(900),
    RATE_LIMIT_AUTH_REGISTER_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_REGISTER_POINTS must be at least 1")
      .default(5),
    RATE_LIMIT_AUTH_REGISTER_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_REGISTER_DURATION must be at least 1 second")
      .default(900),
    RATE_LIMIT_AUTH_REGISTER_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_REGISTER_BLOCK_DURATION must not be negative")
      .default(900),
    RATE_LIMIT_AUTH_FORGOT_PASSWORD_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_FORGOT_PASSWORD_POINTS must be at least 1")
      .default(3),
    RATE_LIMIT_AUTH_FORGOT_PASSWORD_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_FORGOT_PASSWORD_DURATION must be at least 1 second")
      .default(3600),
    RATE_LIMIT_AUTH_FORGOT_PASSWORD_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_FORGOT_PASSWORD_BLOCK_DURATION must not be negative")
      .default(3600),
    RATE_LIMIT_AUTH_RESEND_VERIFICATION_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_RESEND_VERIFICATION_POINTS must be at least 1")
      .default(3),
    RATE_LIMIT_AUTH_RESEND_VERIFICATION_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_RESEND_VERIFICATION_DURATION must be at least 1 second")
      .default(3600),
    RATE_LIMIT_AUTH_RESEND_VERIFICATION_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_RESEND_VERIFICATION_BLOCK_DURATION must not be negative")
      .default(3600),
    RATE_LIMIT_AUTH_REFRESH_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_REFRESH_POINTS must be at least 1")
      .default(10),
    RATE_LIMIT_AUTH_REFRESH_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_REFRESH_DURATION must be at least 1 second")
      .default(60),
    RATE_LIMIT_AUTH_REFRESH_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_REFRESH_BLOCK_DURATION must not be negative")
      .default(120),
    RATE_LIMIT_AUTH_CHANGE_PASSWORD_POINTS: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_CHANGE_PASSWORD_POINTS must be at least 1")
      .default(5),
    RATE_LIMIT_AUTH_CHANGE_PASSWORD_DURATION: z.coerce
      .number()
      .int()
      .min(1, "RATE_LIMIT_AUTH_CHANGE_PASSWORD_DURATION must be at least 1 second")
      .default(3600),
    RATE_LIMIT_AUTH_CHANGE_PASSWORD_BLOCK_DURATION: z.coerce
      .number()
      .int()
      .min(0, "RATE_LIMIT_AUTH_CHANGE_PASSWORD_BLOCK_DURATION must not be negative")
      .default(3600),
    RATE_LIMIT_KEY_PREFIX: z.string().default("lumi:rate-limit"),
    RATE_LIMIT_IP_WHITELIST: z.string().optional().transform(optionalString),
    RATE_LIMIT_REDIS_URL: z.string().optional().transform(optionalString),
    AUTH_BRUTE_FORCE_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    AUTH_BRUTE_FORCE_WINDOW: z.coerce
      .number()
      .int()
      .min(60, "AUTH_BRUTE_FORCE_WINDOW must be at least 60 seconds")
      .default(900),
    AUTH_BRUTE_FORCE_DELAY_BASE_MS: z.coerce
      .number()
      .int()
      .min(0, "AUTH_BRUTE_FORCE_DELAY_BASE_MS must be zero or positive")
      .default(250),
    AUTH_BRUTE_FORCE_DELAY_STEP_MS: z.coerce
      .number()
      .int()
      .min(0, "AUTH_BRUTE_FORCE_DELAY_STEP_MS must be zero or positive")
      .default(250),
    AUTH_BRUTE_FORCE_DELAY_MAX_MS: z.coerce
      .number()
      .int()
      .min(0, "AUTH_BRUTE_FORCE_DELAY_MAX_MS must be zero or positive")
      .default(5000),
    AUTH_BRUTE_FORCE_CAPTCHA_THRESHOLD: z.coerce
      .number()
      .int()
      .min(1, "AUTH_BRUTE_FORCE_CAPTCHA_THRESHOLD must be at least 1")
      .default(10),
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
    EMAIL_VERIFICATION_TTL: z
      .string()
      .min(1, "EMAIL_VERIFICATION_TTL is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "EMAIL_VERIFICATION_TTL", { minSeconds: 300 }),
      ),
    PASSWORD_RESET_TTL: z
      .string()
      .min(1, "PASSWORD_RESET_TTL is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "PASSWORD_RESET_TTL", { minSeconds: 300 }),
      ),
    SESSION_FINGERPRINT_SECRET: z
      .string()
      .min(32, "SESSION_FINGERPRINT_SECRET must be at least 32 characters"),
    LOCKOUT_DURATION: z
      .string()
      .min(1, "LOCKOUT_DURATION is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "LOCKOUT_DURATION", { minSeconds: 60 }),
      ),
    MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(3, "MAX_LOGIN_ATTEMPTS must be at least 3"),
    EMAIL_ENABLED: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    EMAIL_FROM_ADDRESS: z
      .string()
      .email("EMAIL_FROM_ADDRESS must be a valid email")
      .default("no-reply@lumi.dev"),
    EMAIL_FROM_NAME: z.union([z.string(), z.undefined()]).transform(optionalString),
    EMAIL_REPLY_TO_ADDRESS: z
      .union([
        z.string().email("EMAIL_REPLY_TO_ADDRESS must be a valid email"),
        z.literal(""),
        z.undefined(),
      ])
      .transform(optionalString),
    EMAIL_SIGNING_SECRET: z.string().min(32, "EMAIL_SIGNING_SECRET must be at least 32 characters"),
    EMAIL_SMTP_HOST: z.string().min(1).default("localhost"),
    EMAIL_SMTP_PORT: z.coerce
      .number()
      .int()
      .min(1, "EMAIL_SMTP_PORT must be between 1 and 65535")
      .max(65_535, "EMAIL_SMTP_PORT must be between 1 and 65535")
      .default(1025),
    EMAIL_SMTP_SECURE: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
    EMAIL_SMTP_USERNAME: z.union([z.string(), z.undefined()]).transform(optionalString),
    EMAIL_SMTP_PASSWORD: z.union([z.string(), z.undefined()]).transform(optionalString),
    EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED: z
      .any()
      .transform((value) => booleanTransformer(value, false))
      .pipe(z.boolean()),
    EMAIL_RATE_LIMIT_WINDOW: z
      .string()
      .min(1, "EMAIL_RATE_LIMIT_WINDOW is required")
      .transform((value, ctx) =>
        parseDurationToSeconds(value, ctx, "EMAIL_RATE_LIMIT_WINDOW", { minSeconds: 10 }),
      ),
    EMAIL_RATE_LIMIT_MAX_PER_RECIPIENT: z.coerce
      .number()
      .int()
      .min(1, "EMAIL_RATE_LIMIT_MAX_PER_RECIPIENT must be at least 1")
      .default(5),
    EMAIL_QUEUE_DRIVER: z.enum(["inline", "memory", "bullmq"]).default("inline"),
    EMAIL_QUEUE_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1, "EMAIL_QUEUE_CONCURRENCY must be at least 1")
      .max(100, "EMAIL_QUEUE_CONCURRENCY must not exceed 100")
      .default(2),
    EMAIL_LOG_DELIVERIES: z
      .any()
      .transform((value) => booleanTransformer(value, true))
      .pipe(z.boolean()),
    EMAIL_TEMPLATE_BASE_URL: z.union([z.string(), z.undefined()]).transform(optionalString),
    EMAIL_SUPPORT_ADDRESS: z
      .union([
        z.string().email("EMAIL_SUPPORT_ADDRESS must be a valid email"),
        z.literal(""),
        z.undefined(),
      ])
      .transform(optionalString),
    EMAIL_SUPPORT_URL: z
      .union([
        z.string().url("EMAIL_SUPPORT_URL must be a valid URL"),
        z.literal(""),
        z.undefined(),
      ])
      .transform(optionalString),
    EMAIL_TEMPLATE_DEFAULT_LOCALE: z
      .string()
      .min(2, "EMAIL_TEMPLATE_DEFAULT_LOCALE must be specified")
      .default("en-US"),
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

    if (value.DATABASE_POOL_MIN > value.DATABASE_POOL_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_POOL_MAX must be greater than or equal to DATABASE_POOL_MIN",
        path: ["DATABASE_POOL_MAX"],
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
  databasePool: {
    minConnections: parsed.DATABASE_POOL_MIN,
    maxConnections: parsed.DATABASE_POOL_MAX,
  },
  slowQueryThresholdMs: Math.min(parsed.DATABASE_SLOW_QUERY_THRESHOLD_MS, parsed.QUERY_TIMEOUT_MS),
  queryTimeoutMs: parsed.QUERY_TIMEOUT_MS,
  redisUrl: parsed.REDIS_URL,
  storageBucket: parsed.STORAGE_BUCKET,
  logLevel: parsed.LOG_LEVEL,
  jwtSecret: parsed.JWT_SECRET,
  jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
  jwtAccessTtlSeconds: parsed.JWT_ACCESS_TTL,
  jwtRefreshTtlSeconds: parsed.JWT_REFRESH_TTL,
  cookieDomain: parsed.COOKIE_DOMAIN,
  cookieSecret: parsed.COOKIE_SECRET,
  email: {
    enabled: parsed.EMAIL_ENABLED,
    defaultSender: {
      email: parsed.EMAIL_FROM_ADDRESS,
      name: parsed.EMAIL_FROM_NAME ?? parsed.APP_NAME,
      replyTo: parsed.EMAIL_REPLY_TO_ADDRESS,
    },
    signingSecret: parsed.EMAIL_SIGNING_SECRET,
    transport: {
      driver: "smtp",
      smtp: {
        host: parsed.EMAIL_SMTP_HOST,
        port: parsed.EMAIL_SMTP_PORT,
        secure: parsed.EMAIL_SMTP_SECURE,
        username: parsed.EMAIL_SMTP_USERNAME,
        password: parsed.EMAIL_SMTP_PASSWORD,
        tls: {
          rejectUnauthorized: parsed.EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED,
        },
      },
    },
    rateLimit: {
      windowSeconds: parsed.EMAIL_RATE_LIMIT_WINDOW,
      maxPerRecipient: parsed.EMAIL_RATE_LIMIT_MAX_PER_RECIPIENT,
    },
    queue: {
      driver: parsed.EMAIL_QUEUE_DRIVER,
      concurrency: parsed.EMAIL_QUEUE_CONCURRENCY,
    },
    logging: {
      deliveries: parsed.EMAIL_LOG_DELIVERIES,
    },
    template: {
      baseUrl: parsed.EMAIL_TEMPLATE_BASE_URL ?? parsed.FRONTEND_URL,
      supportEmail: parsed.EMAIL_SUPPORT_ADDRESS ?? parsed.EMAIL_FROM_ADDRESS,
      supportUrl: parsed.EMAIL_SUPPORT_URL ?? parsed.EMAIL_TEMPLATE_BASE_URL ?? parsed.FRONTEND_URL,
      defaultLocale: parsed.EMAIL_TEMPLATE_DEFAULT_LOCALE,
    },
  },
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
    ipWhitelist: csvTransformer(parsed.RATE_LIMIT_IP_WHITELIST, []),
    redis:
      parsed.RATE_LIMIT_STRATEGY === "redis" && parsed.RATE_LIMIT_REDIS_URL
        ? {
            url: parsed.RATE_LIMIT_REDIS_URL,
          }
        : undefined,
    routes: {
      auth: {
        global: {
          points: parsed.RATE_LIMIT_AUTH_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_BLOCK_DURATION,
        },
        login: {
          points: parsed.RATE_LIMIT_AUTH_LOGIN_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_LOGIN_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_LOGIN_BLOCK_DURATION,
        },
        register: {
          points: parsed.RATE_LIMIT_AUTH_REGISTER_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_REGISTER_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_REGISTER_BLOCK_DURATION,
        },
        forgotPassword: {
          points: parsed.RATE_LIMIT_AUTH_FORGOT_PASSWORD_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_FORGOT_PASSWORD_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_FORGOT_PASSWORD_BLOCK_DURATION,
        },
        resendVerification: {
          points: parsed.RATE_LIMIT_AUTH_RESEND_VERIFICATION_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_RESEND_VERIFICATION_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_RESEND_VERIFICATION_BLOCK_DURATION,
        },
        refresh: {
          points: parsed.RATE_LIMIT_AUTH_REFRESH_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_REFRESH_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_REFRESH_BLOCK_DURATION,
        },
        changePassword: {
          points: parsed.RATE_LIMIT_AUTH_CHANGE_PASSWORD_POINTS,
          durationSeconds: parsed.RATE_LIMIT_AUTH_CHANGE_PASSWORD_DURATION,
          blockDurationSeconds: parsed.RATE_LIMIT_AUTH_CHANGE_PASSWORD_BLOCK_DURATION,
        },
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
  emailVerificationTtlSeconds: parsed.EMAIL_VERIFICATION_TTL,
  passwordResetTtlSeconds: parsed.PASSWORD_RESET_TTL,
  sessionFingerprintSecret: parsed.SESSION_FINGERPRINT_SECRET,
  lockoutDurationSeconds: parsed.LOCKOUT_DURATION,
  maxLoginAttempts: parsed.MAX_LOGIN_ATTEMPTS,
  authBruteForce: {
    enabled: parsed.AUTH_BRUTE_FORCE_ENABLED,
    windowSeconds: parsed.AUTH_BRUTE_FORCE_WINDOW,
    progressiveDelays: {
      baseDelayMs: parsed.AUTH_BRUTE_FORCE_DELAY_BASE_MS,
      stepDelayMs: parsed.AUTH_BRUTE_FORCE_DELAY_STEP_MS,
      maxDelayMs: parsed.AUTH_BRUTE_FORCE_DELAY_MAX_MS,
    },
    captchaThreshold: parsed.AUTH_BRUTE_FORCE_CAPTCHA_THRESHOLD,
  },
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

  applyTestEnvironmentDefaults();

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
