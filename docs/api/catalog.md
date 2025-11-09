# Catalog API

The Catalog API powers all product, variant, and category experiences across web and admin clients. Every endpoint emits Q2 responses, sanitises payloads with Zod, and logs mutations for audit trails.

## Public Endpoints

| Method | Path                             | Description                                                                  | Notes                                        |
| ------ | -------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `GET`  | `/api/v1/products`               | Paginated catalogue with filters, sort, and free-text search.                | Cached 60s; rate-limited 120 req/5 min/IP.   |
| `GET`  | `/api/v1/products/popular`       | Curated trending set driven by conversion telemetry.                         | Backed by Redis `popular:products` key.      |
| `GET`  | `/api/v1/products/{slug}`        | Fetches a fully hydrated product, variants, media, categories, and SEO copy. | Slugs are case-insensitive.                  |
| `GET`  | `/api/v1/products/{id}/variants` | Lists variants and price/stock snapshots for detail views.                   | Requires product `cuid`.                     |
| `GET`  | `/api/v1/categories`             | Returns the category tree ordered by `displayOrder`.                         | Includes `path` and `level` for breadcrumbs. |
| `GET`  | `/api/v1/categories/{slug}`      | Fetches a single category with parent metadata.                              | 404 when not found.                          |

## Admin Endpoints

| Method         | Path                                               | Description                                                                                      |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST`         | `/api/v1/admin/products`                           | Creates a product with at least one variant and one category.                                    |
| `PUT`          | `/api/v1/admin/products/{id}`                      | Full or partial update. Unknown fields stripped, `slug` automatically re-generated when missing. |
| `DELETE`       | `/api/v1/admin/products/{id}`                      | Soft deletes the record; audit event `product.delete` recorded.                                  |
| `POST`         | `/api/v1/admin/products/{id}/variants`             | Appends a new variant; `isPrimary` toggles demote existing primaries.                            |
| `PUT`/`DELETE` | `/api/v1/admin/products/{id}/variants/{variantId}` | Mutates or removes a variant.                                                                    |
| `POST`         | `/api/v1/admin/categories`                         | Creates nested categories with uniqueness enforced per parent.                                   |
| `PUT`/`DELETE` | `/api/v1/admin/categories/{id}`                    | Updates metadata or deletes (only when unused).                                                  |

All admin routes require the `admin` role (S3) and emit `X-RateLimit-*` headers with the 300 req/5 min policy.

## Filtering & Sorting

`GET /api/v1/products` supports the following filters:

| Query              | Type    | Details                                                               |
| ------------------ | ------- | --------------------------------------------------------------------- |
| `page`, `perPage`  | integer | `perPage` defaults to 24 (max 100).                                   |
| `sort`             | string  | One of `-createdAt`, `createdAt`, `price`, `-price`, `popularity`.    |
| `filter[category]` | string  | Category `slug` or `cuid`. Supports multi-value CSV.                  |
| `filter[status]`   | enum    | `ACTIVE`, `DRAFT`, `ARCHIVED`.                                        |
| `search`           | string  | Tokenised full-text search hitting the GIN index on `searchKeywords`. |

Unsupported filters trigger `VALIDATION_ERROR` responses with detail objects.

## Request/Response Examples

**Create Product**

```http
POST /api/v1/admin/products
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "Lumi Aurora Hoodie",
  "price": { "amount": 1499.0, "currency": "TRY" },
  "variants": [
    { "title": "S / Black", "sku": "HOODIE-AURORA-S-BLK", "price": { "amount": 1499.0, "currency": "TRY" }, "stock": 50, "isPrimary": true }
  ],
  "categoryIds": ["clz1f5o7k000001t8c0rk0q1z"]
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "clz1f8ofn000301t88jzs2bjt",
      "title": "Lumi Aurora Hoodie",
      "slug": "lumi-aurora-hoodie",
      "status": "DRAFT",
      "price": { "amount": 1499, "currency": "TRY" },
      "variants": [
        {
          "id": "clz1f8og4000401t82n5kqhcv",
          "title": "S / Black",
          "sku": "HOODIE-AURORA-S-BLK",
          "stock": 50,
          "isPrimary": true
        }
      ],
      "categories": [{ "id": "clz1f5o7k000001t8c0rk0q1z", "name": "Outerwear" }],
      "createdAt": "2025-01-12T10:01:00Z",
      "updatedAt": "2025-01-12T10:01:00Z"
    }
  },
  "meta": {
    "timestamp": "2025-01-12T10:01:01Z",
    "requestId": "a4c16b09-9596-4c9c-9a37-1b89baeead21"
  }
}
```

## Validation Highlights

- Slugs auto-generate from `title` when omitted and deduplicate by appending counters.
- Variant arrays require at least one entry; payloads >20 variants rejected (guarding P1 indexes).
- Media associations accept only known `mediaId` references; Cloudinary validation handled in Phase 5.

## Rate Limits & Headers

| Audience | Policy                                | Headers                                                           |
| -------- | ------------------------------------- | ----------------------------------------------------------------- |
| Public   | 120 requests / 5 minutes per IP       | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Admin    | 300 requests / 5 minutes per operator | same as above + `Retry-After` on HTTP 429                         |

Use the OpenAPI spec found at `packages/shared/src/api-schemas/openapi.yaml` for exact schemas and error contracts.
