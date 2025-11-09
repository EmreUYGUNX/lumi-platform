import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import swaggerJsdoc, { type Options as SwaggerJSDocOptions } from "swagger-jsdoc";

import { getCoreApiOpenApiDocument } from "@lumi/shared";
import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../testing/config.js";
import { createOpenApiDocument, getSwaggerUiOptions } from "../swagger.js";

jest.mock("swagger-jsdoc", () => {
  const mock = jest.fn();
  return {
    __esModule: true,
    default: mock,
  };
});

jest.mock("@lumi/shared", () => ({
  __esModule: true,
  getCoreApiOpenApiDocument: jest.fn(() => ({
    openapi: "3.1.0",
    info: {
      title: "Shared Spec",
      version: "1.0.0",
    },
    tags: [
      {
        name: "Catalog",
        description: "Shared catalog routes",
      },
    ],
    servers: [
      {
        url: "https://shared.spec/api",
        description: "Shared reference",
      },
    ],
    components: {
      schemas: {
        SharedProduct: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/api/v1/products": {
        get: {
          summary: "List products",
        },
      },
    },
  })),
}));

const mockedSwaggerJsdoc = jest.mocked(swaggerJsdoc);
const mockedCoreSpec = jest.mocked(getCoreApiOpenApiDocument);

const createConfig = (overrides: Partial<ApplicationConfig["app"]> = {}): ApplicationConfig =>
  createTestConfig({
    app: {
      name: "Lumi Platform",
      apiBaseUrl: "https://api.lumi.dev",
      frontendUrl: "https://app.lumi.dev",
      port: 3000,
      environment: "test",
      ...overrides,
    },
  });

describe("swagger configuration", () => {
  beforeEach(() => {
    mockedSwaggerJsdoc.mockReset();
    mockedSwaggerJsdoc.mockImplementation(
      (options?: SwaggerJSDocOptions) => (options?.definition ?? {}) as object,
    );
    mockedCoreSpec.mockClear();
  });

  it("builds OpenAPI definition with local fallback server when necessary", () => {
    const config = createConfig({ apiBaseUrl: "https://api.lumi.dev/v1" });
    const document = createOpenApiDocument(config);

    expect(mockedSwaggerJsdoc).toHaveBeenCalledWith(
      expect.objectContaining({
        apis: expect.arrayContaining([expect.stringContaining("routes")]),
        failOnErrors: true,
      }),
    );

    expect(document.servers).toEqual([
      {
        url: "https://api.lumi.dev/v1/api",
        description: "Primary API entrypoint",
      },
      {
        url: "http://localhost:3000/api",
        description: "Local development",
      },
      {
        url: "https://shared.spec/api",
        description: "Shared reference",
      },
    ]);
    expect(mockedCoreSpec).toHaveBeenCalled();
  });

  it("omits local server when primary URL already targets localhost", () => {
    const config = createConfig({ apiBaseUrl: "http://localhost:3000" });
    const document = createOpenApiDocument(config);

    expect(document.servers).toEqual([
      {
        url: "http://localhost:3000/api",
        description: "Primary API entrypoint",
      },
      {
        url: "https://shared.spec/api",
        description: "Shared reference",
      },
    ]);
  });

  it("returns customised Swagger UI options", () => {
    const options = getSwaggerUiOptions(createConfig());

    expect(options.customSiteTitle).toBe("Lumi Platform API Reference");
    expect(options.swaggerOptions).toMatchObject({
      url: "/api/docs/openapi.json",
      docExpansion: "list",
      displayRequestDuration: true,
      tryItOutEnabled: true,
      supportedSubmitMethods: ["get", "post", "put", "patch", "delete"],
      persistAuthorization: true,
    });
  });
});
