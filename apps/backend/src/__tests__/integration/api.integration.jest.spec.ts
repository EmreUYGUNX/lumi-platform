import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { registerRoute } from "../../routes/registry.js";
import { createTestApp, withTestApp } from "../../testing/index.js";

const encodeBasicAuth = (username: string, password: string) => {
  const credentials = `${username}:${password}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
};

const METRICS_AUTH = {
  username: "metrics-user",
  password: "metrics-pass",
} as const;

describe("express application integration", () => {
  it("returns a health snapshot with Q2 response structure", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.status).toBe("string");
      expect(response.body.data.components).toBeDefined();
      expect(response.body.meta).toEqual(
        expect.objectContaining({
          environment: expect.any(String),
        }),
      );

      if (typeof response.body.meta.generatedAt === "string") {
        expect(new Date(response.body.meta.generatedAt).toString()).not.toBe("Invalid Date");
      }
    });
  });

  it("guards metrics behind basic authentication", async () => {
    await withTestApp(
      async ({ app }) => {
        await request(app).get("/api/v1/health").expect(200);

        const unauthenticated = await request(app).get("/internal/metrics").expect(401);
        expect(unauthenticated.body.success).toBe(false);
        expect(unauthenticated.body.error.code).toBe("UNAUTHORIZED");
        expect(unauthenticated.headers["www-authenticate"]).toContain("Basic realm");

        const authorised = await request(app)
          .get("/internal/metrics")
          .set("Authorization", encodeBasicAuth(METRICS_AUTH.username, METRICS_AUTH.password));

        expect([200, 204, 503]).toContain(authorised.status);

        if (authorised.status === 200) {
          expect(authorised.headers["content-type"]).toContain("text/plain");
          expect(authorised.text.length).toBeGreaterThan(0);
        } else if (authorised.status === 204) {
          expect(authorised.text).toBe("");
        } else {
          expect(authorised.status).toBe(503);
          expect(authorised.body.success).toBe(false);
          expect(authorised.body.error.code).toBe("METRICS_DISABLED");
        }
      },
      {
        configOverrides: {
          observability: {
            metrics: {
              basicAuth: {
                username: METRICS_AUTH.username,
                password: METRICS_AUTH.password,
              },
            },
          },
        },
      },
    );
  });

  it("emits Q2 compliant payloads for unknown routes", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/unknown-resource").expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: expect.any(String),
          },
        }),
      );
    });
  });

  it("captures thrown errors and returns sanitised responses", async () => {
    const context = createTestApp();

    try {
      const { app } = context;
      const registry = app.get("routeRegistry");

      if (registry) {
        registerRoute(registry, "GET", "/api/v1/testing/error");
      }

      app.get("/api/v1/testing/error", () => {
        throw new Error("integration explosion");
      });

      const refreshHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;
      refreshHandlers?.();

      const response = await request(app).get("/api/v1/testing/error").expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(response.body.error).not.toHaveProperty("stack");
    } finally {
      await context.cleanup();
    }
  });

  it("blocks admin endpoints for unauthenticated users", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/admin/users").expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.details.resource).toBeDefined();
    });
  });
});
