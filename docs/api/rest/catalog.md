# Catalog API

## GET /api/v1/products

Returns the public product catalog with pagination metadata.

### Query Parameters

| Name           | Type    | Description                                                                                                                              |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `page`         | number  | 1-based page number (default: 1)                                                                                                         |
| `perPage`      | number  | Page size (default: 24, max: 200)                                                                                                        |
| `cursor`       | string  | Base64URL cursor token returned from the previous response. Providing a cursor enables cursor-based pagination and disables cache reads. |
| `take`         | number  | Overrides the number of items fetched when using cursors (default: 24, max: 100).                                                        |
| `categoryId`   | string  | Filter by category identifier                                                                                                            |
| `categorySlug` | string  | Filter by category slug                                                                                                                  |
| `refreshCache` | boolean | Forces the service to bypass the cached response                                                                                         |

### Cache Semantics

- Responses include `ETag` and `Cache-Control: public, max-age=60` headers.
- Clients SHOULD re-use the `ETag` via `If-None-Match` to receive `304 Not Modified` responses.
- Cursor-based requests (`cursor` query param) skip cache lookups to avoid cache bloat.
- The JSON payload includes `meta.cursor` with `{ hasMore, next }` so clients can continue fetching.

## GET /api/v1/products/popular

Returns the precomputed "popular products" feed used by home/landing pages.

### Query Parameters

| Name           | Type    | Description                                      |
| -------------- | ------- | ------------------------------------------------ |
| `limit`        | number  | Number of items to return (default: 12, max: 50) |
| `refreshCache` | boolean | Forces a cache refresh                           |

### Cache Semantics

- Responses include `ETag` and `Cache-Control: public, max-age=300` headers.
- Cache entries live for 5 minutes and are invalidated automatically whenever products/categories change.
- Clients can use `If-None-Match` to short-circuit duplicate requests.

## Category Tree (GET /api/v1/categories)

- Category responses are cached for 15 minutes (`Cache-Control: public, max-age=900`).
- Use `?refresh=true` during admin updates to bypass the cache.
