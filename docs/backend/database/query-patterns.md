# Common Query Patterns

This guide catalogues the high-value database query patterns supported by the Phase 2 repository layer. Each pattern references the recommended repository helper, required indexes, and observability probes so engineers can implement features without re-inventing data access.

## 1. Product Catalogue

- **Use**: `ProductRepository.searchWithCursor(filters, options)`
- **Purpose**: Drives storefront listings, supports full-text search and category filters.
- **Implementation Notes**:
  - Requires `Product` GIN index on `searchKeywords` and composite index on `(status, createdAt)` for ordering.
  - Always request `include: { variants: true, productMedia: { include: { media: true } } }` to avoid N+1 when mappers build DTOs.
  - Cursor pagination leverages `(createdAt DESC, id DESC)` ordering to maintain deterministic pages.
- **Metrics**: `lumi_db_query_duration_seconds{model="Product",operation="findMany"}` plus slow query alerts (<200 ms target).

## 2. Category Navigation

- **Use**: `CategoryRepository.listChildren(parentId)` and `CategoryRepository.buildBreadcrumb(slug)`
- **Indexes**: `Category.parentId` and `Category.slug` ensure constant-time lookups.
- **Cascades**: Parent deletion uses `onDelete: SetNull` so navigation remains valid even if intermediate nodes are removed.
- **Caching**: Responses are cache-friendly; annotate controllers with `Cache-Control` hints where appropriate.

## 3. Cart Retrieval

- **Use**: `CartRepository.findActiveByUser(userId)` / `CartRepository.findBySession(sessionId)`
- **Included Relations**: Variants (pricing + inventory), product shell, and `CartItem` pivot.
- **Concurrency**: Always wrap cart mutations in `withTransaction` to guard against race conditions when merging guest carts.
- **Indexes**: `(status, updatedAt)` keeps abandoned cart cleanup efficient.

## 4. Order & Payment History

- **Use**: `OrderRepository.listForUserHistory(userId, options)` for paged history; `PaymentRepository.listByOrder(orderId)` for payment timelines.
- **Optimistic Locking**: Mutations employ the `version` column—increment it when writing manual SQL.
- **Projections**: Expose summary DTOs to UI. For admin exports, request `include: { items: true, payments: true }`.
- **Indexes**: `(userId, status, createdAt)` on `Order`, plus `Payment.orderId`.

## 5. Review Feeds

- **Use**: `ReviewRepository.listForProduct(productId, options)`
- **Filtering**: Default filter excludes `status !== APPROVED`. Moderate views may override to include `PENDING`.
- **Media Loading**: `include: { media: { include: { media: true } }, user: true }` prevents N+1 fetches.
- **Indexes**: `(productId, status)` and `ReviewMedia.reviewId`.

## 6. Inventory Health

- **Use**: `InventoryRepository.listLowStock(threshold)` (exposed via `ProductRepository` helper).
- **Indexes**: Unique index on `productVariantId` plus partial `WHERE quantityAvailable <= lowStockThreshold` (implemented via repository filter).
- **Observability**: Emit metric `inventory_low_stock_total` for alerting; watchers should review before running promotional campaigns.

## 7. Coupon Validation

- **Use**: `CouponRepository.findActiveByCode(code, now)` ensures validity window and usage caps are enforced.
- **Transactions**: When applying coupons, call inside the checkout transaction to atomically increment `usageCount`.
- **Indexes**: Unique `Coupon.code`, `CouponUsage.couponId`.

## 8. Security Forensics

- **Use**: `SecurityEventRepository.listByUser(userId, range)` for user investigations.
- **Data Shape**: Exposes `SecurityEventRecord` including IP, agent, and payload JSON.
- **Retention**: Data retained for 180 days (see compliance docs). Use `createdAt` index for fast range queries.

> **Reminder**: When adding new query helpers, document the expected filters, required indexes, and transaction boundaries here to keep the data access catalogue current.
