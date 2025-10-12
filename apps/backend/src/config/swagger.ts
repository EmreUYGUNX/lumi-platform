import path from "node:path";

import type { OpenAPIV3_1 as OpenApi31 } from "openapi-types";
import swaggerJsdoc, { type Options as SwaggerJSDocOptions } from "swagger-jsdoc";
import type { SwaggerUiOptions } from "swagger-ui-express";

import type { ApplicationConfig } from "@lumi/types";

const API_SOURCE_GLOBS = [
  path.resolve(process.cwd(), "apps/backend/src/routes/**/*.ts"),
  path.resolve(process.cwd(), "src/routes/**/*.ts"),
] as const;

const HEALTH_RESPONSE_META_REF = "#/components/schemas/HealthResponseMeta" as const;
const STANDARD_SUCCESS_RESPONSE_REF = "#/components/schemas/StandardSuccessResponse" as const;
const HEALTH_SNAPSHOT_REF = "#/components/schemas/HealthSnapshot" as const;
const HEALTH_READINESS_DATA_REF = "#/components/schemas/HealthReadinessData" as const;
const HEALTH_LIVENESS_DATA_REF = "#/components/schemas/HealthLivenessData" as const;

const HEALTH_CHECK_VARIANTS = {
  comprehensive: "comprehensive",
  readiness: "readiness",
  liveness: "liveness",
} as const;

const ensureTrailingPath = (url: string, suffix: string): string => {
  const trimmed = url.replace(/\/+$/, "");
  const normalisedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${trimmed}${normalisedSuffix}`;
};

const buildServers = (config: ApplicationConfig): OpenApi31.ServerObject[] => {
  const primary = ensureTrailingPath(config.app.apiBaseUrl, "api");

  const servers: OpenApi31.ServerObject[] = [
    {
      url: primary,
      description: "Primary API entrypoint",
    },
  ];

  const localUrl = `http://localhost:${config.app.port}/api`;
  if (!primary.toLowerCase().startsWith(localUrl.toLowerCase())) {
    servers.push({
      url: localUrl,
      description: "Local development",
    });
  }

  return servers;
};

