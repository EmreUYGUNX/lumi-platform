import type { Express } from "express";

import { createApiClient } from "@lumi/testing";
import type { ApplicationConfig } from "@lumi/types";

import { registerRoute } from "../../routes/registry.js";
import type { DeepPartial } from "../../testing/config.js";
import { createTestConfig } from "../../testing/config.js";

const REQUIRED_ENVIRONMENT: Record<string, string> = {
  NODE_ENV: "test",
  APP_NAME: "Lumi Test Backend",
  APP_PORT: "4100",
  API_BASE_URL: "http://localhost:4100",
  FRONTEND_URL: "http://localhost:3100",
  DATABASE_URL: "postgresql://localhost:5432/lumi",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "lumi-backend-test",
  JWT_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEF",
};

Object.entries(REQUIRED_ENVIRONMENT).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

const setupTestApp = async (overrides?: DeepPartial<ApplicationConfig>) => {
  const config = createTestConfig(overrides ?? {});
  const { createApp } = await import("../../app.js");
  const app = createApp({ config });
  const routeRegistry = app.get("routeRegistry");

  app.get("/test", (req, res) =>
    res.json({
      success: true,
      data: {
        status: "ok",
        requestId: req.id,
      },
    }),
  );
  if (routeRegistry) {
    registerRoute(routeRegistry, "GET", "/test");
  }

  app.post("/echo", (req, res) =>
    res.json({
      success: true,
      data: {
        body: req.body,
        query: req.query,
        params: req.params,
      },
    }),
  );
  if (routeRegistry) {
    registerRoute(routeRegistry, "POST", "/echo");
  }

  app.post("/api/v1/auth/login", (req, res) =>
    res.json({
      success: true,
      data: {
        authenticated: true,
        requestId: req.id,
        body: req.body,
      },
    }),
  );
  if (routeRegistry) {
    registerRoute(routeRegistry, "POST", "/api/v1/auth/login");
  }

  const refreshHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;
  refreshHandlers?.();
  return { app, config };
};

const cleanupApp = async (app: Express) => {
  const cleanup = app.get("rateLimiterCleanup") as (() => Promise<void>) | undefined;
  if (typeof cleanup === "function") {
    await cleanup();
  }
};

const withTestApp = async (
  overrides: DeepPartial<ApplicationConfig>,
  callback: (context: { app: Express; config: ApplicationConfig }) => Promise<void>,
) => {
  const { app, config } = await setupTestApp(overrides);
  try {
    await callback({ app, config });
  } finally {
    await cleanupApp(app);
  }
};

