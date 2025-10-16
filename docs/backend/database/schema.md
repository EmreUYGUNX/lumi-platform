# Database Schema Reference

The Prisma schema underpins the Lumi commerce platform data layer. Every model follows the Phase 2 standards: string primary keys generated with `cuid()`, mandatory `createdAt`/`updatedAt` timestamps, and indexed foreign keys to satisfy performance requirement **P1**. This reference documents every enum, model, relationship, index and the soft-delete conventions so engineers can reason about the data model without opening `prisma/schema.prisma`.

## Enumerations

| Enum              | Values                                                              | Usage                            |
| ----------------- | ------------------------------------------------------------------- | -------------------------------- |
| `UserStatus`      | `ACTIVE`, `SUSPENDED`, `DELETED`                                    | User lifecycle management        |
| `ProductStatus`   | `DRAFT`, `ACTIVE`, `ARCHIVED`                                       | Product publication control      |
| `InventoryPolicy` | `TRACK`, `CONTINUE`, `DENY`                                         | Variant stock handling           |
| `MediaType`       | `IMAGE`, `VIDEO`, `DOCUMENT`                                        | Media asset classification       |
| `MediaProvider`   | `CLOUDINARY`, `S3`                                                  | Upstream media storage providers |
| `CartStatus`      | `ACTIVE`, `CHECKED_OUT`, `ABANDONED`                                | Cart lifecycle state             |
| `OrderStatus`     | `PENDING`, `PAID`, `FULFILLED`, `SHIPPED`, `DELIVERED`, `CANCELLED` | Order fulfilment pipeline        |
| `PaymentProvider` | `IYZICO`, `STRIPE`, `PAYPAL`, `MANUAL`                              | Payment gateway identification   |
| `PaymentStatus`   | `INITIATED`, `AUTHORIZED`, `SETTLED`, `FAILED`, `REFUNDED`          | Payment settlement tracking      |
| `ReviewStatus`    | `PENDING`, `APPROVED`, `REJECTED`                                   | Moderation workflow              |
| `CouponType`      | `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`                       | Promotional rule type            |

## Identity & Security Models

### `User`

| Field              | Type         | Attributes             | Notes                                 |
| ------------------ | ------------ | ---------------------- | ------------------------------------- |
| `id`               | `String`     | `@id @default(cuid())` | Global identifier                     |
| `email`            | `String`     | `@unique`              | Login username                        |
| `passwordHash`     | `String`     |                        | Stores bcrypt hash (**S1 compliant**) |
| `firstName`        | `String?`    |                        | Optional profile                      |
| `lastName`         | `String?`    |                        |                                       |
| `phone`            | `String?`    |                        | Normalised E.164 string               |
| `emailVerified`    | `Boolean`    | `@default(false)`      | Flag for primary email confirmation   |
| `emailVerifiedAt`  | `DateTime?`  |                        | Timestamp of verification             |
| `failedLoginCount` | `Int`        | `@default(0)`          | Lockout support                       |
| `lockoutUntil`     | `DateTime?`  |                        |                                       |
| `twoFactorSecret`  | `String?`    |                        | Base32 secret for OTP                 |
| `twoFactorEnabled` | `Boolean`    | `@default(false)`      |                                       |
| `status`           | `UserStatus` | `@default(ACTIVE)`     | Lifecycle flag                        |
| `createdAt`        | `DateTime`   | `@default(now())`      |                                       |
| `updatedAt`        | `DateTime`   | `@updatedAt`           |                                       |

Relations: sessions, roles, permissions, security events, carts, orders, addresses, reviews, saved cards, payments, audit logs, coupon usages (`onDelete: Cascade` except where noted in child tables).  
Indexes: implicit via unique email; relations create indexes in join tables.

### `UserSession`

