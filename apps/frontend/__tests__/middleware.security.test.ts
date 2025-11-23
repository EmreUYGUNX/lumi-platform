import { describe, expect, it, beforeEach } from "vitest";

import { NextRequest } from "next/server";

import { middleware } from "../middleware";

const buildRequest = (path: string, options?: { method?: string; headers?: HeadersInit }) =>
  new NextRequest(new URL(`http://localhost${path}`), {
    method: options?.method ?? "GET",
    headers: options?.headers,
  });

describe("middleware security", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_REQUIRE_AUTH_GUARDS: "true" };
  });

  it("redirects unauthenticated protected POST without CSRF header", () => {
    const req = buildRequest("/dashboard", { method: "POST" });
    const res = middleware(req);
    expect(res.headers.get("location")).toContain("/403");
  });

  it("redirects unauthenticated dashboard GET to login", () => {
    const req = buildRequest("/dashboard");
    const res = middleware(req);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("sets CSRF cookie when accessing auth route", () => {
    const req = buildRequest("/login");
    const res = middleware(req);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("lumi.csrf");
  });
});
