# 🗄️ PHASE 2: DATABASE & PRISMA ORM

**Status**: 🔄 **READY TO START**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0 (Foundation), Phase 1 (Express Server)
**Estimated Time**: 10 days
**Complexity**: High

---

## 📋 PHASE OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Type**: Data Layer Foundation
**Success Criteria**: Production-ready database schema with optimized queries and comprehensive migrations

### 🎯 PHASE OBJECTIVES

Phase 2 establishes the complete data layer for the Lumi e-commerce platform using Prisma ORM with PostgreSQL, implementing normalized domain models, optimized indexes, and transaction-safe repository patterns.

**Primary Objectives:**

1. ✅ Design comprehensive e-commerce database schema (normalized 3NF)
2. ✅ Implement Prisma ORM with TypeScript integration
3. ✅ Create all core domain models (User, Product, Order, Payment, etc.)
4. ✅ Setup optimized indexes for performance (P1 compliance)
5. ✅ Implement migration system with rollback capability
6. ✅ Create idempotent seed data scripts
7. ✅ Build repository layer with error handling
8. ✅ Setup query logging and performance monitoring
9. ✅ Implement soft delete strategy
10. ✅ Create comprehensive test suite for data layer

### 🎨 DESIGN PHILOSOPHY

This phase follows **"Data Integrity First"** principle:

- **Normalized Design**: 3rd Normal Form for data integrity
- **Referential Integrity**: Foreign keys with proper cascade rules
- **Optimistic Locking**: Version fields for concurrency control
- **Query Performance**: Strategic indexes on all query paths (P1)
- **Audit Trail**: Timestamps and audit logs (Q3)
- **Type Safety**: Full TypeScript integration
- **Transaction Safety**: ACID compliance for critical operations

---

## 🎯 CRITICAL REQUIREMENTS

### Security Standards (S1-S4)

- **S1**: ⚠️ **CRITICAL** - User.passwordHash field for bcrypt storage, NO plain text
- **S2**: Input validation at repository layer
- **S3**: Audit logging for admin actions
- **S4**: Database credentials via environment variables only

### Performance Standards (P1-P2)

- **P1**: ⚠️ **MANDATORY** - Indexes on all foreign keys and search fields
- **P1**: Composite indexes for common query patterns
- **P1**: Query timeout monitoring (>200ms flagged)
- **P2**: Connection pooling configured

### Quality Standards (Q1-Q3)

- **Q1**: Zero Prisma schema warnings
- **Q2**: Standard repository response patterns
- **Q3**: ⚠️ **MANDATORY** - createdAt/updatedAt on ALL models

### Database Design Standards

