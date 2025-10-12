import type { ApplicationConfig } from "@lumi/types";

export const createSecurityConfig = (): ApplicationConfig["security"] => ({
  jwtSecret: "x".repeat(32),
  cors: {
    enabled: true,
    allowedOrigins: ["http://localhost:3000", "https://app.lumi.com"],
    allowedMethods: ["GET", "POST"],
    allowedHeaders: ["content-type", "authorization"],
    exposedHeaders: ["x-request-id"],
    allowCredentials: true,
    maxAgeSeconds: 600,
  },
  headers: {
    enabled: true,
    contentSecurityPolicy: "default-src 'self';",
    referrerPolicy: "strict-origin-when-cross-origin",
    frameGuard: "DENY",
    permissionsPolicy: "camera=(), microphone=()",
    strictTransportSecurity: {
      maxAgeSeconds: 63_072_000,
      includeSubDomains: true,
      preload: true,
    },
    expectCt: {
      enforce: false,
      maxAgeSeconds: 0,
      reportUri: undefined,
    },
    crossOriginEmbedderPolicy: "require-corp",
    crossOriginOpenerPolicy: "same-origin",
    crossOriginResourcePolicy: "same-site",
    xContentTypeOptions: "nosniff",
  },
  rateLimit: {
    enabled: true,
    keyPrefix: "lumi:test",
    points: 2,
    durationSeconds: 1,
    blockDurationSeconds: 60,
    strategy: "memory",
    inmemoryBlockOnConsumed: 0,
    routes: {
      auth: {
        points: 1,
        durationSeconds: 60,
        blockDurationSeconds: 300,
      },
    },
  },
  validation: {
    strict: false,
    sanitize: true,
    stripUnknown: true,
    maxBodySizeKb: 512,
  },
});
