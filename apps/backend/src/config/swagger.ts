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
  ],
  components: standardComponents as unknown as OpenApi31.ComponentsObject,
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