```typescript
// ALL models MUST include (Q3)
createdAt  DateTime  @default(now())
updatedAt  DateTime  @updatedAt

// ID strategy
id  String  @id @default(cuid())

// Foreign keys with cascade (P1)
@@index([foreignKeyField])
onDelete: Cascade | SetNull | Restrict

// Soft delete pattern
deletedAt  DateTime?
@@index([deletedAt])
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Prisma Setup & Configuration (18 items)

#### 1.1 Prisma Installation
- [ ] Install Prisma CLI and client packages
- [ ] Install @prisma/client
- [ ] Install prisma as dev dependency
- [ ] Configure Prisma in package.json scripts
- [ ] Setup TypeScript types for Prisma

#### 1.2 Prisma Schema Configuration
- [ ] Create `prisma/schema.prisma` file
- [ ] Configure PostgreSQL datasource
- [ ] Configure Prisma Client generator
- [ ] Setup database URL from environment
- [ ] Configure connection pooling settings
- [ ] Setup preview features (if needed)
- [ ] Configure binary targets for deployment

#### 1.3 Prisma Client Setup
- [ ] Create `apps/backend/src/lib/prisma.ts`
- [ ] Implement singleton Prisma Client instance
- [ ] Configure connection pool (min/max connections)
- [ ] Setup query logging middleware
- [ ] Setup error logging middleware
- [ ] Configure slow query detection (>200ms)
- [ ] Implement graceful disconnect on shutdown
- [ ] Add connection retry logic
- [ ] Setup Prisma Client extensions (if needed)
- [ ] Export typed Prisma Client instance

#### 1.4 Environment Configuration
- [ ] Add DATABASE_URL to .env.template
- [ ] Add DATABASE_POOL_MIN configuration
- [ ] Add DATABASE_POOL_MAX configuration
- [ ] Add QUERY_TIMEOUT_MS configuration

### 2. Core Domain Models (45 items)

#### 2.1 User & Authentication Models
- [ ] Create User model with all fields
  - [ ] id (cuid), email (unique), passwordHash (S1)
  - [ ] firstName, lastName, phone
  - [ ] emailVerified, emailVerifiedAt
  - [ ] failedLoginCount, lockoutUntil
  - [ ] twoFactorSecret, twoFactorEnabled
  - [ ] status (ACTIVE, SUSPENDED, DELETED)
  - [ ] createdAt, updatedAt (Q3)
- [ ] Create UserSession model
  - [ ] id, userId (FK), refreshTokenHash
  - [ ] fingerprint, ipAddress, userAgent
  - [ ] expiresAt, revokedAt
  - [ ] createdAt, updatedAt
  - [ ] @@index([userId])
  - [ ] @@index([expiresAt])
- [ ] Create Role model
  - [ ] id, name (unique), description
  - [ ] createdAt, updatedAt
- [ ] Create Permission model
  - [ ] id, key (unique), description
  - [ ] createdAt, updatedAt
- [ ] Create RolePermission junction table
  - [ ] roleId, permissionId (composite PK)
  - [ ] assignedAt
- [ ] Create UserRole junction table
  - [ ] userId, roleId (composite PK)
  - [ ] assignedAt
- [ ] Create UserPermission junction table
  - [ ] userId, permissionId (composite PK)
  - [ ] assignedAt
- [ ] Create SecurityEvent model
  - [ ] id, userId (nullable FK), type
  - [ ] ipAddress, userAgent, payload (JSON)
  - [ ] createdAt
  - [ ] @@index([userId]), @@index([type])

#### 2.2 Product Catalog Models
- [ ] Create Product model
  - [ ] id, title, slug (unique), sku
  - [ ] description, summary
  - [ ] status (DRAFT, ACTIVE, ARCHIVED)
  - [ ] price, compareAtPrice, currency
  - [ ] inventoryPolicy (TRACK, CONTINUE, DENY)
  - [ ] searchKeywords (String[])
  - [ ] attributes (JSON)
  - [ ] deletedAt (soft delete)
  - [ ] createdAt, updatedAt
  - [ ] @@index([slug])
  - [ ] @@index([status, createdAt])
- [ ] Create ProductVariant model
  - [ ] id, productId (FK), title, sku (unique)
  - [ ] price, compareAtPrice, stock
  - [ ] attributes (JSON), weightGrams
  - [ ] isPrimary boolean
  - [ ] createdAt, updatedAt
  - [ ] @@index([productId])
  - [ ] @@index([sku])
- [ ] Create Category model
  - [ ] id, name, slug (unique), description
  - [ ] parentId (self-referential FK)
  - [ ] level, path (for hierarchy)
  - [ ] imageUrl, iconUrl
  - [ ] displayOrder
  - [ ] createdAt, updatedAt
  - [ ] @@index([parentId])
  - [ ] @@index([slug])
- [ ] Create ProductCategory junction table
  - [ ] productId, categoryId (composite PK)
  - [ ] isPrimary boolean
  - [ ] assignedAt
- [ ] Create Collection model
  - [ ] id, name, slug (unique), description
  - [ ] imageUrl, status
  - [ ] displayOrder
  - [ ] createdAt, updatedAt
- [ ] Create ProductCollection junction table
  - [ ] productId, collectionId
  - [ ] displayOrder
- [ ] Create Inventory model
  - [ ] id, productVariantId (FK unique)
  - [ ] quantityAvailable, quantityReserved
  - [ ] quantityOnHand
  - [ ] lowStockThreshold
  - [ ] updatedAt

#### 2.3 Media & Assets Models
- [ ] Create Media model
  - [ ] id, assetId (unique), url
  - [ ] type (IMAGE, VIDEO, DOCUMENT)
  - [ ] provider (CLOUDINARY, S3)
  - [ ] mimeType, sizeBytes
  - [ ] width, height (for images)
  - [ ] alt, caption
  - [ ] createdAt, updatedAt
  - [ ] @@index([assetId])
- [ ] Create ProductMedia junction table
  - [ ] productId, mediaId
  - [ ] sortOrder, isPrimary
- [ ] Create VariantMedia junction table
  - [ ] variantId, mediaId
  - [ ] sortOrder, isPrimary

#### 2.4 Cart & Checkout Models
- [ ] Create Cart model
  - [ ] id, userId (nullable FK), sessionId (nullable)
  - [ ] status (ACTIVE, CHECKED_OUT, ABANDONED)
  - [ ] expiresAt
  - [ ] createdAt, updatedAt
  - [ ] @@index([userId])
  - [ ] @@index([sessionId])
  - [ ] @@index([status, updatedAt])
- [ ] Create CartItem model
  - [ ] id, cartId (FK), productVariantId (FK)
  - [ ] quantity, unitPrice
  - [ ] createdAt, updatedAt
  - [ ] @@unique([cartId, productVariantId])
  - [ ] @@index([cartId])
- [ ] Create Address model
  - [ ] id, userId (FK), label
  - [ ] fullName, phone
  - [ ] line1, line2, city, state, postalCode, country
  - [ ] isDefault boolean
  - [ ] createdAt, updatedAt
  - [ ] @@index([userId])

#### 2.5 Order Models
- [ ] Create Order model
  - [ ] id, reference (unique order number)
  - [ ] userId (FK), cartId (nullable FK)
  - [ ] status (PENDING, PAID, FULFILLED, SHIPPED, DELIVERED, CANCELLED)
  - [ ] totalAmount, subtotalAmount, taxAmount, discountAmount
  - [ ] currency (default TRY)
  - [ ] shippingAddressId (FK), billingAddressId (FK)
  - [ ] placedAt, fulfilledAt, shippedAt, deliveredAt, cancelledAt
  - [ ] notes (text), metadata (JSON)
  - [ ] version (for optimistic locking)
  - [ ] createdAt, updatedAt
  - [ ] @@index([userId])
  - [ ] @@index([status, createdAt])
  - [ ] @@index([reference])
- [ ] Create OrderItem model
  - [ ] id, orderId (FK), productId (FK), productVariantId (FK)
  - [ ] quantity, unitPrice, currency
  - [ ] titleSnapshot, variantSnapshot (JSON)
  - [ ] createdAt, updatedAt
  - [ ] @@index([orderId])

#### 2.6 Payment Models
- [ ] Create Payment model
  - [ ] id, orderId (FK), userId (FK)
  - [ ] provider (IYZICO, STRIPE, PAYPAL, MANUAL)
  - [ ] status (INITIATED, AUTHORIZED, SETTLED, FAILED, REFUNDED)
  - [ ] transactionId, conversationId
  - [ ] amount, paidPrice, currency
  - [ ] installment, paymentChannel, paymentGroup
  - [ ] cardToken, cardAssociation, cardFamily
  - [ ] binNumber, lastFourDigits
  - [ ] threeDSHtmlContent (text)
  - [ ] ipAddress, deviceId
  - [ ] fraudScore, riskFlags (JSON)
  - [ ] authorizedAt, settledAt, failedAt
  - [ ] failureReason, failureCode
  - [ ] rawPayload (JSON)
  - [ ] createdAt, updatedAt
  - [ ] @@index([orderId])
  - [ ] @@index([userId])
  - [ ] @@index([transactionId])
- [ ] Create SavedCard model
  - [ ] id, userId (FK), cardToken (unique)
  - [ ] cardAlias, binNumber, lastFourDigits
  - [ ] cardType, cardAssociation, cardFamily
  - [ ] cardBankName, cardHolderName
  - [ ] expiryMonth, expiryYear
  - [ ] isDefault boolean
  - [ ] createdAt, updatedAt
  - [ ] @@index([userId])
- [ ] Create PaymentRefund model
  - [ ] id, paymentId (FK), amount, currency
  - [ ] reason, status
  - [ ] refundId, processedAt
  - [ ] failureReason, metadata (JSON)
  - [ ] createdAt, updatedAt

#### 2.7 Review & Rating Models
- [ ] Create Review model
  - [ ] id, productId (FK), userId (FK)
  - [ ] orderId (nullable FK) - verified purchase
  - [ ] rating (1-5), title, content
  - [ ] isVerifiedPurchase boolean
  - [ ] status (PENDING, APPROVED, REJECTED)
  - [ ] helpfulCount, notHelpfulCount
  - [ ] createdAt, updatedAt
  - [ ] @@index([productId, status])
  - [ ] @@index([userId])
- [ ] Create ReviewMedia junction table
  - [ ] reviewId, mediaId
  - [ ] sortOrder

#### 2.8 Coupon & Discount Models
- [ ] Create Coupon model
  - [ ] id, code (unique), description
  - [ ] type (PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING)
  - [ ] value (discount amount/percentage)
  - [ ] minOrderAmount, maxDiscountAmount
  - [ ] usageLimit, usageCount
  - [ ] startsAt, expiresAt
  - [ ] isActive boolean
  - [ ] createdAt, updatedAt
  - [ ] @@index([code])
- [ ] Create CouponUsage model
  - [ ] id, couponId (FK), userId (FK), orderId (FK)
  - [ ] discountAmount
  - [ ] usedAt

#### 2.9 Audit & Logging Models
- [ ] Create AuditLog model
  - [ ] id, userId (nullable FK), actorType
  - [ ] action, entity, entityId
  - [ ] before (JSON), after (JSON)
  - [ ] ipAddress, userAgent
  - [ ] createdAt
  - [ ] @@index([userId])
  - [ ] @@index([entity, entityId])
  - [ ] @@index([createdAt])

### 3. Relationships & Constraints (20 items)

#### 3.1 Foreign Key Relationships
- [ ] User ←→ UserSession (one-to-many)
- [ ] User ←→ UserRole ←→ Role (many-to-many)
- [ ] User ←→ UserPermission ←→ Permission (many-to-many)
- [ ] Role ←→ RolePermission ←→ Permission (many-to-many)
- [ ] Product ←→ ProductVariant (one-to-many)
- [ ] Product ←→ ProductCategory ←→ Category (many-to-many)
- [ ] Product ←→ ProductMedia ←→ Media (many-to-many)
- [ ] ProductVariant ←→ Inventory (one-to-one)
- [ ] ProductVariant ←→ VariantMedia ←→ Media (many-to-many)
- [ ] Category ←→ Category (self-referential parent-child)
- [ ] User ←→ Cart (one-to-many)
- [ ] Cart ←→ CartItem (one-to-many)
- [ ] CartItem → ProductVariant (many-to-one)
- [ ] User ←→ Order (one-to-many)
- [ ] Order ←→ OrderItem (one-to-many)
- [ ] Order ←→ Payment (one-to-many)
- [ ] User ←→ Address (one-to-many)
- [ ] User ←→ Review (one-to-many)
- [ ] Product ←→ Review (one-to-many)
- [ ] User ←→ SavedCard (one-to-many)

#### 3.2 Cascade Rules
- [ ] User deleted → CASCADE UserSession, UserRole, UserPermission
- [ ] User deleted → SET NULL on Cart, Order (keep order history)
- [ ] Product deleted → CASCADE ProductVariant, ProductCategory, ProductMedia
- [ ] Cart deleted → CASCADE CartItem
- [ ] Order deleted → RESTRICT if Payment exists
- [ ] Category deleted → RESTRICT if Products exist

### 4. Indexes & Performance (25 items)

#### 4.1 Primary Indexes (P1)
- [ ] User.email (unique)
- [ ] Product.slug (unique)
- [ ] Product.sku (unique if used)
- [ ] ProductVariant.sku (unique)
- [ ] Category.slug (unique)
- [ ] Order.reference (unique)
- [ ] Coupon.code (unique)
- [ ] Media.assetId (unique)

#### 4.2 Foreign Key Indexes (P1)
- [ ] UserSession.userId
- [ ] UserRole.userId, UserRole.roleId
- [ ] ProductVariant.productId
- [ ] ProductCategory.productId, ProductCategory.categoryId
- [ ] Category.parentId
- [ ] CartItem.cartId, CartItem.productVariantId
- [ ] Order.userId
- [ ] OrderItem.orderId
- [ ] Payment.orderId, Payment.userId
- [ ] Review.productId, Review.userId
- [ ] Address.userId
- [ ] SavedCard.userId

#### 4.3 Composite Indexes (P1)
- [ ] Product (status, createdAt) - for listing active products
- [ ] Cart (status, updatedAt) - for finding abandoned carts
- [ ] Order (userId, status, createdAt) - for user order history
- [ ] Review (productId, status) - for approved product reviews
- [ ] UserSession (expiresAt, revokedAt) - for cleanup
- [ ] AuditLog (entity, entityId, createdAt) - for entity history

#### 4.4 Search & Query Indexes
- [ ] Product.searchKeywords - for full-text search
- [ ] SecurityEvent.type - for filtering events
- [ ] AuditLog.createdAt - for time-based queries

### 5. Migrations System (15 items)

#### 5.1 Migration Setup
- [ ] Create `prisma/migrations/` directory structure
- [ ] Configure migration naming convention
- [ ] Setup development migration workflow
- [ ] Setup production migration workflow
- [ ] Create migration validation script

#### 5.2 Initial Migration
- [ ] Generate initial migration (all models)
- [ ] Review migration SQL
- [ ] Test migration up
- [ ] Test migration rollback
- [ ] Document migration process

#### 5.3 Migration Scripts
- [ ] Create `pnpm prisma:migrate:dev` script
- [ ] Create `pnpm prisma:migrate:deploy` script
- [ ] Create `pnpm prisma:migrate:status` script
- [ ] Create `pnpm prisma:migrate:reset` script (dev only)
- [ ] Create `pnpm prisma:generate` script
- [ ] Add migration validation to CI pipeline

### 6. Seed Data System (20 items)

#### 6.1 Seed Infrastructure
- [ ] Create `prisma/seed.ts` main file
- [ ] Create `prisma/seed/data/` directory
- [ ] Create seed data factories
- [ ] Implement idempotent seed strategy (upsert)
- [ ] Add transaction support for seed operations
- [ ] Create seed validation

#### 6.2 Default Data Seeds
- [ ] Seed default roles (customer, staff, admin)
- [ ] Seed default permissions (domain:action format)
- [ ] Assign permissions to roles
- [ ] Create admin user with bcrypt password (S1)
- [ ] Seed sample categories (hierarchical)
- [ ] Seed sample products with variants
- [ ] Seed sample media assets
- [ ] Link products to categories
- [ ] Link products to media
- [ ] Seed inventory for variants

#### 6.3 Seed Profiles
- [ ] Create development seed profile
- [ ] Create QA seed profile (more data)
- [ ] Create production seed profile (minimal)
- [ ] Create demo seed profile (showcase data)
- [ ] Add seed profile selection via CLI

#### 6.4 Seed Scripts
- [ ] Create `pnpm prisma:seed` script
- [ ] Create `pnpm prisma:seed:dev` script
- [ ] Create `pnpm prisma:seed:qa` script
- [ ] Create `pnpm prisma:seed:prod` script
- [ ] Add seed status validation

### 7. Repository Layer (25 items)

#### 7.1 Base Repository
- [ ] Create `apps/backend/src/lib/repository/base.repository.ts`
- [ ] Implement base CRUD methods
- [ ] Add pagination helper
- [ ] Add filtering helper
- [ ] Add sorting helper
- [ ] Add transaction support
- [ ] Implement error mapping (P2002, P2003, P2025)
- [ ] Add query logging integration

#### 7.2 Domain Repositories
- [ ] Create UserRepository with auth queries
- [ ] Create ProductRepository with search
- [ ] Create CategoryRepository with hierarchy queries
- [ ] Create OrderRepository with status queries
- [ ] Create CartRepository with item management
- [ ] Create PaymentRepository
- [ ] Create ReviewRepository
- [ ] Create MediaRepository
- [ ] Create AddressRepository

#### 7.3 Repository Features
- [ ] Implement soft delete queries (exclude deletedAt)
- [ ] Add projection/select optimization
- [ ] Implement eager loading strategies
- [ ] Add N+1 query prevention
- [ ] Create repository test helpers
- [ ] Document repository patterns

### 8. Query Optimization (15 items)

#### 8.1 Performance Monitoring
- [ ] Setup Prisma query logging
- [ ] Implement slow query detection (>200ms)
- [ ] Add query metrics to Prometheus
- [ ] Create query performance dashboard
- [ ] Setup query timeout alerts

#### 8.2 Query Optimization
- [ ] Analyze common query patterns
- [ ] Optimize product listing queries
- [ ] Optimize order history queries
- [ ] Optimize cart queries
- [ ] Use Prisma's `include` strategically
- [ ] Implement cursor-based pagination
- [ ] Add database query plan analysis
- [ ] Document optimization strategies

#### 8.3 Connection Management
- [ ] Configure connection pool (min: 5, max: 20)
- [ ] Implement connection health checks
- [ ] Add connection timeout handling

### 9. Data Validation & Business Logic (18 items)

#### 9.1 Prisma Middleware
- [ ] Create audit log middleware
- [ ] Create soft delete middleware
- [ ] Create timestamp validation middleware
- [ ] Create version increment middleware (optimistic locking)

#### 9.2 Validation Rules
- [ ] Validate email format at DB layer
- [ ] Validate price >= 0
- [ ] Validate stock >= 0
- [ ] Validate rating between 1-5
- [ ] Validate dates (expiresAt > createdAt)
- [ ] Validate foreign key existence
- [ ] Validate unique constraints

#### 9.3 Business Constraints
- [ ] Ensure primary variant exists for each product
- [ ] Prevent category circular references
- [ ] Validate order total calculations
- [ ] Prevent cart item duplicates
- [ ] Validate payment amount matches order
- [ ] Enforce review uniqueness per user per product
- [ ] Validate coupon usage limits

### 10. DTO & Type Management (12 items)

#### 10.1 Shared Types
- [ ] Create `packages/shared/src/dto/` directory
- [ ] Generate Prisma types for frontend sharing
- [ ] Create API request DTOs
- [ ] Create API response DTOs
- [ ] Create pagination types
- [ ] Create filter types

#### 10.2 Type Safety
- [ ] Export Prisma generated types
- [ ] Create type guards for entities
- [ ] Create mapper functions (Entity ↔ DTO)
- [ ] Document type usage patterns
- [ ] Setup type validation with Zod
- [ ] Integrate DTOs with OpenAPI schema

### 11. Testing Infrastructure (25 items)

#### 11.1 Test Database Setup
- [ ] Configure test database connection
- [ ] Setup Testcontainers for PostgreSQL
- [ ] Create test database helper utilities
- [ ] Implement database reset between tests
- [ ] Create test data factories

#### 11.2 Repository Tests
- [ ] Unit tests for UserRepository
- [ ] Unit tests for ProductRepository
- [ ] Unit tests for OrderRepository
- [ ] Unit tests for CartRepository
- [ ] Unit tests for PaymentRepository
- [ ] Test error mapping (P2002, P2025)
- [ ] Test transaction handling
- [ ] Test pagination
- [ ] Test filtering

#### 11.3 Integration Tests
- [ ] Test full user registration flow
- [ ] Test product creation with variants
- [ ] Test cart to order conversion
- [ ] Test payment recording
- [ ] Test review submission
- [ ] Test category hierarchy queries

#### 11.4 Migration Tests
- [ ] Test migration up
- [ ] Test migration rollback
- [ ] Test seed idempotency
- [ ] Validate schema against models
- [ ] Test constraint violations

#### 11.5 Performance Tests
- [ ] Test query performance (<200ms)
- [ ] Test N+1 query prevention
- [ ] Test connection pool under load
- [ ] Test concurrent transactions
- [ ] Benchmark common queries

### 12. Documentation (15 items)

#### 12.1 Schema Documentation
- [ ] Document all models and fields
- [ ] Document relationships and cascades
- [ ] Create ER diagram
- [ ] Document index strategy
- [ ] Document soft delete pattern

#### 12.2 Migration Documentation
- [ ] Create migration runbook
- [ ] Document rollback procedures
- [ ] Document backup strategy
- [ ] Document production migration process
- [ ] Create emergency recovery guide

#### 12.3 Developer Documentation
- [ ] Create repository usage guide
- [ ] Document common query patterns
- [ ] Create query optimization guide
- [ ] Document transaction patterns
- [ ] Create troubleshooting guide
- [ ] Update OpenAPI schemas with data models

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

#### Schema Validation
```bash
# Validate Prisma schema
pnpm prisma validate
# Expected: No errors

