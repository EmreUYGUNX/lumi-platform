import { createServer } from "node:http";

import { afterAll, describe, expect, it } from "@jest/globals";

import { createApiClient } from "../api/supertest.js";

describe("createApiClient", () => {
  it("throws when the HTTP handler is missing", () => {
    expect(() => createApiClient(undefined as never)).toThrow("Expected an HTTP handler");
  });

  describe("with a Node HTTP handler", () => {
    const server = createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    afterAll(() => {
      if (server.listening) {
        server.close();
      }
    });

    it("creates a SuperTest client that can make requests", async () => {
      const client = createApiClient(server);

      const response = await client.get("/health").expect(200);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect(response).toBeHttpStatus(200);
    });
  });
});
