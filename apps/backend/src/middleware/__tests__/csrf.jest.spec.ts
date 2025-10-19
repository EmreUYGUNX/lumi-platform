import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

import { createTestConfig } from "../../testing/config.js";
import { createCsrfMiddleware } from "../csrf.js";

const createApp = () => {
  const config = createTestConfig();
  const csrfBundle = createCsrfMiddleware(config);
  const app = express();

  app.use(cookieParser());
  app.use(csrfBundle.issueToken);
  app.use(csrfBundle.validate);

  app.get("/token", (req, res) => {
    res.json({ token: res.locals.csrfToken });
  });

  app.post("/mutation", (req, res) => {
    res.json({ ok: true });
  });

  return { app };
};

describe("createCsrfMiddleware", () => {
  it("issues a CSRF token cookie when none exists", async () => {
    const { app } = createApp();

    const response = await request(app).get("/token").expect(200);
    const setCookieHeader = response.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

    expect(response.body.token).toBeTruthy();
    expect(cookieHeader).toContain("csrfToken=");
  });

  it("allows state-changing requests when bearer authorization is present", async () => {
    const { app } = createApp();

    await request(app).post("/mutation").set("Authorization", "Bearer access-token").expect(200);
  });

  it("rejects state-changing requests that rely on cookies without matching CSRF header", async () => {
    const { app } = createApp();
    const csrfToken = "test-csrf-token";

    const response = await request(app)
      .post("/mutation")
      .set("Cookie", [`refreshToken=refresh-token`, `csrfToken=${csrfToken}`])
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("permits state-changing requests when header and cookie tokens match", async () => {
    const { app } = createApp();
    const csrfToken = "matching-token";

    await request(app)
      .post("/mutation")
      .set("Cookie", [`refreshToken=refresh-token`, `csrfToken=${csrfToken}`])
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
  });
});