# Check migration status
pnpm prisma migrate status
# Expected: All migrations applied

# Generate Prisma Client
pnpm prisma generate
# Expected: Types generated successfully
```

#### Migration Validation
```bash
# Test migration up
pnpm prisma migrate dev --name test_migration
# Expected: Migration successful

# Test migration diff
pnpm prisma migrate diff
# Expected: No pending changes

# Reset and re-migrate
pnpm prisma migrate reset --skip-seed
pnpm prisma migrate deploy
# Expected: All migrations applied
```

#### Seed Validation
```typescript
// Test seed idempotency
await prisma.seed();
const count1 = await prisma.user.count();

await prisma.seed();
const count2 = await prisma.user.count();

expect(count1).toBe(count2); // No duplicates
```

### S1 Validation (Password Security)
```typescript
// Test User model has passwordHash field
const user = await prisma.user.findFirst();
expect(user).toHaveProperty('passwordHash');
expect(user).not.toHaveProperty('password'); // No plain text field

// Test passwordHash is bcrypt format
expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
```

### P1 Validation (Indexes)
```sql
-- Check indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Product';

-- Expected: indexes on slug, status+createdAt

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM "Product"
WHERE status = 'ACTIVE'
ORDER BY "createdAt" DESC
LIMIT 20;

