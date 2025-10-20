import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import swaggerJsdoc from "swagger-jsdoc";

import type { ApplicationConfig } from "@lumi/types";

import { createOpenApiDocument, getSwaggerUiOptions } from "../swagger.js";

jest.mock("swagger-jsdoc", () => {
  const mock = jest.fn();
  return {
    __esModule: true,
    default: mock,
  };
});

const mockedSwaggerJsdoc = jest.mocked(swaggerJsdoc);

const createConfig = (overrides: Partial<ApplicationConfig["app"]> = {}): ApplicationConfig =>
  ({
    app: {
      name: "Lumi Platform",
      apiBaseUrl: "https://api.lumi.dev",
      frontendUrl: "https://app.lumi.dev",
      port: 3000,
      environment: "test",
      ...overrides,
    },
  }) as unknown as ApplicationConfig;

describe("swagger configuration", () => {
  beforeEach(() => {
    mockedSwaggerJsdoc.mockReset();
    mockedSwaggerJsdoc.mockImplementation((options) => (options?.definition ?? {}) as object);
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
    ]);
  });

  it("omits local server when primary URL already targets localhost", () => {
    const config = createConfig({ apiBaseUrl: "http://localhost:3000" });
    const document = createOpenApiDocument(config);

    expect(document.servers).toEqual([
      {
        url: "http://localhost:3000/api",
        description: "Primary API entrypoint",
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
      persistAuthorization: true,
    });
  });
});