| Field              | Type        | Attributes                         | Notes                              |
| ------------------ | ----------- | ---------------------------------- | ---------------------------------- |
| `id`               | `String`    | `@id @default(cuid())`             | Session identifier                 |
| `userId`           | `String`    | `@@index`                          | FK to `User` (`onDelete: Cascade`) |
| `refreshTokenHash` | `String`    |                                    | Bcrypt hash of refresh token       |
| `fingerprint`      | `String?`   |                                    | Device fingerprint                 |
| `ipAddress`        | `String?`   |                                    | Recorded for audit                 |
| `userAgent`        | `String?`   |                                    | Client fingerprint                 |
| `expiresAt`        | `DateTime`  | `@@index`                          | Expiration timestamp               |
| `revokedAt`        | `DateTime?` | `@@index` (`expiresAt, revokedAt`) | Soft revocation                    |
| `createdAt`        | `DateTime`  | `@default(now())`                  |                                    |
| `updatedAt`        | `DateTime`  | `@updatedAt`                       |                                    |

### `Role` / `Permission`

Both models share the same structure: `id`, `name`/`key` (`@unique`), optional description, timestamps. They anchor RBAC metadata. Relations: `RolePermission`, `UserRole`, `UserPermission` with `onDelete: Cascade`.

### `RolePermission`

Composite primary key `@@id([roleId, permissionId])`. Tracks which permissions are assigned to roles. `@default(now())` for `assignedAt`. Cascades to both `Role` and `Permission`.

### `UserRole` / `UserPermission`

Composite primary keys linking users to roles and permissions. `onDelete: Cascade` ensures membership cleans up with user removal. Both tables index `userId` and the related `roleId`/`permissionId`.

### `SecurityEvent`

Captures account security incidents. Optional `userId` (`onDelete: SetNull`), event `type`, optional payload and networking metadata. Indexed on `userId` and `type` for investigations.

### `AuditLog`

| Field       | Type       | Attributes                    | Notes                       |
| ----------- | ---------- | ----------------------------- | --------------------------- |
| `id`        | `String`   | `@id @default(cuid())`        | Audit entry identifier      |
| `userId`    | `String?`  | `@@index`                     | Actor reference (`SetNull`) |
| `actorType` | `String`   |                               | e.g. `user`, `service`      |
| `action`    | `String`   |                               | Stable action verb          |
| `entity`    | `String`   | `@@index([entity, entityId])` | Target model                |
| `entityId`  | `String`   | see above                     | Target identifier           |
| `before`    | `Json?`    |                               | Pre-change snapshot         |
| `after`     | `Json?`    |                               | Post-change snapshot        |
| `ipAddress` | `String?`  |                               | Actor IP                    |
| `userAgent` | `String?`  |                               | Actor agent                 |
| `createdAt` | `DateTime` | `@default(now())`             |                             |
| `updatedAt` | `DateTime` | `@updatedAt`                  |                             |

Additional index on `(entity, entityId, createdAt)` plus standalone `createdAt` index to optimise audit timeline queries.

## Catalogue & Media Models

### `Product`

| Field             | Type              | Attributes                                   | Notes                                |
| ----------------- | ----------------- | -------------------------------------------- | ------------------------------------ |
| `id`              | `String`          | `@id @default(cuid())`                       |                                      |
| `title`           | `String`          |                                              |                                      |
| `slug`            | `String`          | `@unique`                                    | Unique SEO slug (`@@unique([slug])`) |
| `sku`             | `String?`         | `@unique`                                    | Optional master SKU                  |
| `description`     | `String?`         |                                              | Markdown/HTML stored as text         |
| `summary`         | `String?`         |                                              | Short blurb                          |
| `status`          | `ProductStatus`   | `@default(DRAFT)`                            | Publishing state                     |
| `price`           | `Decimal`         | `@db.Decimal(12, 2)`                         | Display price                        |
| `compareAtPrice`  | `Decimal?`        | `@db.Decimal(12, 2)`                         | MSRP/strike-through price            |
| `currency`        | `String`          | `@default("TRY")`                            | ISO currency                         |
| `inventoryPolicy` | `InventoryPolicy` | `@default(TRACK)`                            | Variant stock enforcement            |
| `searchKeywords`  | `String[]`        | `@default([])` + `@@index([...], type: Gin)` | Full-text search field               |
| `attributes`      | `Json?`           |                                              | Arbitrary attribute bag              |
| `deletedAt`       | `DateTime?`       | `@@index([deletedAt])`                       | Soft-delete marker (**soft delete**) |
| `createdAt`       | `DateTime`        | `@default(now())`                            |                                      |
| `updatedAt`       | `DateTime`        | `@updatedAt`                                 |                                      |