-- Expected: Index Scan, execution time < 50ms
```

### Q3 Validation (Timestamps)
```typescript
// Test all models have timestamps
const models = ['User', 'Product', 'Order', 'Cart'];

for (const model of models) {
  const record = await prisma[model.toLowerCase()].findFirst();
  expect(record).toHaveProperty('createdAt');
  expect(record).toHaveProperty('updatedAt');
}
```

### Repository Error Mapping
```typescript
// Test unique constraint violation (P2002)
try {
  await userRepo.create({ email: 'duplicate@test.com' });
  await userRepo.create({ email: 'duplicate@test.com' });
} catch (error) {
  expect(error).toBeInstanceOf(ConflictError);
  expect(error.message).toContain('already exists');
}

// Test not found (P2025)
try {
  await userRepo.findById('nonexistent-id');
} catch (error) {
  expect(error).toBeInstanceOf(NotFoundError);
}
```

### Performance Benchmarks

```yaml
Query Performance:
  Simple Select: < 10ms
  Join Query: < 50ms
  Complex Query: < 200ms (P1)
  Pagination: < 100ms

Connection Pool:
  Min Connections: 5
  Max Connections: 20
  Connection Timeout: 5000ms

Migration:
  Up Migration: < 30s
  Seed Data: < 60s