describe("middleware pipeline", () => {
  describe("security headers", () => {
    it("applies hardened security headers from configuration", async () => {
      await withTestApp(
        {
          security: {
            headers: {
              contentSecurityPolicy: "default-src 'self' https://cdn.lumi.dev;",
              referrerPolicy: "strict-origin",
              frameGuard: "DENY",
              permissionsPolicy: "geolocation=()",
              strictTransportSecurity: {
                maxAgeSeconds: 31_536_000,
                includeSubDomains: true,
                preload: true,
              },
              expectCt: {
                enforce: true,
                maxAgeSeconds: 86_400,
                reportUri: "https://ct.lumi.dev/report",
              },
              crossOriginEmbedderPolicy: "require-corp",
              crossOriginOpenerPolicy: "same-origin",
              crossOriginResourcePolicy: "same-site",
              xContentTypeOptions: "nosniff",
            },
          },
        },
        async ({ app, config }) => {
          const client = createApiClient(app);
          const response = await client.get("/test");

          expect(response.headers["content-security-policy"]).toBe(
            config.security.headers.contentSecurityPolicy,
          );
          expect(response.headers["x-frame-options"]).toBe(config.security.headers.frameGuard);
          expect(response.headers["strict-transport-security"]).toBe(
            "max-age=31536000; includeSubDomains; preload",
          );
          expect(response.headers["permissions-policy"]).toBe(
            config.security.headers.permissionsPolicy,
          );
          expect(response.headers["referrer-policy"]).toBe(config.security.headers.referrerPolicy);
          expect(response.headers["expect-ct"]).toBe(
            "max-age=86400, enforce, report-uri=https://ct.lumi.dev/report",
          );
        },
      );
    });
  });

  describe("CORS management", () => {
    it("allows configured origins and exposes headers", async () => {
      const allowedOrigin = "https://app.lumi.dev";
      await withTestApp(
        {
          security: {
            cors: {
              enabled: true,
              allowedOrigins: [allowedOrigin],
              allowedMethods: ["GET", "POST"],
              allowedHeaders: ["content-type", "authorization"],
              exposedHeaders: ["x-request-id"],
              allowCredentials: true,
              maxAgeSeconds: 600,
            },
          },
        },
        async ({ app }) => {
          const client = createApiClient(app);
          const response = await client.get("/test").set("Origin", allowedOrigin);

          expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
          expect(response.headers["access-control-expose-headers"]).toContain("x-request-id");
        },
      );
    });

    it("does not include CORS headers for disallowed origins", async () => {
      await withTestApp(
        {
          security: {
            cors: {
              enabled: true,
              allowedOrigins: ["https://safe.example.com"],
            },
          },
        },
        async ({ app }) => {
          const client = createApiClient(app);
          const response = await client.get("/test").set("Origin", "https://malicious.dev");

          expect(response.headers["access-control-allow-origin"]).toBeUndefined();
        },
      );
    });
  });

  describe("rate limiting", () => {
    it("enforces the global rate limit and returns Q2 error responses", async () => {
      await withTestApp(
        {
          security: {
            rateLimit: {
              enabled: true,
              points: 2,
              durationSeconds: 60,
              blockDurationSeconds: 60,
              strategy: "memory",
              routes: {
                auth: {
                  points: 5,
                  durationSeconds: 60,
                  blockDurationSeconds: 60,
                },
              },
            },
          },
        },
        async ({ app }) => {
          const client = createApiClient(app);
          await client.get("/test");
          await client.get("/test");
          const limited = await client.get("/test");

          expect(limited.status).toBe(429);
          expect(limited.headers["retry-after"]).toBe("60");
          expect(limited.body).toEqual(
            expect.objectContaining({
              success: false,
              error: expect.objectContaining({
                code: "RATE_LIMIT_EXCEEDED",
                message: expect.stringContaining("Too many requests"),
              }),
            }),
          );
        },
      );
    });

    it("applies stricter limits on authentication endpoints", async () => {
      await withTestApp(
        {
          security: {
            rateLimit: {
              enabled: true,
              points: 10,
              durationSeconds: 60,
              blockDurationSeconds: 60,
              strategy: "memory",
              routes: {
                auth: {
                  points: 1,
                  durationSeconds: 120,
                  blockDurationSeconds: 120,
                },
              },
            },
          },
        },
        async ({ app }) => {
          const client = createApiClient(app);
          await client
            .post("/api/v1/auth/login")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ email: "user@example.com" }));

          const limited = await client
            .post("/api/v1/auth/login")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ email: "user@example.com" }));

          expect(limited.status).toBe(429);
          expect(limited.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
          expect(limited.body.error.details.scope).toBe("auth");
        },
      );
    });
  });

  describe("request processing pipeline", () => {
    it("attaches and propagates request identifiers", async () => {
      await withTestApp({}, async ({ app }) => {
        const client = createApiClient(app);
        const first = await client.get("/test");
        expect(first.headers["x-request-id"]).toBeDefined();
        expect(first.body.data.requestId).toBe(first.headers["x-request-id"]);

        const customId = "client-trace-123";
        const second = await client.get("/test").set("X-Request-Id", customId);
        expect(second.headers["x-request-id"]).toBe(customId);
        expect(second.body.data.requestId).toBe(customId);
      });
    });

    it("sanitizes malicious payloads and prevents NoSQL injection vectors", async () => {
      await withTestApp({}, async ({ app }) => {
        const client = createApiClient(app);
        const response = await client
          .post("/echo")
          .set("Content-Type", "application/json")
          .query({ name: "<script>alert(1)</script>" })
          .send(
            JSON.stringify({
              name: '<img src="x" onerror="alert(1)">',
              profile: {
                bio: "<script>alert('xss')</script>",
              },
              $where: "malicious",
            }),
          );

        const { body, query } = response.body.data;
        expect(response.status).toBe(200);
        expect(body).not.toHaveProperty("$where");
        expect(body.name).not.toContain("<script>");
        expect(body.profile.bio).not.toContain("<script>");
        expect(query.name).not.toContain("<script>");
      });
    });
  });
});
