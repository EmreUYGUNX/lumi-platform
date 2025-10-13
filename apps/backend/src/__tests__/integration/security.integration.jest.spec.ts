import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import { withTestApp } from "../../testing/index.js";

describe("security middleware integration", () => {
  it("enforces global rate limiting thresholds", async () => {
    await withTestApp(
      async ({ app }) => {
        const agent = request(app);

        await agent.get("/api/v1/health").set("X-Forwarded-For", "198.51.100.1").expect(200);
        await agent.get("/api/v1/health").set("X-Forwarded-For", "198.51.100.1").expect(200);

        const limited = await agent
          .get("/api/v1/health")
          .set("X-Forwarded-For", "198.51.100.1")
          .expect(429);

        expect(limited.body.success).toBe(false);
        expect(limited.body.error).toMatchObject({
          code: "RATE_LIMIT_EXCEEDED",
          message: expect.any(String),
          details: expect.objectContaining({
            retryAfterSeconds: expect.any(Number),
            scope: "global",
          }),
        });
      },
      {
        configOverrides: {
          security: {
            rateLimit: {
              points: 2,
              durationSeconds: 60,
              blockDurationSeconds: 120,
            },
          },
        },
      },
    );
  });

  it("applies strict CORS allow-listing", async () => {
    const ALLOWED_ORIGIN = "https://admin.lumi.test";
    const DISALLOWED_ORIGIN = "https://malicious.invalid";

    await withTestApp(
      async ({ app }) => {
        const allowed = await request(app)
          .get("/api/v1/health")
          .set("Origin", ALLOWED_ORIGIN)
          .expect(200);

        expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
        expect(allowed.headers.vary).toContain("Origin");

        const denied = await request(app)
          .get("/api/v1/health")
          .set("Origin", DISALLOWED_ORIGIN)
          .expect(200);

        expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
      },
      {
        configOverrides: {
          security: {
            cors: {
              allowedOrigins: [ALLOWED_ORIGIN],
            },
          },
        },
      },
    );
  });
});