Relations: variants, categories, collections, media, reviews, order items. Index on `(status, createdAt)` optimises catalogue queries.

### `ProductVariant`

Fields include `productId` (`@@index` with `onDelete: Cascade`), `title`, `sku @unique`, pricing decimals, inventory attributes, `isPrimary` flag. Optional `inventory` relation (`Inventory?`). Timestamps standard.

### `Inventory`

Maintains per-variant stock: `quantityAvailable`, `quantityReserved`, `quantityOnHand`, `lowStockThreshold`. `productVariantId` has unique index and cascades on delete.

### `Media`

Stores media asset metadata (`assetId @unique`, `url`, `type`, `provider`, MIME, dimensions). Indexed by `assetId`. Relations to product/variant/review media junctions with cascade deletes.

### Junction Tables

- `ProductMedia`, `VariantMedia`, `ProductCategory`, `ProductCollection` use composite primary keys and cascade to maintain many-to-many relationships. All include audit timestamps plus `assignedAt` where relevant.
- `Category` maintains hierarchy via `parentId` (`onDelete: SetNull`) and has indexes on `parentId` and `slug`.
- `Collection` exposes optional merchandising grouping with unique slug.

## Commerce & Fulfilment Models

### `Cart`

Supports guest carts (`sessionId`) or user carts. `userId` relationship uses `onDelete: SetNull`. Indexed by `userId`, `sessionId`, and `(status, updatedAt)` for stale cart sweeps.

### `CartItem`

Links cart to `ProductVariant` (`onDelete: Restrict` to preserve references). Composite unique index on `(cartId, productVariantId)` prevents duplicates.

### `Order`

| Field                 | Type          | Attributes                                                           | Notes                                                          |
| --------------------- | ------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `id`                  | `String`      | `@id @default(cuid())`                                               |                                                                |
| `reference`           | `String`      | `@unique`                                                            | External order identifier                                      |
| `userId`              | `String?`     | `@@index`, relation `onDelete: SetNull`                              | Allows guest orders                                            |
| `cartId`              | `String?`     | `@unique`, relation `onDelete: SetNull`                              | Ensures one order per cart                                     |
| `status`              | `OrderStatus` | `@default(PENDING)`                                                  | Fulfilment stage                                               |
| Monetary fields       | `Decimal`     | `@db.Decimal(14, 2)`                                                 | `totalAmount`, `subtotalAmount`, `taxAmount`, `discountAmount` |
| `currency`            | `String`      | `@default("TRY")`                                                    |                                                                |
| Address FKs           | `String?`     | `shippingAddressId`, `billingAddressId`                              | `onDelete: SetNull`                                            |
| Timeline fields       | `DateTime?`   | `placedAt`, `fulfilledAt`, `shippedAt`, `deliveredAt`, `cancelledAt` | Order milestones                                               |
| `notes`               | `String?`     | `@db.Text`                                                           | Internal notes                                                 |
| `metadata`            | `Json?`       |                                                                      | Structured metadata                                            |
| `version`             | `Int`         | `@default(1)`                                                        | Optimistic locking                                             |
| `createdAt/updatedAt` | `DateTime`    | Standard                                                             |                                                                |

Indexes: `(userId)`, `(status, createdAt)`, and `(userId, status, createdAt)` support dashboards and history queries.

### `OrderItem`

Captures product snapshot with `productId`, `productVariantId` (both `onDelete: Restrict`), currency, `titleSnapshot`, optional `variantSnapshot`. Indexed on foreign keys.

### `Payment`

Stores gateway transaction data: `provider`, `status`, unique `transactionId`, `conversationId`, pricing decimals, numerous card metadata fields, `fraudScore`, `riskFlags`, timeline fields (`authorizedAt`, `settledAt`, `failedAt`), and raw payload for reconciliation. `orderId` uses `onDelete: Restrict` to preserve ledger; `userId` uses `SetNull`. Indexed on `orderId` and `userId`.

### `PaymentRefund`