```

---

## 📊 SUCCESS METRICS

### Completion Metrics
- ✅ 100% of checklist items completed (250+/250+)
- ✅ All models implemented with Q3 compliance
- ✅ All indexes created per P1 requirements
- ✅ All migrations tested (up and rollback)
- ✅ Seed data idempotent and tested
- ✅ Repository layer complete with error handling
- ✅ Documentation complete

### Quality Metrics
- ✅ Prisma Validate: 0 errors, 0 warnings
- ✅ Test Coverage: > 90%
- ✅ TypeScript: 0 type errors
- ✅ Migration Success Rate: 100%
- ✅ Seed Idempotency: 100%

### Security Metrics
- ✅ S1 Compliance: passwordHash field only
- ✅ S4 Compliance: DB credentials in env only
- ✅ Audit Logging: All critical actions logged
- ✅ Soft Delete: Implemented where needed

### Performance Metrics
- ✅ P1 Compliance: All indexes in place
- ✅ Query Performance: < 200ms (complex)
- ✅ Connection Pool: Stable under load
- ✅ N+1 Queries: 0 detected
- ✅ Slow Queries: < 1% of total

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Missing Indexes (P1 Violation)
❌ **WRONG**: No index on foreign keys
```prisma
model OrderItem {
  orderId String
  order   Order  @relation(fields: [orderId], references: [id])
  // ❌ Missing index!
}
```

✅ **CORRECT**: Index on all foreign keys
```prisma
model OrderItem {
  orderId String
  order   Order  @relation(fields: [orderId], references: [id])

  @@index([orderId]) // ✅ P1 compliant
}
```

### 2. Missing Timestamps (Q3 Violation)
❌ **WRONG**: No timestamps
```prisma
model Product {
  id    String @id
  title String
  // ❌ Missing createdAt, updatedAt
}
```

✅ **CORRECT**: All models have timestamps
```prisma
model Product {
  id        String   @id
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt // ✅ Q3 compliant
}
```

### 3. Plain Text Passwords (S1 Violation)
❌ **WRONG**: Storing plain passwords
```prisma
model User {
  id       String @id
  email    String
  password String // ❌ SECURITY RISK!
}
```

✅ **CORRECT**: Hashed passwords only
```prisma
model User {
  id           String @id
  email        String
  passwordHash String // ✅ S1 compliant
}
```

### 4. Cascade Deletes Without Thought
❌ **WRONG**: Cascading order deletion
```prisma
model Order {
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ❌ Deleting user deletes all orders!
}
```

✅ **CORRECT**: Preserve order history
```prisma
model Order {
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  // ✅ Keeps order data when user deleted
}
```

### 5. N+1 Query Problem
❌ **WRONG**: Loading relations in loop
```typescript
// ❌ N+1 queries
const products = await prisma.product.findMany();
for (const product of products) {
  const variants = await prisma.productVariant.findMany({
    where: { productId: product.id }
  });
}
```

✅ **CORRECT**: Using include
```typescript
// ✅ Single query with join
const products = await prisma.product.findMany({
  include: { variants: true }
});
```

### 6. Not Using Transactions
❌ **WRONG**: Multiple operations without transaction
```typescript
// ❌ Can fail partially
await prisma.order.create({ data: orderData });
await prisma.payment.create({ data: paymentData });
await prisma.inventory.update({ data: inventoryData });
```

✅ **CORRECT**: Atomic transaction
```typescript
// ✅ All or nothing
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: orderData });
  await tx.payment.create({ data: paymentData });
  await tx.inventory.update({ data: inventoryData });
});
```

### 7. Hardcoded Database URL (S4 Violation)
❌ **WRONG**: Hardcoded connection string
```prisma
datasource db {
  provider = "postgresql"
  url      = "postgresql://user:pass@localhost:5432/db" // ❌ SECURITY RISK!
}
```

✅ **CORRECT**: Environment variable
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // ✅ S4 compliant
}
```

