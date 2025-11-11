import { afterEach, describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";

import { createTestConfig } from "../../testing/config.js";
import { registerMiddleware } from "../index.js";

const buildApp = () => {
  const config = createTestConfig({
    observability: {
      logs: {
        consoleEnabled: false,
        request: {
          sampleRate: 0,
        },
      },
    },
  });

  const app = express();
  registerMiddleware(app, config);

  return app;
};

const cleanupApp = async (app: express.Express) => {
  const teardown = app.get("rateLimiterCleanup") as (() => Promise<void>) | undefined;
  await teardown?.();
};

describe("compression middleware", () => {
  let app: express.Express;

  afterEach(async () => {
    if (app) {
      await cleanupApp(app);
    }
  });

  it("compresses responses exceeding the configured threshold", async () => {
    app = buildApp();
    app.get("/payload", (_req, res) => {
      res.json({ data: "x".repeat(2048) });
    });

    const response = await request(app)
      .get("/payload")
      .set("Accept-Encoding", "gzip, deflate")
      .expect(200);

    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.body.data.data.length).toBe(2048);
  });

  it("avoids compressing small payloads to preserve latency", async () => {
    app = buildApp();
    app.get("/tiny", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .get("/tiny")
      .set("Accept-Encoding", "gzip, deflate")
      .expect(200);

    expect(response.headers["content-encoding"]).toBeUndefined();
  });
});
