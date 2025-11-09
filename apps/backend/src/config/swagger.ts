/* istanbul ignore file */

/* Swagger config exercised through documentation smoke tests */
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
const STANDARD_ERROR_RESPONSE_REF = "#/components/schemas/StandardErrorResponse" as const;
const AUTH_USER_PROFILE_REF = "#/components/schemas/AuthUserProfile" as const;
const AUTH_REGISTER_RESPONSE_REF = "#/components/schemas/AuthRegisterResponse" as const;
const AUTH_LOGIN_RESPONSE_REF = "#/components/schemas/AuthLoginResponse" as const;
const AUTH_REFRESH_RESPONSE_REF = "#/components/schemas/AuthRefreshResponse" as const;
const AUTH_LOGOUT_RESPONSE_REF = "#/components/schemas/AuthLogoutResponse" as const;
const AUTH_LOGOUT_ALL_RESPONSE_REF = "#/components/schemas/AuthLogoutAllResponse" as const;
const AUTH_USER_RESPONSE_REF = "#/components/schemas/AuthUserResponse" as const;
const AUTH_MESSAGE_RESPONSE_REF = "#/components/schemas/AuthMessageResponse" as const;
const REGISTER_REQUEST_REF = "#/components/schemas/RegisterRequest" as const;
const LOGIN_REQUEST_REF = "#/components/schemas/LoginRequest" as const;
const VERIFY_EMAIL_REQUEST_REF = "#/components/schemas/VerifyEmailRequest" as const;
const FORGOT_PASSWORD_REQUEST_REF = "#/components/schemas/ForgotPasswordRequest" as const;
const RESET_PASSWORD_REQUEST_REF = "#/components/schemas/ResetPasswordRequest" as const;
const CHANGE_PASSWORD_REQUEST_REF = "#/components/schemas/ChangePasswordRequest" as const;
const AUTH_UNAUTHENTICATED_DESCRIPTION = "Caller is not authenticated." as const;
const AUTH_INVALID_SESSION_DESCRIPTION =
  "Caller is not authenticated or session is invalid." as const;

const HEALTH_CHECK_VARIANTS = {
  comprehensive: "comprehensive",
  readiness: "readiness",
  liveness: "liveness",
} as const;