const standardComponents: OpenApi31.ComponentsObject = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Reserved for authenticated endpoints. Full RBAC enforcement will arrive in Phase 3.",
    },
    basicAuth: {
      type: "http",
      scheme: "basic",
      description: "Used for internal-only endpoints such as metrics collection.",
    },
    serviceToken: {
      type: "apiKey",
      in: "header",
      name: "X-Service-Token",
      description:
        "Service-to-service authentication placeholder. Exact contract will be finalised in Phase 2.",
    },
  },
  schemas: {
    StandardSuccessResponse: {
      type: "object",
      required: ["success", "data"],
      properties: {
        success: {
          type: "boolean",
          enum: [true],
          description: "Indicates the request completed successfully.",
        },
        data: {
          description: "Response payload specific to the request.",
        },
        meta: {
          type: "object",
          additionalProperties: true,
          description: "Optional metadata contextualising the response.",
        },
      },
    },
    ErrorDetails: {
      type: "object",
      additionalProperties: true,
      description: "Additional information to help diagnose the failure.",
    },
    StandardError: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          description: "Stable machine-readable error code.",
          examples: ["FORBIDDEN", "UNAUTHORIZED"],
        },
        message: {
          type: "string",
          description: "Human readable summary of the error.",
          examples: ["Administrator privileges required."],
        },
        details: {
          $ref: "#/components/schemas/ErrorDetails",
        },
      },
    },
    StandardErrorResponse: {
      type: "object",
      required: ["success", "error"],
      properties: {
        success: {
          type: "boolean",
          enum: [false],
          description: "Indicates the request failed.",
        },
        error: {
          $ref: "#/components/schemas/StandardError",
        },
        meta: {
          type: "object",
          additionalProperties: true,
          description: "Optional metadata contextualising the error.",
        },
      },
    },
    HealthComponent: {
      type: "object",
      required: ["status", "summary", "observedAt"],
      properties: {
        status: {
          type: "string",
          enum: ["healthy", "degraded", "unhealthy"],
          description: "Component health status derived from the latest probe.",
        },
        summary: {
          type: "string",
          description: "High level description of the component state.",
        },
        details: {
          type: "object",
          additionalProperties: true,
          description: "Detailed diagnostic data supplied by the component probe.",
        },
        severity: {
          type: "string",
          enum: ["info", "warn", "error", "fatal"],
          description: "Recommended alerting severity for the reported state.",
        },
        observedAt: {
          type: "string",
          format: "date-time",
          description: "UTC timestamp when the component was evaluated.",
        },
      },
    },
    HealthSnapshot: {
      type: "object",
      required: ["status", "uptimeSeconds", "timestamp", "components"],
      properties: {
        status: {
          type: "string",
          enum: ["healthy", "degraded", "unhealthy"],
          description: "Overall system health derived from the individual component states.",
        },
        uptimeSeconds: {
          type: "number",
          format: "double",
          description: "Node.js process uptime at the time of the snapshot.",
        },
        responseTimeMs: {
          type: "number",
          format: "double",
          description: "Time taken to evaluate all health checks, in milliseconds.",
        },
        timestamp: {
          type: "string",
          format: "date-time",
          description: "UTC timestamp when the snapshot was generated.",
        },
        components: {
          type: "object",
          additionalProperties: {
            $ref: "#/components/schemas/HealthComponent",
          },
          description: "Collection of component health summaries keyed by identifier.",
        },
        metrics: {
          type: "object",
          properties: {
            memory: {
              type: "object",
              additionalProperties: {
                type: "number",
                format: "double",
              },
              description: "Per-segment memory usage in bytes.",
            },
            cpu: {
              type: "object",
              properties: {
                userMs: {
                  type: "number",
                  format: "double",
                },
                systemMs: {
                  type: "number",
                  format: "double",
                },
              },
            },
            load: {
              type: "object",
              properties: {
                averages: {
                  type: "array",
                  items: {
                    type: "number",
                    format: "double",
                  },
                  minItems: 3,
                  maxItems: 3,
                  description: "1, 5, and 15 minute load averages.",
                },
              },
            },
          },
        },
      },
    },
    HealthResponseMeta: {
      type: "object",
      properties: {
        environment: {
          type: "string",
        },
        service: {
          type: "string",
        },
        check: {
          type: "string",
          description: "Identifier for the health check variant.",
        },
        generatedAt: {
          type: "string",
          format: "date-time",
          description: "Timestamp representing when the metadata snapshot was captured.",
        },
      },
    },
    HealthComprehensiveResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              $ref: HEALTH_SNAPSHOT_REF,
            },
            meta: {
              allOf: [
                {
                  $ref: HEALTH_RESPONSE_META_REF,
                },
                {
                  type: "object",
                  properties: {
                    check: {
                      type: "string",
                      enum: [HEALTH_CHECK_VARIANTS.comprehensive],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    HealthReadinessData: {
      type: "object",
      required: ["status", "timestamp"],
      properties: {
        status: {
          type: "string",
          enum: ["healthy", "degraded", "unhealthy"],
        },
        timestamp: {
          type: "string",
          format: "date-time",
        },
      },
    },
    HealthReadinessResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              $ref: HEALTH_READINESS_DATA_REF,
            },
            meta: {
              allOf: [
                {
                  $ref: HEALTH_RESPONSE_META_REF,
                },
                {
                  type: "object",
                  properties: {
                    check: {
                      type: "string",
                      enum: [HEALTH_CHECK_VARIANTS.readiness],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    HealthLivenessData: {
      type: "object",
      required: ["status", "uptimeSeconds", "timestamp"],
      properties: {
        status: {
          type: "string",
          enum: ["healthy"],
        },
        uptimeSeconds: {
          type: "number",
          format: "double",
        },
        timestamp: {
          type: "string",
          format: "date-time",
        },
      },
    },
    HealthLivenessResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              $ref: HEALTH_LIVENESS_DATA_REF,
            },
            meta: {
              allOf: [
                {
                  $ref: HEALTH_RESPONSE_META_REF,
                },
                {
                  type: "object",
                  properties: {
                    check: {
                      type: "string",
                      enum: [HEALTH_CHECK_VARIANTS.liveness],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  },
};

const buildSwaggerDefinition = (config: ApplicationConfig): OpenApi31.Document => ({
  openapi: "3.1.0",
  info: {
    title: `${config.app.name} API`,
    version: "1.0.0",
    description:
      "Express API baseline for the Lumi commerce platform. The documentation reflects the Phase 1 middleware and health endpoints.",
    contact: {
      name: "Lumi Platform Engineering",
      email: "engineering@lumi.example",
    },
    license: {
      name: "Proprietary - Lumi Internal Use Only",
    },
  },
  servers: buildServers(config),
  tags: [
    {
      name: "Health",
      description: "Service health and readiness checks.",
    },
    {
      name: "Observability",
      description: "Internal observability surfaces including metrics and diagnostics.",
    },
    {
      name: "Admin",
      description:
        "Administrative endpoints reserved for authorised operators. Currently guarded with strict 403 responses until RBAC is implemented.",
    },
  ],
  components: standardComponents,
});

const buildSwaggerJSDocOptions = (config: ApplicationConfig): SwaggerJSDocOptions => ({
  definition: buildSwaggerDefinition(config),
  apis: [...API_SOURCE_GLOBS],
  failOnErrors: true,
});

export const createOpenApiDocument = (config: ApplicationConfig): OpenApi31.Document =>
  swaggerJsdoc(buildSwaggerJSDocOptions(config)) as OpenApi31.Document;

export const getSwaggerUiOptions = (config: ApplicationConfig): SwaggerUiOptions => ({
  customSiteTitle: `${config.app.name} API Reference`,
  swaggerOptions: {
    url: "/api/docs/openapi.json",
    docExpansion: "list",
    displayRequestDuration: true,
    defaultModelExpandDepth: 2,
    defaultModelsExpandDepth: 1,
    persistAuthorization: true,
    syntaxHighlight: {
      activated: true,
    },
    operationsSorter: "alpha",
    tagsSorter: "alpha",
  },
});

export const swaggerSourceGlobs = API_SOURCE_GLOBS;