### 8. Non-Idempotent Seeds
❌ **WRONG**: Creating duplicates
```typescript
// ❌ Fails on second run
await prisma.role.create({
  data: { name: 'admin' }
});
```

✅ **CORRECT**: Upsert pattern
```typescript
// ✅ Idempotent
await prisma.role.upsert({
  where: { name: 'admin' },
  update: {},
  create: { name: 'admin' }
});
```

---

## 📦 DELIVERABLES

### Schema Files
1. ✅ `prisma/schema.prisma` - Complete schema
2. ✅ `prisma/migrations/` - All migration files
3. ✅ `prisma/seed.ts` - Main seed file
4. ✅ `prisma/seed/data/` - Seed data modules

### Library Files
5. ✅ `apps/backend/src/lib/prisma.ts` - Prisma Client singleton
6. ✅ `apps/backend/src/lib/repository/base.repository.ts` - Base repository
7. ✅ `apps/backend/src/lib/repository/errors.ts` - Error mapping

### Repository Files
8. ✅ `apps/backend/src/modules/user/user.repository.ts`
9. ✅ `apps/backend/src/modules/product/product.repository.ts`
10. ✅ `apps/backend/src/modules/order/order.repository.ts`
11. ✅ `apps/backend/src/modules/cart/cart.repository.ts`
12. ✅ `apps/backend/src/modules/payment/payment.repository.ts`
13. ✅ `apps/backend/src/modules/review/review.repository.ts`
14. ✅ `apps/backend/src/modules/media/media.repository.ts`
15. ✅ `apps/backend/src/modules/category/category.repository.ts`

