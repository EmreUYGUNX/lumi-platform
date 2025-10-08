import type { SuperTest, Test } from "supertest";
import request from "supertest";

/**
 * Creates a SuperTest client for the provided HTTP handler.
 * Accepts Express, Fastify, or any framework exposing a Node HTTP server interface.
 */
export function createApiClient(handler: Parameters<typeof request>[0]): SuperTest<Test> {
  if (!handler) {
    throw new Error("Expected an HTTP handler when creating an API client");
  }

  return request(handler);
}

export type ApiClient = SuperTest<Test>;
