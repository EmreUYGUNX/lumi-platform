import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";

describe("apiClient error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("throws an ApiClientError when the backend returns a Q2 error payload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Login required" },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const schema = z.object({ greeting: z.string() });
    await expect(
      apiClient.get("/auth/profile", {
        dataSchema: schema,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
      message: "Login required",
    });
  });

  it("retries transient errors before succeeding", async () => {
    vi.useFakeTimers();
    const responses: Promise<Response>[] = [
      Promise.reject(new TypeError("network down")),
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: { greeting: "hello" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    ];

    vi.spyOn(global, "fetch").mockImplementation(() => responses.shift() ?? Promise.reject());

    const schema = z.object({ greeting: z.string() });
    const request = apiClient.get("/status", { dataSchema: schema, retry: 1 });

    await vi.runAllTimersAsync();
    const response = await request;

    expect(response.data.greeting).toBe("hello");
  });

  it("serializes request bodies and query params", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      expect(url?.toString()).toContain("/catalog/products");
      expect(url?.toString()).toContain("page=2");
      expect(url?.toString()).toContain("search=lamp");
      expect(options?.headers).toMatchObject({
        Accept: "application/json",
        "Content-Type": "application/json",
      });
      expect(options?.body).toBe(JSON.stringify({ title: "Test" }));
      return new Response(
        JSON.stringify({
          success: true,
          data: { ok: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const schema = z.object({ ok: z.boolean() });
    const result = await apiClient.post("/catalog/products", {
      dataSchema: schema,
      body: { title: "Test" },
      query: { page: 2, search: "lamp" },
    });

    expect(result.data.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("raises an error when JSON parsing fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("not-json", { status: 200 }));

    const schema = z.object({ message: z.string() });
    await expect(
      apiClient.get("/broken-json", {
        dataSchema: schema,
      }),
    ).rejects.toMatchObject({ code: "INVALID_JSON" });
  });
});
