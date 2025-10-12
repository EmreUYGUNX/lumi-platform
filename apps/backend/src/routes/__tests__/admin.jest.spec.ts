// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import Transport from "winston-transport";

import { resetEnvironmentCache } from "../../config/env.js";
import { registerLogTransport, unregisterLogTransport } from "../../lib/logger.js";
import { createTestConfig } from "../../testing/config.js";
import { createAdminRouter } from "../admin.js";

class MemoryTransport extends Transport {
  public readonly events: Record<string, unknown>[] = [];

  constructor(level = "warn") {
    super({ level });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  override log(info: unknown, callback: () => void): void {
    this.events.push(info as Record<string, unknown>);
    callback();
  }
}

afterEach(() => {
  resetEnvironmentCache();
});

describe("admin router placeholders", () => {
  it("returns strict 403 responses for all admin routes", async () => {
    const transportName = `admin-router-test-${Date.now()}`;
    const transport = new MemoryTransport("warn");
    registerLogTransport(transportName, transport);

    try {
      const app = express();
      const config = createTestConfig({ app: { name: "Lumi Test Environment" } });

      app.use("/admin", createAdminRouter(config));

      const response = await request(app).get("/admin/users").expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.details.resource).toBe("admin.users.read");
      expect(response.body.meta).toHaveProperty("timestamp");

      const logEntry = transport.events.find(
        (event) =>
          event.level === "warn" && event.message === "Blocked unauthorised admin access attempt",
      );
      expect(logEntry?.metadata).toMatchObject({
        resource: "admin.users.read",
        path: "/admin/users",
      });
    } finally {
      unregisterLogTransport(transportName);
    }
  });

  it("registers placeholder routes with the provided registrar", () => {
    const registerRoute = jest.fn();

    createAdminRouter(createTestConfig(), { registerRoute });

    expect(registerRoute).toHaveBeenCalledWith("GET", "/users");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/users");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/audit-log");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/reports/sales");
  });

  it("logs each unauthorised attempt with request metadata", async () => {
    const transportName = `admin-router-test-${Date.now()}-meta`;
    const transport = new MemoryTransport("warn");
    registerLogTransport(transportName, transport);

    try {
      const app = express();
      const config = createTestConfig({ app: { name: "Lumi Test Environment" } });

      app.use("/admin", createAdminRouter(config));

      await request(app)
        .get("/admin/reports/sales")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(403);

      const logEntry = transport.events.find(
        (event) =>
          event.level === "warn" && event.message === "Blocked unauthorised admin access attempt",
      );

      expect(logEntry?.metadata).toMatchObject({
        resource: "admin.reports.sales",
        method: "GET",
      });
    } finally {
      unregisterLogTransport(transportName);
    }
  });
});