const USER_STATUS_VALUES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
const PRODUCT_STATUS_VALUES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const INVENTORY_POLICY_VALUES = ["TRACK", "CONTINUE", "DENY"] as const;
const MEDIA_TYPE_VALUES = ["IMAGE", "VIDEO", "DOCUMENT"] as const;
const MEDIA_PROVIDER_VALUES = ["CLOUDINARY", "S3"] as const;
const CART_STATUS_VALUES = ["ACTIVE", "CHECKED_OUT", "ABANDONED"] as const;
const ORDER_STATUS_VALUES = [
  "PENDING",
  "PAID",
  "FULFILLED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
const PAYMENT_STATUS_VALUES = ["INITIATED", "AUTHORIZED", "SETTLED", "FAILED", "REFUNDED"] as const;
const PAYMENT_PROVIDER_VALUES = ["IYZICO", "STRIPE", "PAYPAL", "MANUAL"] as const;

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

/* eslint-disable sonarjs/no-duplicate-string */
const standardComponents = {
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
    AuthUserProfile: {
      type: "object",
      description: "Canonical representation of an authenticated user.",
      required: ["id", "email", "emailVerified", "status", "roles", "permissions"],
      properties: {
        id: {
          type: "string",
          format: "uuid",
          description: "Stable user identifier.",
        },
        email: {
          type: "string",
          format: "email",
          description: "Normalised email address.",
        },
        firstName: {
          type: "string",
          nullable: true,
          description: "Optional given name.",
        },
        lastName: {
          type: "string",
          nullable: true,
          description: "Optional family name.",
        },
        phone: {
          type: "string",
          nullable: true,
          description: "Optional E.164 formatted phone number.",
        },
        emailVerified: {
          type: "boolean",
          description: "Indicates whether the email address has been confirmed.",
        },
        status: {
          type: "string",
          description: "Account lifecycle state.",
          enum: [...USER_STATUS_VALUES],
        },
        roles: {
          type: "array",
          description: "Role slugs assigned to the user.",
          items: {
            type: "string",
          },
        },
        permissions: {
          type: "array",
          description: "Permission keys granted to the user.",
          items: {
            type: "string",
          },
        },
      },
    },
    AuthTokenEnvelope: {
      type: "object",
      description: "Signed JWT payload metadata.",
      required: ["token", "expiresAt"],
      properties: {
        token: {
          type: "string",
          description: "Signed JWT token value.",
        },
        expiresAt: {
          type: "string",
          format: "date-time",
          description: "Token expiry in UTC.",
        },
      },
    },
    AuthTokenPair: {
      type: "object",
      description: "Access and refresh token bundle.",
      required: ["accessToken", "refreshToken"],
      properties: {
        accessToken: {
          $ref: "#/components/schemas/AuthTokenEnvelope",
        },
        refreshToken: {
          $ref: "#/components/schemas/AuthTokenEnvelope",
        },
      },
    },
    AuthRegisterResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: ["user", "emailVerification"],
              properties: {
                user: {
                  $ref: AUTH_USER_PROFILE_REF,
                },
                emailVerification: {
                  type: "object",
                  required: ["expiresAt"],
                  properties: {
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                      description: "Expiry timestamp for the verification token.",
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    AuthLoginResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: [
                "sessionId",
                "accessToken",
                "refreshToken",
                "accessTokenExpiresAt",
                "refreshTokenExpiresAt",
                "user",
              ],
              properties: {
                sessionId: {
                  type: "string",
                  format: "uuid",
                  description: "Active session identifier.",
                },
                accessToken: {
                  type: "string",
                  description: "Signed access token for authorising API calls.",
                },
                refreshToken: {
                  type: "string",
                  description: "Signed refresh token issued alongside the cookie.",
                },
                accessTokenExpiresAt: {
                  type: "string",
                  format: "date-time",
                  description: "Expiry for the access token.",
                },
                refreshTokenExpiresAt: {
                  type: "string",
                  format: "date-time",
                  description: "Expiry for the refresh token.",
                },
                user: {
                  $ref: AUTH_USER_PROFILE_REF,
                },
              },
            },
          },
        },
      ],
    },
    AuthRefreshResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: [
                "sessionId",
                "accessToken",
                "refreshToken",
                "accessTokenExpiresAt",
                "refreshTokenExpiresAt",
                "user",
              ],
              properties: {
                sessionId: {
                  type: "string",
                  format: "uuid",
                },
                accessToken: {
                  type: "string",
                },
                refreshToken: {
                  type: "string",
                },
                accessTokenExpiresAt: {
                  type: "string",
                  format: "date-time",
                },
                refreshTokenExpiresAt: {
                  type: "string",
                  format: "date-time",
                },
                user: {
                  $ref: AUTH_USER_PROFILE_REF,
                },
              },
            },
          },
        },
      ],
    },
    AuthLogoutResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: ["sessionId"],
              properties: {
                sessionId: {
                  type: "string",
                  format: "uuid",
                  description: "Identifier of the revoked session.",
                },
              },
            },
          },
        },
      ],
    },
    AuthLogoutAllResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: ["revokedSessions"],
              properties: {
                revokedSessions: {
                  type: "integer",
                  minimum: 0,
                  description: "Number of sessions revoked during the operation.",
                },
              },
            },
          },
        },
      ],
    },
    AuthUserResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: ["user"],
              properties: {
                user: {
                  $ref: AUTH_USER_PROFILE_REF,
                },
              },
            },
          },
        },
      ],
    },
    AuthMessageResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              required: ["message"],
              properties: {
                message: {
                  type: "string",
                  description: "Informational message for the caller.",
                },
              },
            },
          },
        },
      ],
    },
    RegisterRequest: {
      type: "object",
      required: ["email", "password", "firstName", "lastName"],
      properties: {
        email: {
          type: "string",
          format: "email",
          description: "Unique email address for the account.",
        },
        password: {
          type: "string",
          minLength: 12,
          description:
            "Must satisfy the platform password policy (minimum 12 characters, upper and lower case, number, special character).",
        },
        firstName: {
          type: "string",
          minLength: 2,
          maxLength: 100,
        },
        lastName: {
          type: "string",
          minLength: 2,
          maxLength: 100,
        },
        phone: {
          type: "string",
          nullable: true,
          description: "Optional phone number in international format.",
        },
      },
    },
    LoginRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: {
          type: "string",
          format: "email",
        },
        password: {
          type: "string",
          minLength: 1,
          maxLength: 256,
        },
      },
    },
    VerifyEmailRequest: {
      type: "object",
      required: ["token"],
      properties: {
        token: {
          type: "string",
          minLength: 10,
          description: "Signed verification token received via email.",
        },
      },
    },
    ForgotPasswordRequest: {
      type: "object",
      required: ["email"],
      properties: {
        email: {
          type: "string",
          format: "email",
        },
      },
    },
    ResetPasswordRequest: {
      type: "object",
      required: ["token", "password"],
      properties: {
        token: {
          type: "string",
          minLength: 10,
          description: "Password reset token received via email.",
        },
        password: {
          type: "string",
          minLength: 12,
          description: "New password satisfying the platform policy.",
        },
      },
    },
    ChangePasswordRequest: {
      type: "object",
      required: ["currentPassword", "newPassword"],
      properties: {
        currentPassword: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          description: "Current password for verification.",
        },
        newPassword: {
          type: "string",
          minLength: 12,
          description:
            "Replacement password that must satisfy the platform policy and differ from the current password.",
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
    Money: {
      type: "object",
      required: ["amount", "currency"],
      properties: {
        amount: {
          type: "string",
          pattern: "^-?\\d+(?:\\.\\d{1,2})?$",
          description: "Decimal amount represented as a string with up to two fractional digits.",
          examples: ["199.99", "0.00"],
        },
        currency: {
          type: "string",
          minLength: 3,
          maxLength: 3,
          pattern: "^[A-Z]{3}$",
          description: "ISO-4217 currency code.",
          examples: ["TRY", "USD"],
        },
      },
    },
    AuditTimestamps: {
      type: "object",
      required: ["createdAt", "updatedAt"],
      properties: {
        createdAt: {
          type: "string",
          format: "date-time",
          description: "Creation timestamp in ISO-8601 format.",
        },
        updatedAt: {
          type: "string",
          format: "date-time",
          description: "Last update timestamp in ISO-8601 format.",
        },
      },
    },
    SoftDeleteMetadata: {
      type: "object",
      properties: {
        deletedAt: {
          type: "string",
          format: "date-time",
          nullable: true,
          description: "Timestamp indicating when the record was soft deleted.",
        },
      },
    },
    UserRoleSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            name: {
              type: "string",
              maxLength: 120,
            },
            description: {
              type: "string",
              nullable: true,
            },
          },
        },
      ],
    },
    UserPermissionSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "key"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            key: {
              type: "string",
              maxLength: 120,
            },
            description: {
              type: "string",
              nullable: true,
            },
          },
        },
      ],
    },
    UserSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "email", "status", "emailVerified", "roles", "permissions"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            firstName: {
              type: "string",
              nullable: true,
            },
            lastName: {
              type: "string",
              nullable: true,
            },
            fullName: {
              type: "string",
              nullable: true,
            },
            phone: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: [...USER_STATUS_VALUES],
            },
            emailVerified: {
              type: "boolean",
            },
            roles: {
              type: "array",
              items: {
                $ref: "#/components/schemas/UserRoleSummary",
              },
            },
            permissions: {
              type: "array",
              items: {
                $ref: "#/components/schemas/UserPermissionSummary",
              },
            },
          },
        },
      ],
    },
    MediaAsset: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "assetId", "url", "type", "provider", "mimeType", "sizeBytes"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            assetId: {
              type: "string",
              maxLength: 120,
            },
            url: {
              type: "string",
              format: "uri",
            },
            type: {
              type: "string",
              enum: [...MEDIA_TYPE_VALUES],
            },
            provider: {
              type: "string",
              enum: [...MEDIA_PROVIDER_VALUES],
            },
            mimeType: {
              type: "string",
            },
            sizeBytes: {
              type: "integer",
              minimum: 0,
            },
            width: {
              type: "integer",
              nullable: true,
            },
            height: {
              type: "integer",
              nullable: true,
            },
            alt: {
              type: "string",
              nullable: true,
            },
            caption: {
              type: "string",
              nullable: true,
            },
          },
        },
      ],
    },
    CategorySummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "name", "slug", "path", "level"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            name: {
              type: "string",
            },
            slug: {
              type: "string",
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
            description: {
              type: "string",
              nullable: true,
            },
            parentId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            level: {
              type: "integer",
              minimum: 0,
            },
            path: {
              type: "string",
            },
            imageUrl: {
              type: "string",
              format: "uri",
              nullable: true,
            },
            iconUrl: {
              type: "string",
              format: "uri",
              nullable: true,
            },
            displayOrder: {
              type: "integer",
              nullable: true,
            },
          },
        },
      ],
    },
    ProductVariant: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "title", "price", "stock", "isPrimary"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            title: {
              type: "string",
            },
            sku: {
              type: "string",
              nullable: true,
            },
            price: {
              $ref: "#/components/schemas/Money",
            },
            compareAtPrice: {
              $ref: "#/components/schemas/Money",
              nullable: true,
            },
            stock: {
              type: "integer",
              minimum: 0,
            },
            attributes: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
            weightGrams: {
              type: "integer",
              nullable: true,
            },
            isPrimary: {
              type: "boolean",
            },
          },
        },
      ],
    },
    ProductMedia: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["productId", "mediaId", "isPrimary", "media"],
          properties: {
            productId: {
              type: "string",
              format: "cuid",
            },
            mediaId: {
              type: "string",
              format: "cuid",
            },
            sortOrder: {
              type: "integer",
              nullable: true,
            },
            isPrimary: {
              type: "boolean",
            },
            media: {
              $ref: "#/components/schemas/MediaAsset",
            },
          },
        },
      ],
    },
    ProductSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          $ref: "#/components/schemas/SoftDeleteMetadata",
        },
        {
          type: "object",
          required: [
            "id",
            "title",
            "slug",
            "status",
            "price",
            "currency",
            "inventoryPolicy",
            "variants",
            "categories",
            "media",
          ],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            title: {
              type: "string",
            },
            slug: {
              type: "string",
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
            sku: {
              type: "string",
              nullable: true,
            },
            summary: {
              type: "string",
              nullable: true,
            },
            description: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: [...PRODUCT_STATUS_VALUES],
            },
            price: {
              $ref: "#/components/schemas/Money",
            },
            compareAtPrice: {
              $ref: "#/components/schemas/Money",
              nullable: true,
            },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              pattern: "^[A-Z]{3}$",
            },
            inventoryPolicy: {
              type: "string",
              enum: [...INVENTORY_POLICY_VALUES],
            },
            searchKeywords: {
              type: "array",
              items: {
                type: "string",
              },
            },
            attributes: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            variants: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ProductVariant",
              },
            },
            categories: {
              type: "array",
              items: {
                $ref: "#/components/schemas/CategorySummary",
              },
            },
            media: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ProductMedia",
              },
            },
          },
        },
      ],
    },
    ProductCollectionResponse: {
      allOf: [
        {
          $ref: STANDARD_SUCCESS_RESPONSE_REF,
        },
        {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ProductSummary",
              },
            },
            meta: {
              $ref: "#/components/schemas/PaginationMeta",
            },
          },
        },
      ],
    },
    CartItem: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "cartId", "productVariantId", "quantity", "unitPrice"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            cartId: {
              type: "string",
              format: "cuid",
            },
            productVariantId: {
              type: "string",
              format: "cuid",
            },
            quantity: {
              type: "integer",
              minimum: 1,
            },
            unitPrice: {
              $ref: "#/components/schemas/Money",
            },
            productVariant: {
              $ref: "#/components/schemas/ProductVariant",
              nullable: true,
            },
          },
        },
      ],
    },
    CartTotals: {
      type: "object",
      required: ["subtotal", "tax", "discount", "total"],
      properties: {
        subtotal: {
          $ref: "#/components/schemas/Money",
        },
        tax: {
          $ref: "#/components/schemas/Money",
        },
        discount: {
          $ref: "#/components/schemas/Money",
        },
        total: {
          $ref: "#/components/schemas/Money",
        },
      },
    },
    CartSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "status", "items", "totals"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            sessionId: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
              enum: [...CART_STATUS_VALUES],
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/CartItem",
              },
            },
            totals: {
              $ref: "#/components/schemas/CartTotals",
            },
          },
        },
      ],
    },
    OrderItem: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "orderId", "productId", "productVariantId", "quantity", "unitPrice"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            orderId: {
              type: "string",
              format: "cuid",
            },
            productId: {
              type: "string",
              format: "cuid",
            },
            productVariantId: {
              type: "string",
              format: "cuid",
            },
            quantity: {
              type: "integer",
              minimum: 1,
            },
            unitPrice: {
              $ref: "#/components/schemas/Money",
            },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              pattern: "^[A-Z]{3}$",
            },
            titleSnapshot: {
              type: "string",
            },
            variantSnapshot: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
          },
        },
      ],
    },
    OrderSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: [
            "id",
            "reference",
            "status",
            "totalAmount",
            "subtotalAmount",
            "taxAmount",
            "discountAmount",
            "currency",
            "items",
            "itemsCount",
          ],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            reference: {
              type: "string",
            },
            userId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            cartId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            status: {
              type: "string",
              enum: [...ORDER_STATUS_VALUES],
            },
            totalAmount: {
              $ref: "#/components/schemas/Money",
            },
            subtotalAmount: {
              $ref: "#/components/schemas/Money",
            },
            taxAmount: {
              $ref: "#/components/schemas/Money",
            },
            discountAmount: {
              $ref: "#/components/schemas/Money",
            },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              pattern: "^[A-Z]{3}$",
            },
            placedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            fulfilledAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            shippedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            deliveredAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            cancelledAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            notes: {
              type: "string",
              nullable: true,
            },
            metadata: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            items: {
              type: "array",
              items: {
                $ref: "#/components/schemas/OrderItem",
              },
            },
            itemsCount: {
              type: "integer",
              minimum: 0,
            },
            shippingAddressId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            billingAddressId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
          },
        },
      ],
    },
    PaymentSummary: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "orderId", "provider", "status", "transactionId", "amount", "currency"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            orderId: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            provider: {
              type: "string",
              enum: [...PAYMENT_PROVIDER_VALUES],
            },
            status: {
              type: "string",
              enum: [...PAYMENT_STATUS_VALUES],
            },
            transactionId: {
              type: "string",
            },
            conversationId: {
              type: "string",
              nullable: true,
            },
            amount: {
              $ref: "#/components/schemas/Money",
            },
            paidPrice: {
              $ref: "#/components/schemas/Money",
              nullable: true,
            },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              pattern: "^[A-Z]{3}$",
            },
            installment: {
              type: "integer",
              nullable: true,
            },
            paymentChannel: {
              type: "string",
              nullable: true,
            },
            paymentGroup: {
              type: "string",
              nullable: true,
            },
            cardToken: {
              type: "string",
              nullable: true,
            },
            cardAssociation: {
              type: "string",
              nullable: true,
            },
            cardFamily: {
              type: "string",
              nullable: true,
            },
            cardType: {
              type: "string",
              nullable: true,
            },
            cardBankName: {
              type: "string",
              nullable: true,
            },
            cardHolderName: {
              type: "string",
              nullable: true,
            },
            binNumber: {
              type: "string",
              nullable: true,
            },
            lastFourDigits: {
              type: "string",
              nullable: true,
            },
            ipAddress: {
              type: "string",
              nullable: true,
            },
            deviceId: {
              type: "string",
              nullable: true,
            },
            fraudScore: {
              type: "number",
              nullable: true,
            },
            riskFlags: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            authorizedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            settledAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            failedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            failureReason: {
              type: "string",
              nullable: true,
            },
            failureCode: {
              type: "string",
              nullable: true,
            },
            rawPayload: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
          },
        },
      ],
    },
    PaymentRefundRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "paymentId", "amount", "currency", "status"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            paymentId: {
              type: "string",
              format: "cuid",
            },
            amount: {
              $ref: "#/components/schemas/Money",
            },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              pattern: "^[A-Z]{3}$",
            },
            reason: {
              type: "string",
              nullable: true,
            },
            status: {
              type: "string",
            },
            refundId: {
              type: "string",
              nullable: true,
            },
            processedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            failureReason: {
              type: "string",
              nullable: true,
            },
            failureCode: {
              type: "string",
              nullable: true,
            },
            metadata: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
          },
        },
      ],
    },
    InventoryRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: [
            "id",
            "productVariantId",
            "quantityAvailable",
            "quantityReserved",
            "quantityOnHand",
          ],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            productVariantId: {
              type: "string",
              format: "cuid",
            },
            quantityAvailable: {
              type: "integer",
              minimum: 0,
            },
            quantityReserved: {
              type: "integer",
              minimum: 0,
            },
            quantityOnHand: {
              type: "integer",
              minimum: 0,
            },
            lowStockThreshold: {
              type: "integer",
              nullable: true,
            },
          },
        },
      ],
    },
    AddressRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "userId", "label", "fullName", "line1", "city", "postalCode", "country"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
            },
            label: {
              type: "string",
            },
            fullName: {
              type: "string",
            },
            phone: {
              type: "string",
              nullable: true,
            },
            line1: {
              type: "string",
            },
            line2: {
              type: "string",
              nullable: true,
            },
            city: {
              type: "string",
            },
            state: {
              type: "string",
              nullable: true,
            },
            postalCode: {
              type: "string",
            },
            country: {
              type: "string",
            },
            isDefault: {
              type: "boolean",
            },
          },
        },
      ],
    },
    SavedCardRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "userId", "cardToken", "lastFourDigits", "expiryMonth", "expiryYear"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
            },
            cardToken: {
              type: "string",
            },
            cardAlias: {
              type: "string",
              nullable: true,
            },
            binNumber: {
              type: "string",
              nullable: true,
            },
            lastFourDigits: {
              type: "string",
            },
            cardType: {
              type: "string",
              nullable: true,
            },
            cardAssociation: {
              type: "string",
              nullable: true,
            },
            cardFamily: {
              type: "string",
              nullable: true,
            },
            cardBankName: {
              type: "string",
              nullable: true,
            },
            cardHolderName: {
              type: "string",
              nullable: true,
            },
            expiryMonth: {
              type: "integer",
              minimum: 1,
              maximum: 12,
            },
            expiryYear: {
              type: "integer",
            },
            isDefault: {
              type: "boolean",
            },
          },
        },
      ],
    },
    ReviewRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "productId", "userId", "rating", "title", "status"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            productId: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
            },
            orderId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            rating: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            title: {
              type: "string",
            },
            content: {
              type: "string",
              nullable: true,
            },
            isVerifiedPurchase: {
              type: "boolean",
            },
            status: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
            helpfulCount: {
              type: "integer",
              minimum: 0,
            },
            notHelpfulCount: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      ],
    },
    ReviewMediaRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["reviewId", "mediaId"],
          properties: {
            reviewId: {
              type: "string",
              format: "cuid",
            },
            mediaId: {
              type: "string",
              format: "cuid",
            },
            sortOrder: {
              type: "integer",
              nullable: true,
            },
          },
        },
      ],
    },
    CouponResource: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "code", "type", "value", "isActive"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            code: {
              type: "string",
            },
            description: {
              type: "string",
              nullable: true,
            },
            type: {
              type: "string",
              enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"],
            },
            value: {
              $ref: "#/components/schemas/Money",
            },
            minOrderAmount: {
              $ref: "#/components/schemas/Money",
              nullable: true,
            },
            maxDiscountAmount: {
              $ref: "#/components/schemas/Money",
              nullable: true,
            },
            usageLimit: {
              type: "integer",
              nullable: true,
            },
            usageCount: {
              type: "integer",
              minimum: 0,
            },
            startsAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            isActive: {
              type: "boolean",
            },
          },
        },
      ],
    },
    CouponUsageRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "couponId", "userId", "orderId", "discountAmount", "usedAt"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            couponId: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
            },
            orderId: {
              type: "string",
              format: "cuid",
            },
            discountAmount: {
              $ref: "#/components/schemas/Money",
            },
            usedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
      ],
    },
    UserSessionToken: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "userId", "refreshTokenHash", "expiresAt"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
            },
            refreshTokenHash: {
              type: "string",
            },
            fingerprint: {
              type: "string",
              nullable: true,
            },
            ipAddress: {
              type: "string",
              nullable: true,
            },
            userAgent: {
              type: "string",
              nullable: true,
            },
            expiresAt: {
              type: "string",
              format: "date-time",
            },
            revokedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
        },
      ],
    },
    SecurityEventRecord: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "type"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            type: {
              type: "string",
            },
            ipAddress: {
              type: "string",
              nullable: true,
            },
            userAgent: {
              type: "string",
              nullable: true,
            },
            payload: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
          },
        },
      ],
    },
    AuditLogEntry: {
      allOf: [
        {
          $ref: "#/components/schemas/AuditTimestamps",
        },
        {
          type: "object",
          required: ["id", "actorType", "action", "entity", "entityId"],
          properties: {
            id: {
              type: "string",
              format: "cuid",
            },
            userId: {
              type: "string",
              format: "cuid",
              nullable: true,
            },
            actorType: {
              type: "string",
            },
            action: {
              type: "string",
            },
            entity: {
              type: "string",
            },
            entityId: {
              type: "string",
            },
            before: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            after: {
              type: "object",
              additionalProperties: true,
              nullable: true,
            },
            ipAddress: {
              type: "string",
              nullable: true,
            },
            userAgent: {
              type: "string",
              nullable: true,
            },
          },
        },
      ],
    },
    PaginationMeta: {
      type: "object",
      required: ["page", "pageSize", "totalItems", "totalPages", "hasNextPage", "hasPreviousPage"],
      properties: {
        page: {
          type: "integer",
          minimum: 0,
        },
        pageSize: {
          type: "integer",
          minimum: 1,
        },
        totalItems: {
          type: "integer",
          minimum: 0,
        },
        totalPages: {
          type: "integer",
          minimum: 0,
        },
        hasNextPage: {
          type: "boolean",
        },
        hasPreviousPage: {
          type: "boolean",
        },
      },
    },
  },
};
/* eslint-enable sonarjs/no-duplicate-string */