Links to `Payment` (`Cascade`) and records refund amounts/status. Indexed by `paymentId`.

### `SavedCard`

User vault storage for tokens. Unique `cardToken`, indexes on `userId`. Supports default card semantics.

## Customer Experience Models

### `Address`

Standard address fields with optional `state`, `line2`, boolean `isDefault`. `userId` cascades, indexes support quick lookup.

### `Review`

Combines user feedback with moderation metadata. Relations: `Product` (`Cascade`), `User` (`Cascade`), optional `Order` (`SetNull`). Unique composite key `(productId, userId)` prevents duplicates. Indexes on `(productId, status)`, `userId`, `orderId`. `ReviewMedia` junction attaches media to reviews (cascade on delete).

## Marketing & Loyalty Models

### `Coupon`

Promotional artifacts with monetary constraints, usage accounting (`usageLimit`, `usageCount`), validity windows (`startsAt`, `expiresAt`), and activation flag. Unique index on `code`.

### `CouponUsage`

Records redemption: links to `Coupon`, `User`, `Order` (all cascade), with `discountAmount`, `usedAt`. Indexed on each foreign key for reporting.

## Relationship & Cascade Map

- **User** → `UserSession`, `UserRole`, `UserPermission`, `SecurityEvent (SetNull)`, `Cart (SetNull)`, `Order (SetNull)`, `Review (Cascade)`, `SavedCard (Cascade)`, `Payment (SetNull)`, `CouponUsage (Cascade)`, `AuditLog (SetNull)`.
- **Product** → `ProductVariant`, `ProductCategory`, `ProductCollection`, `ProductMedia`, `Review`, `OrderItem (Restrict)`.
- **ProductVariant** → `Inventory`, `CartItem (Restrict)`, `VariantMedia`, `OrderItem (Restrict)`.
- **Category** self-references via `parentId` (`SetNull`) enabling multi-level hierarchies.
- **Cart** ↔ `Order` via optional `cartId` (one-to-one, `SetNull` on order removal to retain cart history).
- **Order** aggregates `OrderItem`, `Payment`, `Review`, `CouponUsage` and optional addresses (`SetNull` cascade).
- **Payment** cascades to `PaymentRefund` so refunds erase with the parent transaction.
- **Review** cascades to `ReviewMedia`.
- **Coupon** cascades to `CouponUsage`.

## Index Strategy Summary

The schema enforces indexes for every foreign key plus query-critical columns:

- **Lookup & Search**: `Product.slug @unique`, `Product.searchKeywords` GIN, `Category.slug @unique`, `Collection.slug @unique`, `Coupon.code @unique`.
- **Status Filtering**: Composite indexes on `(status, createdAt)` for `Product`, `Order`, `(status, updatedAt)` for `Cart`, `(productId, status)` for `Review`.
- **Relationship Joins**: Junction tables (`ProductCategory`, `ProductMedia`, etc.) index each FK. `OrderItem` indexes `orderId`, `productId`, `productVariantId`.
- **Temporal Queries**: `UserSession` indexes `expiresAt`, `AuditLog` indexes `createdAt`, `CouponUsage` indexes `usedAt` via `createdAt`.
- **Soft Delete**: `Product.deletedAt` index supports phased clean-up.

Indexes comply with **P1** by ensuring query planners can leverage them for every frequent access pattern documented in the repository layer.

## Soft Delete Pattern

- Models implementing historical visibility adopt a nullable `deletedAt` column (`Product` presently; future models can follow the same contract).
- Repositories automatically filter on `deletedAt IS NULL` via the `BaseRepository` soft-delete hook.
- Restoring a record clears `deletedAt` and increments `updatedAt`, preserving audit history.
- Any new model introducing soft delete **must** add `@@index([deletedAt])` and register the field in the repository configuration to maintain P1 compliance and predictable purging routines.

## ER Diagram

The ER diagram (`docs/backend/database/er-diagram.png`) is generated from the Prisma schema using the `prisma-erd-generator`. Regenerate it after schema changes with:

```bash
pnpm prisma generate
```

The generator block is checked into `schema.prisma` so the asset stays in sync during CI runs.