### Shared Types
16. ✅ `packages/shared/src/dto/` - DTO definitions
17. ✅ `packages/shared/src/db/` - Shared DB types
18. ✅ `packages/shared/src/types/prisma.ts` - Exported Prisma types

### Test Files
19. ✅ `apps/backend/src/__tests__/unit/repository/` - Repository unit tests
20. ✅ `apps/backend/src/__tests__/integration/database/` - Integration tests
21. ✅ `apps/backend/src/__tests__/fixtures/` - Test data factories
22. ✅ `apps/backend/src/__tests__/helpers/db.ts` - Test DB utilities

### Documentation
23. ✅ `docs/backend/database/schema.md` - Schema documentation
24. ✅ `docs/backend/database/er-diagram.png` - ER diagram
25. ✅ `docs/backend/database/migrations.md` - Migration runbook
26. ✅ `docs/backend/database/repository-guide.md` - Repository patterns
27. ✅ `docs/backend/database/query-optimization.md` - Performance guide
28. ✅ `docs/backend/database/troubleshooting.md` - Common issues
29. ✅ `PHASE-2-COMPLETION-REPORT.md` - Phase report

### Configuration Files
30. ✅ `.env.template` updates - Database configuration
31. ✅ `apps/backend/package.json` - Prisma scripts

---

## 🧪 TESTING STRATEGY

### Test Categories

#### 1. Schema Validation Tests
```bash
# Prisma schema validation
pnpm prisma validate

# Check for schema drift
pnpm prisma migrate diff

# Format schema
pnpm prisma format
```

#### 2. Migration Tests
```typescript
describe('Migrations', () => {
  it('should apply all migrations successfully', async () => {
    await execPromise('pnpm prisma migrate deploy');
    // No errors expected
  });

  it('should rollback last migration', async () => {
    const migrations = await getMigrations();
    const lastMigration = migrations[migrations.length - 1];
    await rollbackMigration(lastMigration);
    // Migration rolled back successfully
  });
});
```

#### 3. Repository Unit Tests
```typescript
describe('UserRepository', () => {
  let userRepo: UserRepository;

  beforeEach(() => {
    userRepo = new UserRepository(prisma);
  });

  it('should create user with hashed password', async () => {
    const user = await userRepo.create({
      email: 'test@example.com',
      passwordHash: await bcrypt.hash('password', 12)
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // S1
  });

  it('should throw ConflictError on duplicate email', async () => {
    await userRepo.create({ email: 'dup@test.com', passwordHash: 'hash' });

    await expect(
      userRepo.create({ email: 'dup@test.com', passwordHash: 'hash' })
    ).rejects.toThrow(ConflictError); // P2002 mapping
  });

  it('should have timestamps', async () => {
    const user = await userRepo.create({
      email: 'test@example.com',
      passwordHash: 'hash'
    });

    expect(user.createdAt).toBeInstanceOf(Date); // Q3
    expect(user.updatedAt).toBeInstanceOf(Date); // Q3
  });
});
```

#### 4. Integration Tests
```typescript
describe('Order Creation Flow', () => {
  it('should create order with items in transaction', async () => {
    // Setup
    const user = await createTestUser();
    const product = await createTestProduct();
    const variant = await createTestVariant(product.id);

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          reference: generateOrderRef(),
          totalAmount: 100,
          items: {
            create: [{
              productId: product.id,
              productVariantId: variant.id,
              quantity: 1,
              unitPrice: 100
            }]
          }
        },
        include: { items: true }
      });

      await tx.inventory.update({
        where: { productVariantId: variant.id },
        data: { quantityAvailable: { decrement: 1 } }
      });

      return order;
    });

    expect(order.items).toHaveLength(1);
    expect(order.totalAmount).toBe(100);
  });
});
```

#### 5. Performance Tests
```typescript
describe('Query Performance', () => {
  it('should load products with variants efficiently', async () => {
    const start = Date.now();

    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        variants: true,
        categories: { include: { category: true } }
      },
      take: 20
    });

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200); // P1 requirement
    expect(products).toHaveLength(20);
  });

  it('should prevent N+1 queries', async () => {
    const queryLog: string[] = [];

    prisma.$on('query', (e) => {
      queryLog.push(e.query);
    });

    await productRepository.findManyWithRelations({ take: 10 });

    // Should be 1 query with joins, not 10+ queries
    expect(queryLog.length).toBeLessThanOrEqual(2);
  });
});
```