const authPaths: OpenApi31.PathsObject = {
  "/api/v1/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Register a new user account",
      description:
        "Creates a customer account and dispatches an email verification token. Passwords must satisfy the platform policy and are hashed before storage.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: REGISTER_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        201: {
          description: "Registration succeeded and a verification email was issued.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_REGISTER_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Validation failed for the supplied payload.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        409: {
          description: "An account with the provided email already exists.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Authenticate with email and password",
      description:
        "Validates credentials, records security telemetry, issues a new session, and returns access/refresh tokens. The refresh token is also delivered as an HTTP-only, same-site cookie.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: LOGIN_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Login succeeded and tokens were issued.",
          headers: {
            "Set-Cookie": {
              description: "Signed `refreshToken` cookie scoped to `/api` with SameSite=strict.",
              schema: {
                type: "string",
              },
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_LOGIN_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Validation failed for the credentials payload.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: "Invalid credentials, lockout in effect, or account inactive.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/refresh": {
    post: {
      tags: ["Auth"],
      summary: "Rotate refresh token and obtain a new access token",
      description:
        "Expects a valid signed refresh token via HTTP-only cookies. Performs replay detection, rotates the session, and returns a fresh token pair.",
      responses: {
        200: {
          description: "Token rotation succeeded.",
          headers: {
            "Set-Cookie": {
              description: "Signed `refreshToken` cookie scoped to `/api` with SameSite=strict.",
              schema: {
                type: "string",
              },
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_REFRESH_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: "Missing refresh token, token reuse detected, or session no longer valid.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Revoke the current session",
      description: "Invalidates the active session and clears the refresh token cookie.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Session revoked successfully.",
          headers: {
            "Set-Cookie": {
              description: "Refresh token cookie cleared by setting an expired value.",
              schema: {
                type: "string",
              },
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_LOGOUT_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_UNAUTHENTICATED_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/logout-all": {
    post: {
      tags: ["Auth"],
      summary: "Revoke all sessions for the authenticated user",
      description:
        "Invalidates every active session associated with the caller and clears the refresh cookie.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Active sessions revoked.",
          headers: {
            "Set-Cookie": {
              description: "Refresh token cookie cleared by setting an expired value.",
              schema: {
                type: "string",
              },
            },
          },
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_LOGOUT_ALL_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_UNAUTHENTICATED_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Retrieve the authenticated user profile",
      description:
        "Returns the caller's profile, including roles and permissions resolved through RBAC.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Profile retrieved.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_USER_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_INVALID_SESSION_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/verify-email": {
    post: {
      tags: ["Auth"],
      summary: "Confirm email using a verification token",
      description:
        "Validates the verification token delivered by email, marks the user as verified, and revokes sessions if token misuse is detected.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: VERIFY_EMAIL_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Email verified successfully.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_USER_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Token structure invalid or already consumed.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: "Token signature mismatch or verification failed.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/resend-verification": {
    post: {
      tags: ["Auth"],
      summary: "Resend email verification for the authenticated user",
      description: "Issues a new verification token provided the account is not already verified.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        200: {
          description: "Verification email reissued.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_USER_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_UNAUTHENTICATED_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        404: {
          description:
            "User record could not be found (should not occur for authenticated clients).",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        409: {
          description: "Email is already verified.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        429: {
          description: "Rate limit exceeded for resend requests.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/forgot-password": {
    post: {
      tags: ["Auth"],
      summary: "Initiate password reset",
      description:
        "Sends a password reset email if the account exists. The response is intentionally generic to avoid user enumeration.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: FORGOT_PASSWORD_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Reset workflow triggered if the account exists.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_MESSAGE_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Email field missing or invalid.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        429: {
          description: "Rate limit exceeded for password reset requests.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/reset-password": {
    post: {
      tags: ["Auth"],
      summary: "Complete password reset",
      description:
        "Validates the reset token, updates the password, revokes active sessions, and logs a security event.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: RESET_PASSWORD_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Password updated successfully.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_USER_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Payload validation failed.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: "Token mismatch or expired.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/change-password": {
    put: {
      tags: ["Auth"],
      summary: "Change password for the authenticated user",
      description:
        "Validates the current password, enforces the password policy, updates stored credentials, and revokes other sessions.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: CHANGE_PASSWORD_REQUEST_REF,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Password updated successfully.",
          content: {
            "application/json": {
              schema: {
                $ref: AUTH_USER_RESPONSE_REF,
              },
            },
          },
        },
        400: {
          description: "Validation failed (policy breach or passwords identical).",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: "Authentication failed or current password incorrect.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        429: {
          description: "Rate limit exceeded for change password attempts.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/2fa/setup": {
    post: {
      tags: ["Auth"],
      summary: "Placeholder endpoint for two-factor enrolment",
      description:
        "Currently returns a NOT_IMPLEMENTED response while the two-factor flow is under construction. Available to authenticated callers for roadmap awareness.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        501: {
          description: "Feature not yet implemented.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_UNAUTHENTICATED_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
    },
  },
  "/api/v1/auth/2fa/verify": {
    post: {
      tags: ["Auth"],
      summary: "Placeholder endpoint for two-factor verification",
      description:
        "Returns NOT_IMPLEMENTED until two-factor verification is released. Helps clients detect feature availability.",
      security: [
        {
          bearerAuth: [],
        },
      ],
      responses: {
        501: {
          description: "Feature not yet implemented.",
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
        401: {
          description: AUTH_UNAUTHENTICATED_DESCRIPTION,
          content: {
            "application/json": {
              schema: {
                $ref: STANDARD_ERROR_RESPONSE_REF,
              },
            },
          },
        },
      },
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
      identifier: "LicenseRef-Lumi-Internal",
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
    {
      name: "Catalog",
      description: "Product catalogue browsing endpoints.",
    },
    {
      name: "Auth",
      description: "Authentication, session management, and RBAC-protected endpoints.",
    },
  ],
  components: standardComponents as unknown as OpenApi31.ComponentsObject,
  paths: authPaths,
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
