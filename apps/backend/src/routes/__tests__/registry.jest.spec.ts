import { describe, expect, it } from "@jest/globals";

import {
  buildRequestPath,
  createRouteRegistrar,
  createRouteRegistry,
  getAllowedMethodsForPath,
  registerRoute,
} from "../registry.js";

describe("route registry utilities", () => {
  it("normalises methods to uppercase when registering routes", () => {
    const registry = createRouteRegistry();

    registerRoute(registry, "post", "/orders");

    expect(getAllowedMethodsForPath(registry, "/orders")).toEqual(["POST"]);
  });

  it("joins empty segments into root paths", () => {
    expect(buildRequestPath("", "")).toBe("/");
    expect(buildRequestPath("/", "/")).toBe("/");
  });

  it("trims extraneous slashes when combining prefixes", () => {
    expect(buildRequestPath("/api/", "/users/")).toBe("/api/users");
  });

  it("supports registrar helpers for nested prefixes", () => {
    const registry = createRouteRegistry();
    const register = createRouteRegistrar(registry, "//internal//");

    register("get", "//metrics");

    const storedPaths = [...registry.keys()];

    expect(storedPaths).toEqual(["//internal///metrics"]);
    expect(getAllowedMethodsForPath(registry, storedPaths[0]!)).toEqual(["GET"]);
  });

  it("returns an empty list when a path has no registered methods", () => {
    const registry = createRouteRegistry();
    registerRoute(registry, "get", "/known");

    expect(getAllowedMethodsForPath(registry, "/unknown")).toEqual([]);
  });
});