#### 6. Seed Idempotency Tests
```typescript
describe('Seed Idempotency', () => {
  it('should not create duplicates on multiple runs', async () => {
    await seed();
    const count1 = await prisma.role.count();

    await seed();
    const count2 = await prisma.role.count();

    expect(count1).toBe(count2);
    expect(count1).toBeGreaterThan(0);
  });

  it('should create default admin user', async () => {
    await seed();

    const admin = await prisma.user.findFirst({
      where: { email: 'admin@lumi.com' },
      include: { roles: { include: { role: true } } }
    });

    expect(admin).toBeDefined();
    expect(admin.roles.some(ur => ur.role.name === 'admin')).toBe(true);
    expect(admin.passwordHash).toMatch(/^\$2[aby]\$/); // S1
  });
});
```

---

## 📚 OPERATIONAL READINESS

### Migration Runbook

#### Development Migrations
```bash
# Create new migration
pnpm prisma migrate dev --name add_coupon_model

# Reset database (⚠️ destroys data)
pnpm prisma migrate reset

# Check migration status
pnpm prisma migrate status
```

#### Production Migrations
```bash
# Review pending migrations
pnpm prisma migrate status

# Deploy migrations (no prompts)
pnpm prisma migrate deploy

# Verify deployment
pnpm prisma migrate status
```

#### Rollback Procedure
```bash
# 1. Identify migration to rollback
pnpm prisma migrate status

# 2. Create compensating migration
# (Prisma doesn't support automatic rollback)
pnpm prisma migrate dev --name rollback_coupon_model

# 3. Manually write down migration to undo changes

# 4. Apply rollback migration
pnpm prisma migrate deploy
```

### Troubleshooting

**Problem**: Migration fails with "relation already exists"
```bash
# Solution: Reset shadow database
pnpm prisma migrate reset

# Or manually drop conflicting tables
psql $DATABASE_URL -c "DROP TABLE IF EXISTS _prisma_migrations CASCADE"
```

**Problem**: Slow queries (>200ms)
```bash
# Solution: Analyze query
psql $DATABASE_URL

EXPLAIN ANALYZE
SELECT * FROM "Product"
WHERE status = 'ACTIVE'
ORDER BY "createdAt" DESC;

# Add missing index if needed
```

**Problem**: Connection pool exhausted
```bash
# Solution: Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Increase pool size in .env
DATABASE_POOL_MAX=30
```

**Problem**: Seed fails with unique constraint
```bash
# Solution: Use upsert instead of create
# Check seed.ts for proper upsert usage
```

### Monitoring Queries

```sql
-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Check slow queries (requires pg_stat_statements)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 200
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 📊 PHASE COMPLETION CRITERIA

### Pre-Completion Checklist

#### Schema Quality
- [ ] All 250+ checklist items completed
- [ ] Prisma validate: 0 errors
- [ ] All models have Q3 timestamps
- [ ] All foreign keys have P1 indexes
- [ ] S1: passwordHash field only
- [ ] No hardcoded credentials (S4)

#### Migration Quality
- [ ] All migrations tested (up/down)
- [ ] Migration status shows all applied
- [ ] Seed is idempotent
- [ ] Rollback procedures documented
- [ ] Production migration tested in staging

#### Repository Quality
- [ ] All repositories implemented
- [ ] Error mapping complete (P2002, P2025, etc)
- [ ] Transaction support working
- [ ] N+1 queries prevented
- [ ] Query performance < 200ms (P1)

#### Testing
- [ ] Repository tests > 90% coverage
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Migration tests passing
- [ ] Seed tests passing

#### Documentation
- [ ] ER diagram complete
- [ ] Schema documented
- [ ] Migration runbook complete
- [ ] Repository guide complete
- [ ] Troubleshooting guide complete

---

## 📄 COMPLETION REPORT TEMPLATE

```markdown
# PHASE 2 COMPLETION REPORT

**Date**: [YYYY-MM-DD]
**Duration**: [X days]
**Completed By**: [Team/Individual]

## Summary
Complete database schema with Prisma ORM implemented, tested, and optimized for production use.

## Deliverables Status
- [x] All 250+ checklist items completed
- [x] 31 deliverables created
- [x] All validation tests passing
- [x] Documentation complete

## Metrics Achieved
- Models Created: [X]
- Migrations: [X]
- Indexes: [X]
- Query Performance: [X]ms avg (target: <200ms)
- Test Coverage: [X]% (target: >90%)

## Compliance
- S1 Compliance: ✅ PASS (passwordHash only)
- P1 Compliance: ✅ PASS (all indexes)
- Q3 Compliance: ✅ PASS (all timestamps)
- S4 Compliance: ✅ PASS (no hardcoded creds)

## Performance Benchmarks
- Simple Queries: [X]ms avg
- Complex Queries: [X]ms avg
- N+1 Queries: 0 detected
- Connection Pool: Stable

## Issues Encountered
[List any issues and resolutions]

## Next Steps
- Ready to begin Phase 3: Authentication & RBAC
- Dependencies: Phase 0, 1, 2
- Estimated Start: [Date]

## Sign-Offs
- Technical Lead: ✅ [Name, Date]
- DBA: ✅ [Name, Date]
- QA: ✅ [Name, Date]
```

---

**END OF PHASE 2 DOCUMENTATION**

*Last Updated: 2025-10-01*
*Version: 1.0*
*Status: Ready for Implementation*
