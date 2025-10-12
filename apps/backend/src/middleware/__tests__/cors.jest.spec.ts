import express from "express";
import type { NextFunction, Request, Response } from "express";

import { createApiClient } from "@lumi/testing";

import { createTestConfig } from "../../testing/config.js";
import { createCorsMiddleware } from "../cors.js";

describe("createCorsMiddleware", () => {
  it("returns no-op handlers when CORS is disabled", () => {
    const config = createTestConfig({
      security: {
        cors: {
          enabled: false,
        },
      },
    }).security.cors;

    const { middleware, preflight } = createCorsMiddleware(config);

    const next = jest.fn();
    middleware({} as Request, {} as Response, next as unknown as NextFunction);
    preflight({} as Request, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("allows wildcard origins when configured", async () => {
    const app = express();
    const config = createTestConfig({
      security: {
        cors: {
          enabled: true,
          allowedOrigins: ["*"],
        },
      },
    }).security.cors;

    const corsBundle = createCorsMiddleware(config);
    app.use(corsBundle.middleware);
    app.get("/ping", (_req, res) => {
      res.status(200).send("pong");
    });

    const client = createApiClient(app);
    const response = await client.get("/ping").set("Origin", "https://any.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://any.example");
  });
});
