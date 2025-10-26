import { z } from "zod";

import type { AuthConfig, ResolvedEnvironment } from "@lumi/types";

const tokenSchema = z.object({
  secret: z.string().min(32, "JWT secret must be at least 32 characters"),
  ttlSeconds: z.number().int().min(60, "JWT TTL must be at least 60 seconds"),
});

export const AuthConfigSchema = z.object({
  jwt: z.object({
    access: tokenSchema,
    refresh: tokenSchema,
  }),
  cookies: z.object({
    domain: z.string().min(1).optional(),
    secret: z.string().min(32, "Cookie secret must be at least 32 characters"),
  }),
  tokens: z.object({
    emailVerification: z.object({
      ttlSeconds: z.number().int().min(300, "Email verification TTL must be at least 5 minutes"),
    }),
    passwordReset: z.object({
      ttlSeconds: z.number().int().min(300, "Password reset TTL must be at least 5 minutes"),
    }),
  }),
  session: z.object({
    fingerprintSecret: z
      .string()
      .min(32, "Session fingerprint secret must be at least 32 characters"),
    lockoutDurationSeconds: z
      .number()
      .int()
      .min(60, "Lockout duration must be at least 60 seconds"),
    maxLoginAttempts: z.number().int().min(3, "Max login attempts must be at least 3"),
  }),
  bruteForce: z.object({
    enabled: z.boolean(),
    windowSeconds: z.number().int().min(60, "Brute force window must be at least 60 seconds"),
    progressiveDelays: z
      .object({
        baseDelayMs: z.number().int().min(0, "Base delay must be zero or positive"),
        stepDelayMs: z.number().int().min(0, "Step delay must be zero or positive"),
        maxDelayMs: z.number().int().min(0, "Max delay must be zero or positive"),
      })
      .refine(
        (value) => value.maxDelayMs >= value.baseDelayMs,
        "Max delay must be greater than or equal to base delay",
      ),
    captchaThreshold: z.number().int().min(1, "CAPTCHA threshold must be at least 1"),
  }),
});

export type ParsedAuthConfig = z.infer<typeof AuthConfigSchema>;

export const buildAuthConfig = (env: ResolvedEnvironment): AuthConfig => {
  const parsed = AuthConfigSchema.parse({
    jwt: {
      access: {
        secret: env.jwtAccessSecret,
        ttlSeconds: env.jwtAccessTtlSeconds,
      },
      refresh: {
        secret: env.jwtRefreshSecret,
        ttlSeconds: env.jwtRefreshTtlSeconds,
      },
    },
    cookies: {
      domain: env.cookieDomain,
      secret: env.cookieSecret,
    },
    tokens: {
      emailVerification: {
        ttlSeconds: env.emailVerificationTtlSeconds,
      },
      passwordReset: {
        ttlSeconds: env.passwordResetTtlSeconds,
      },
    },
    session: {
      fingerprintSecret: env.sessionFingerprintSecret,
      lockoutDurationSeconds: env.lockoutDurationSeconds,
      maxLoginAttempts: env.maxLoginAttempts,
    },
    bruteForce: {
      enabled: env.authBruteForce.enabled,
      windowSeconds: env.authBruteForce.windowSeconds,
      progressiveDelays: {
        baseDelayMs: env.authBruteForce.progressiveDelays.baseDelayMs,
        stepDelayMs: env.authBruteForce.progressiveDelays.stepDelayMs,
        maxDelayMs: env.authBruteForce.progressiveDelays.maxDelayMs,
      },
      captchaThreshold: env.authBruteForce.captchaThreshold,
    },
  });

  return parsed as AuthConfig;
};
