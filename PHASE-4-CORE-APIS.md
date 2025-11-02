# 🚀 PHASE 4: CORE BUSINESS APIs

**Status**: 🔄 **IN PROGRESS**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3
**Estimated Time**: 12 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Code**: PHASE-4
**Module Focus**: Core REST APIs for Business Logic
**Expected Lines of Code**: ~8,500 lines
**Test Coverage Target**: ≥85%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Catalog Management API** - Complete product and category CRUD with advanced filtering
2. **Cart Management API** - Persistent cart operations with session handling
3. **Order Processing API** - Full order lifecycle with payment integration
4. **User Management API** - Profile, addresses, preferences management
5. **Admin Operations API** - Comprehensive admin controls with audit logging
6. **API Documentation** - OpenAPI 3.1 specification with Swagger UI
7. **Performance Optimization** - Caching, indexing, and query optimization
8. **Security Hardening** - Rate limiting, RBAC, input sanitization

### Success Criteria

- ✅ All API endpoints return Q2 format responses
- ✅ 100% endpoint test coverage with average/error/recovery scenarios
- ✅ API response time P95 < 250ms
- ✅ OpenAPI spec validated with jest-openapi
- ✅ RBAC enforced on all admin endpoints (S3)
- ✅ Input sanitization on all user inputs (S2)
- ✅ Comprehensive API documentation with examples
- ✅ Postman collection with all endpoints

---

## 🎯 CRITICAL REQUIREMENTS

### API Standards (Q2 Format)

**Q2 Response Format:**

```typescript
// Success Response
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2025-10-01T12:00:00Z",
    "requestId": "uuid-v4",
    "pagination": {
      "page": 1,
      "perPage": 24,
      "total": 156,
      "totalPages": 7
    }
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-10-01T12:00:00Z",
    "requestId": "uuid-v4"
  }
}
```

### Performance Standards (P1/P2)

- **P1**: All product queries < 100ms (indexed: `slug`, `status`, `createdAt`)
- **P1**: Order queries < 150ms (indexed: `userId`, `status`, `reference`)
- **P1**: Cart operations < 50ms (indexed: `userId`, `sessionId`)
- **P2**: Media responses include Cloudinary transformations (WebP, responsive)
- **P2**: Pagination default 24 items, cursor-based option for large datasets
- **P2**: Redis cache for popular products (60s TTL), ETag support

### Security Standards (S2/S3)

- **S2**: All input sanitized and validated (Zod schemas)
- **S2**: Rate limiting: Customer (120 req/5min), Admin (300 req/5min)
- **S3**: Admin endpoints protected with RBAC + audit logging
- **S3**: All admin actions logged with user ID, IP, timestamp
- **S3**: CSRF protection for state-changing operations
- **S3**: Webhook signature validation for payment callbacks

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
apps/backend/src/
├── modules/
│   ├── catalog/
│   │   ├── catalog.controller.ts      # HTTP handlers
│   │   ├── catalog.service.ts         # Business logic
│   │   ├── catalog.repository.ts      # Data access
│   │   ├── catalog.validators.ts      # Zod schemas
│   │   ├── catalog.router.ts          # Route definitions
│   │   └── __tests__/
│   │       ├── catalog.unit.test.ts
│   │       ├── catalog.integration.test.ts
│   │       └── catalog.average.test.ts
│   ├── cart/
│   │   ├── cart.controller.ts
│   │   ├── cart.service.ts
│   │   ├── cart.repository.ts
│   │   ├── cart.validators.ts
│   │   ├── cart.router.ts
│   │   └── __tests__/
│   ├── order/
│   │   ├── order.controller.ts
│   │   ├── order.service.ts
│   │   ├── order.repository.ts
│   │   ├── order.validators.ts
│   │   ├── order.router.ts
│   │   └── __tests__/
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.validators.ts
│   │   ├── user.router.ts
│   │   └── __tests__/
│   └── payment/
│       ├── payment.controller.ts
│       ├── payment.service.ts
│       ├── payment.validators.ts
│       ├── payment.router.ts
│       └── __tests__/
├── routes/
│   └── v1/
│       ├── index.ts                   # Main router
│       ├── admin.ts                   # Admin routes
│       └── public.ts                  # Public routes
├── middleware/
│   ├── rateLimiter.ts                 # Rate limiting
│   ├── responseFormatter.ts           # Q2 format
│   ├── requestLogger.ts               # Audit logging
│   └── errorHandler.ts                # Error formatting
└── utils/
    ├── apiResponse.ts                 # Response helpers
    ├── pagination.ts                  # Pagination logic
    └── queryBuilder.ts                # Filter/sort helpers

packages/shared/src/
├── dto/
│   ├── catalog.dto.ts
│   ├── cart.dto.ts
│   ├── order.dto.ts
│   └── user.dto.ts
└── api-schemas/
    └── openapi.yaml                   # OpenAPI 3.1 spec

docs/api/
├── catalog.md                         # Catalog API docs
├── cart.md                            # Cart API docs
├── order.md                           # Order API docs
└── user.md                            # User API docs
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. API Foundation & Middleware (18 items)

#### 1.1 Response Formatter Middleware

- [ ] Create `responseFormatter.ts` middleware
- [ ] Implement `formatSuccess(data, meta?)` helper
- [ ] Implement `formatError(error, meta?)` helper
- [ ] Add request ID generation (UUID v4)
- [ ] Add timestamp to all responses
- [ ] Implement pagination metadata structure
- [ ] Add Q2 format validation tests

#### 1.2 Error Handler Middleware

- [ ] Create centralized error handler
- [ ] Map Prisma errors to HTTP status codes
- [ ] Map Zod validation errors to 422 responses
- [ ] Implement error logging with Sentry
- [ ] Add error code standardization
- [ ] Create error response factory
- [ ] Test all error scenarios

#### 1.3 Rate Limiter Middleware

- [ ] Install `express-rate-limit` package
- [ ] Create Redis store for rate limiting
- [ ] Configure customer rate limits (120 req/5min)
- [ ] Configure admin rate limits (300 req/5min)
- [ ] Add rate limit headers (X-RateLimit-\*)
- [ ] Implement IP-based tracking
- [ ] Add bypass for internal services
- [ ] Test rate limit enforcement

#### 1.4 Request Logger & Audit

- [ ] Create request logging middleware
- [ ] Log all admin actions to audit table
- [ ] Include user ID, IP, action, timestamp
- [ ] Mask sensitive data in logs (passwords, tokens)
- [ ] Implement log rotation strategy
- [ ] Add correlation ID for request tracing
- [ ] Create audit log query endpoints (admin only)

---

### 2. Catalog Management API (32 items)

#### 2.1 Product CRUD Endpoints (Public)

- [ ] GET `/api/v1/products` - List products with filters
  - [ ] Implement pagination (default 24 items)
  - [ ] Add filter by category (query param)
  - [ ] Add filter by price range (min/max)
  - [ ] Add filter by attributes (JSON query)
  - [ ] Add filter by status (active only for public)
  - [ ] Add sort options (relevance, price, newest, rating)
  - [ ] Implement full-text search (searchKeywords)
  - [ ] Add Redis caching (60s TTL)
- [ ] GET `/api/v1/products/:slug` - Get product by slug
  - [ ] Include variants with stock info
  - [ ] Include categories (breadcrumb data)
  - [ ] Include media assets (Cloudinary URLs)
  - [ ] Include review statistics
  - [ ] Add ETag header for caching
  - [ ] Return 404 for inactive products
- [ ] GET `/api/v1/products/:id/variants` - List product variants
  - [ ] Include stock levels
  - [ ] Include pricing (base + adjustment)
  - [ ] Include variant media
  - [ ] Filter by in-stock availability

#### 2.2 Product CRUD Endpoints (Admin)

- [ ] POST `/api/v1/admin/products` - Create product
  - [ ] Validate required fields (title, sku, price)
  - [ ] Auto-generate slug from title
  - [ ] Validate unique slug
  - [ ] Create primary variant automatically
  - [ ] Set default status to DRAFT
  - [ ] Audit log creation
- [ ] PUT `/api/v1/admin/products/:id` - Update product
  - [ ] Partial update support
  - [ ] Validate slug uniqueness on change
  - [ ] Update searchKeywords array
  - [ ] Audit log update
- [ ] DELETE `/api/v1/admin/products/:id` - Soft delete product
  - [ ] Set status to ARCHIVED
  - [ ] Archive all variants
  - [ ] Check for active orders
  - [ ] Audit log deletion
- [ ] POST `/api/v1/admin/products/:id/variants` - Add variant
  - [ ] Validate unique SKU
  - [ ] Set isPrimary if first variant
  - [ ] Validate attributes match product
- [ ] PUT `/api/v1/admin/products/:id/variants/:variantId` - Update variant
  - [ ] Validate stock >= 0
  - [ ] Prevent primary variant deletion
  - [ ] Audit log variant changes
- [ ] DELETE `/api/v1/admin/products/:id/variants/:variantId` - Delete variant

#### 2.3 Category Management

- [ ] GET `/api/v1/categories` - List categories (tree structure)
  - [ ] Include product count per category
  - [ ] Support depth limiting (query param)
  - [ ] Cache category tree (15min TTL)
- [ ] GET `/api/v1/categories/:slug` - Get category with products
  - [ ] Include subcategories
  - [ ] Include category products (paginated)
  - [ ] Include breadcrumb path
- [ ] POST `/api/v1/admin/categories` - Create category
  - [ ] Validate unique slug
  - [ ] Calculate level and path
  - [ ] Validate parent exists
- [ ] PUT `/api/v1/admin/categories/:id` - Update category
  - [ ] Recalculate path if parent changed
  - [ ] Update all children paths
- [ ] DELETE `/api/v1/admin/categories/:id` - Delete category
  - [ ] Check for products in category
  - [ ] Reassign products or prevent deletion

---

### 3. Cart Management API (28 items)

#### 3.1 Cart Operations (Authenticated Users)

- [ ] GET `/api/v1/cart` - Get current user's cart
  - [ ] Include all items with product details
  - [ ] Calculate subtotal, tax, total
  - [ ] Include stock validation status
  - [ ] Include estimated delivery time
  - [ ] Return empty cart if none exists
- [ ] POST `/api/v1/cart/items` - Add item to cart
  - [ ] Validate product variant exists
  - [ ] Check stock availability
  - [ ] Validate quantity > 0 and <= 10
  - [ ] Update if item already exists
  - [ ] Recalculate cart totals
  - [ ] Invalidate cart cache
- [ ] PUT `/api/v1/cart/items/:itemId` - Update item quantity
  - [ ] Validate new quantity
  - [ ] Check stock availability
  - [ ] Remove if quantity = 0
  - [ ] Recalculate totals
- [ ] DELETE `/api/v1/cart/items/:itemId` - Remove item
  - [ ] Soft delete cart item
  - [ ] Recalculate totals
- [ ] DELETE `/api/v1/cart` - Clear entire cart
  - [ ] Remove all items
  - [ ] Keep cart record for history

#### 3.2 Cart Session Handling

- [ ] POST `/api/v1/cart/merge` - Merge guest cart after login
  - [ ] Find guest cart by session ID
  - [ ] Merge into user cart
  - [ ] Handle duplicate items (sum quantities)
  - [ ] Validate merged cart stock
  - [ ] Archive guest cart
- [ ] GET `/api/v1/cart/validate` - Validate cart before checkout
  - [ ] Check all items in stock
  - [ ] Validate pricing consistency
  - [ ] Check for unavailable products
  - [ ] Return detailed validation report

#### 3.3 Cart Business Logic

- [ ] Implement automatic cart expiry (30 days)
- [ ] Create cleanup job for abandoned carts
- [ ] Implement cart recovery email trigger
- [ ] Add cart summary calculation service
- [ ] Implement inventory reservation on checkout init
- [ ] Add cart event emitters (item added, removed)
- [ ] Implement cart analytics tracking

---

### 4. Order Processing API (35 items)

#### 4.1 Order Creation & Lifecycle

- [ ] POST `/api/v1/orders` - Create order (checkout)
  - [ ] Validate cart not empty
  - [ ] Validate all items in stock (atomic)
  - [ ] Validate shipping address
  - [ ] Validate billing address
  - [ ] Calculate final totals (tax, shipping, discounts)
  - [ ] Generate unique order reference
  - [ ] Reserve inventory atomically
  - [ ] Create order in PENDING status
  - [ ] Initialize payment intent
  - [ ] Send order confirmation email
  - [ ] Audit log order creation
  - [ ] Return order with payment details
- [ ] GET `/api/v1/orders` - List user's orders
  - [ ] Paginate results
  - [ ] Filter by status (query param)
  - [ ] Filter by date range
  - [ ] Sort by newest first
  - [ ] Include order items count
- [ ] GET `/api/v1/orders/:id` - Get order details
  - [ ] Include all order items
  - [ ] Include shipping address
  - [ ] Include billing address
  - [ ] Include payment details (masked)
  - [ ] Include status timeline
  - [ ] Verify user owns order
- [ ] PUT `/api/v1/orders/:id/cancel` - Cancel order
  - [ ] Validate order status (PENDING or PAID only)
  - [ ] Check cancellation deadline
  - [ ] Release inventory reservation
  - [ ] Initiate refund if paid
  - [ ] Update status to CANCELLED
  - [ ] Send cancellation email
  - [ ] Audit log cancellation

#### 4.2 Order Tracking

- [ ] GET `/api/v1/orders/:reference/track` - Public order tracking
  - [ ] Validate order reference format
  - [ ] Return order status timeline
  - [ ] Include shipment tracking info
  - [ ] Include estimated delivery date
  - [ ] No authentication required (public endpoint)

#### 4.3 Admin Order Management

- [ ] GET `/api/v1/admin/orders` - List all orders
  - [ ] Advanced filtering (status, date, user, amount)
  - [ ] Search by order reference
  - [ ] Search by customer email
  - [ ] Export to CSV option
  - [ ] Include revenue statistics
- [ ] GET `/api/v1/admin/orders/:id` - Get order details (admin view)
  - [ ] Include customer information
  - [ ] Include payment provider details
  - [ ] Include fraud detection data
  - [ ] Include internal notes
- [ ] PUT `/api/v1/admin/orders/:id/status` - Update order status
  - [ ] Validate status transition rules
  - [ ] Send notification on status change
  - [ ] Update inventory if fulfilled
  - [ ] Audit log status change
- [ ] POST `/api/v1/admin/orders/:id/notes` - Add internal note
  - [ ] Timestamp and admin user ID
  - [ ] Support markdown formatting
- [ ] POST `/api/v1/admin/orders/:id/refund` - Process refund
  - [ ] Validate refund amount <= paid amount
  - [ ] Call payment provider refund API
  - [ ] Update order status
  - [ ] Restore inventory if applicable
  - [ ] Send refund confirmation email
  - [ ] Audit log refund
- [ ] GET `/api/v1/admin/orders/stats` - Order statistics
  - [ ] Total orders by status
  - [ ] Revenue by date range
  - [ ] Average order value
  - [ ] Top products
  - [ ] Conversion rate

---

### 5. User Management API (24 items)

#### 5.1 User Profile Management

- [ ] GET `/api/v1/users/me` - Get current user profile
  - [ ] Include all profile fields
  - [ ] Exclude sensitive data (passwordHash)
  - [ ] Include account status
  - [ ] Include preferences
- [ ] PUT `/api/v1/users/me` - Update profile
  - [ ] Validate email uniqueness
  - [ ] Sanitize all inputs (S2)
  - [ ] Update searchable fields
  - [ ] Audit log profile update
- [ ] PUT `/api/v1/users/me/password` - Change password
  - [ ] Validate current password
  - [ ] Validate new password strength
  - [ ] Hash with bcrypt (12 rounds)
  - [ ] Invalidate all sessions
  - [ ] Send password change email
  - [ ] Audit log password change

#### 5.2 Address Management

- [ ] GET `/api/v1/users/me/addresses` - List user addresses
  - [ ] Include default flag
  - [ ] Sort by isDefault DESC, createdAt DESC
- [ ] POST `/api/v1/users/me/addresses` - Create address
  - [ ] Validate address fields
  - [ ] Set as default if first address
  - [ ] Validate phone format
  - [ ] Validate postal code format
- [ ] PUT `/api/v1/users/me/addresses/:id` - Update address
  - [ ] Verify address belongs to user
  - [ ] Validate updated fields
- [ ] DELETE `/api/v1/users/me/addresses/:id` - Delete address
  - [ ] Verify address belongs to user
  - [ ] Check if used in active orders
  - [ ] Soft delete if used in orders
- [ ] PUT `/api/v1/users/me/addresses/:id/default` - Set default address
  - [ ] Unset previous default
  - [ ] Set new default atomically

#### 5.3 User Preferences

- [ ] GET `/api/v1/users/me/preferences` - Get preferences
- [ ] PUT `/api/v1/users/me/preferences` - Update preferences
  - [ ] Notification settings
  - [ ] Language preference
  - [ ] Currency preference
  - [ ] Marketing consent
  - [ ] Privacy settings

#### 5.4 Admin User Management

- [ ] GET `/api/v1/admin/users` - List all users
  - [ ] Filter by status, role, date
  - [ ] Search by email, name
  - [ ] Paginate results
  - [ ] Export to CSV
- [ ] GET `/api/v1/admin/users/:id` - Get user details
  - [ ] Include order history summary
  - [ ] Include audit log entries
  - [ ] Include account flags
- [ ] PUT `/api/v1/admin/users/:id/status` - Update user status
  - [ ] Set ACTIVE, SUSPENDED, LOCKED
  - [ ] Send notification email
  - [ ] Audit log status change
- [ ] POST `/api/v1/admin/users/:id/unlock` - Unlock account
  - [ ] Reset failed login attempts
  - [ ] Update status to ACTIVE
  - [ ] Send unlock notification

---

### 6. Validation & Security (22 items)

#### 6.1 Zod Validation Schemas

- [ ] Create `catalog.validators.ts`
  - [ ] ProductCreateSchema
  - [ ] ProductUpdateSchema
  - [ ] ProductFilterSchema
  - [ ] VariantCreateSchema
  - [ ] CategoryCreateSchema
- [ ] Create `cart.validators.ts`
  - [ ] AddCartItemSchema
  - [ ] UpdateCartItemSchema
  - [ ] MergeCartSchema
- [ ] Create `order.validators.ts`
  - [ ] CreateOrderSchema
  - [ ] UpdateOrderStatusSchema
  - [ ] RefundOrderSchema
- [ ] Create `user.validators.ts`
  - [ ] UpdateProfileSchema
  - [ ] CreateAddressSchema
  - [ ] UpdatePreferencesSchema

#### 6.2 Input Sanitization (S2)

- [ ] Install `validator` and `sanitize-html` packages
- [ ] Create sanitization middleware
- [ ] Sanitize all string inputs
- [ ] Strip HTML tags from descriptions
- [ ] Validate and sanitize URLs
- [ ] Escape special characters in search queries
- [ ] Test XSS prevention
- [ ] Test SQL injection prevention

#### 6.3 RBAC & Authorization (S3)

- [ ] Implement `requireRole(role)` middleware
- [ ] Implement `requirePermission(permission)` middleware
- [ ] Create RBAC service for permission checks
- [ ] Define permission constants
  - [ ] `products:read`, `products:write`, `products:delete`
  - [ ] `orders:read`, `orders:write`, `orders:refund`
  - [ ] `users:read`, `users:write`, `users:delete`
- [ ] Protect all admin routes
- [ ] Test unauthorized access returns 403
- [ ] Audit log all admin actions

---

### 7. Performance Optimization (18 items)

#### 7.1 Database Indexing (P1)

- [ ] Add index on `Product.slug` (unique)
- [ ] Add index on `Product.status`
- [ ] Add composite index on `Product(status, createdAt)`
- [ ] Add GIN index on `Product.searchKeywords` (PostgreSQL)
- [ ] Add index on `Order.userId`
- [ ] Add index on `Order.status`
- [ ] Add index on `Order.reference` (unique)
- [ ] Add index on `Cart.userId`
- [ ] Add index on `Cart.sessionId`
- [ ] Verify all indexes created with `EXPLAIN ANALYZE`

#### 7.2 Caching Strategy (P2)

- [ ] Configure Redis client
- [ ] Cache product listings (60s TTL)
- [ ] Cache category tree (15min TTL)
- [ ] Cache popular products (5min TTL)
- [ ] Implement cache invalidation on updates
- [ ] Add cache hit/miss metrics
- [ ] Implement ETag generation for products
- [ ] Support `If-None-Match` header (304 responses)

#### 7.3 Query Optimization

- [ ] Use `select` to limit returned fields
- [ ] Use `include` strategically (avoid N+1)
- [ ] Implement pagination helpers
- [ ] Add cursor-based pagination for large datasets
- [ ] Optimize product search query
- [ ] Add query performance logging
- [ ] Test with large dataset (10K products)

---

### 8. API Documentation (16 items)

#### 8.1 OpenAPI Specification

- [ ] Create `packages/shared/src/api-schemas/openapi.yaml`
- [ ] Define all endpoints with full specs
- [ ] Define all request/response schemas
- [ ] Add authentication schemes (JWT Bearer)
- [ ] Add rate limit headers documentation
- [ ] Add error response examples
- [ ] Add success response examples
- [ ] Validate spec with Spectral

#### 8.2 Swagger UI Integration

- [ ] Install `swagger-ui-express` package
- [ ] Serve Swagger UI at `/api/docs`
- [ ] Configure API key authentication
- [ ] Add "Try it out" functionality
- [ ] Add servers (development, staging, production)
- [ ] Protect docs endpoint (optional)

#### 8.3 API Documentation Files

- [ ] Create `docs/api/catalog.md`
  - [ ] List all catalog endpoints
  - [ ] Add request/response examples
  - [ ] Add filter/sort documentation
- [ ] Create `docs/api/cart.md`
  - [ ] Document cart operations
  - [ ] Add merge cart flow diagram
- [ ] Create `docs/api/order.md`
  - [ ] Document checkout flow
  - [ ] Add order status lifecycle
- [ ] Create `docs/api/user.md`
  - [ ] Document profile management
  - [ ] Document address management

#### 8.4 Postman Collection

- [ ] Export OpenAPI spec to Postman
- [ ] Create environment variables
- [ ] Add authentication setup
- [ ] Add example requests for all endpoints
- [ ] Publish collection to workspace

---

### 9. Testing Implementation (30 items)

#### 9.1 Unit Tests

- [ ] Test `catalog.service.ts` methods
  - [ ] `createProduct()` - creates product with variant
  - [ ] `updateProduct()` - updates and validates slug
  - [ ] `deleteProduct()` - soft deletes
  - [ ] `getProduct()` - returns with relations
  - [ ] `listProducts()` - filters and paginates
  - [ ] `searchProducts()` - full-text search
- [ ] Test `cart.service.ts` methods
  - [ ] `addItem()` - adds or updates item
  - [ ] `updateItem()` - updates quantity
  - [ ] `removeItem()` - removes item
  - [ ] `clearCart()` - clears all items
  - [ ] `mergeCart()` - merges guest to user cart
  - [ ] `validateCart()` - stock and price checks
- [ ] Test `order.service.ts` methods
  - [ ] `createOrder()` - creates with inventory reservation
  - [ ] `getOrder()` - returns with relations
  - [ ] `cancelOrder()` - releases inventory
  - [ ] `updateStatus()` - validates transitions
- [ ] Test `user.service.ts` methods
  - [ ] `updateProfile()` - validates and updates
  - [ ] `createAddress()` - creates and sets default
  - [ ] `updatePreferences()` - updates preferences

#### 9.2 Integration Tests

- [ ] Test product listing endpoint
  - [ ] Returns Q2 format
  - [ ] Filters work correctly
  - [ ] Pagination works
  - [ ] Sorting works
- [ ] Test product detail endpoint
  - [ ] Returns product with variants
  - [ ] Returns 404 for invalid slug
  - [ ] Includes media and categories
- [ ] Test cart operations
  - [ ] Add item increases quantity
  - [ ] Update item changes quantity
  - [ ] Remove item deletes record
  - [ ] Merge cart combines items
- [ ] Test order creation
  - [ ] Creates order from cart
  - [ ] Reserves inventory
  - [ ] Sends confirmation email
  - [ ] Returns payment intent
- [ ] Test admin endpoints
  - [ ] Unauthorized returns 403
  - [ ] RBAC enforcement works
  - [ ] Audit logs created

#### 9.3 Average/Error/Recovery Tests

- [ ] **Average Tests** (`tests/average/api-average.test.ts`)
  - [ ] Login → Browse catalog → Add to cart → Checkout flow
  - [ ] Verify response times < 250ms (P95)
  - [ ] Verify all responses in Q2 format
- [ ] **Error Tests**
  - [ ] 409 Conflict - Insufficient stock
  - [ ] 412 Precondition Failed - Price mismatch
  - [ ] 422 Validation Error - Invalid input
  - [ ] 429 Rate Limit - Too many requests
  - [ ] 500 Server Error - Database error
- [ ] **Recovery Tests**
  - [ ] Payment failure → Order rollback → Inventory restored
  - [ ] Cart merge conflict → Quantity sum → Stock validation
  - [ ] Order cancellation → Refund initiated → Inventory released

#### 9.4 Contract Tests

- [ ] Install `jest-openapi` package
- [ ] Test all responses against OpenAPI spec
- [ ] Validate request schemas
- [ ] Validate response schemas
- [ ] Test error responses format

---

### 10. Operational Readiness (15 items)

#### 10.1 Monitoring & Observability

- [ ] Add Prometheus metrics
  - [ ] `http_requests_total{route}`
  - [ ] `http_request_duration_seconds`
  - [ ] `cart_operations_total{operation}`
  - [ ] `order_created_total`
- [ ] Configure Sentry for error tracking
- [ ] Add transaction tracing for orders
- [ ] Log slow queries (> 100ms)

#### 10.2 API Versioning Strategy

- [ ] Document versioning approach (`/api/v1`, `/api/v2`)
- [ ] Create deprecation policy
- [ ] Add `X-API-Version` header
- [ ] Plan for backward compatibility

#### 10.3 Runbook Documentation

- [ ] Create `docs/backend/api-runbook.md`
  - [ ] Document rate limit changes procedure
  - [ ] Document feature flag rollout
  - [ ] Document emergency procedures
- [ ] Document incident response
  - [ ] Failed payment handling
  - [ ] Inventory mismatch resolution
  - [ ] Fraud detection alerts
- [ ] Create API changelog

#### 10.4 Production Deployment

- [ ] Configure production environment variables
- [ ] Set up API gateway/load balancer
- [ ] Configure CORS for production domains
- [ ] Enable production rate limits
- [ ] Set up log aggregation
- [ ] Configure automated backups

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Run all tests
pnpm --filter @lumi/backend test

# Run specific test suites
pnpm --filter @lumi/backend test catalog
pnpm --filter @lumi/backend test cart
pnpm --filter @lumi/backend test order

# Run integration tests
pnpm --filter @lumi/backend test:integration

# Run average test suite
pnpm --filter @lumi/backend test:average

# Check test coverage (must be ≥85%)
pnpm --filter @lumi/backend test:coverage
```

### Performance Validation

```typescript
// Product listing performance test
const start = Date.now();
const response = await request(app).get("/api/v1/products?page=1&perPage=24");
const duration = Date.now() - start;
expect(duration).toBeLessThan(250); // P1: < 250ms P95

// Order creation performance test
const orderStart = Date.now();
const orderResponse = await request(app).post("/api/v1/orders").send(orderData);
const orderDuration = Date.now() - orderStart;
expect(orderDuration).toBeLessThan(500); // < 500ms for complex operation
```

### Security Validation

```typescript
// S2: Input sanitization test
const maliciousInput = {
  title: "<script>alert('xss')</script>Product",
  description: "<img src=x onerror=alert('xss')>"
};
const response = await request(app)
  .post('/api/v1/admin/products')
  .send(maliciousInput);
expect(response.body.data.title).not.toContain('<script>');

// S3: RBAC enforcement test
const response = await request(app)
  .get('/api/v1/admin/products')
  .set('Authorization', 'Bearer customer-token');
expect(response.status).toBe(403); // Forbidden

// S3: Audit log test
const adminAction = await request(app)
  .delete('/api/v1/admin/products/123')
  .set('Authorization', 'Bearer admin-token');
const auditLog = await prisma.auditLog.findFirst({
  where: { action: 'product.delete', resourceId: '123' }
});
expect(auditLog).toBeDefined();
```

### Q2 Format Validation

```typescript
// Success response format test
const response = await request(app).get("/api/v1/products");
expect(response.body).toMatchObject({
  success: true,
  data: expect.any(Array),
  meta: {
    timestamp: expect.any(String),
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    pagination: {
      page: expect.any(Number),
      perPage: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    },
  },
});

// Error response format test
const errorResponse = await request(app).post("/api/v1/cart/items").send({ invalidData: true });
expect(errorResponse.body).toMatchObject({
  success: false,
  error: {
    code: expect.any(String),
    message: expect.any(String),
    details: expect.any(Array),
  },
  meta: expect.any(Object),
});
```

### OpenAPI Contract Validation

```bash
# Install jest-openapi
pnpm add -D jest-openapi

# Run contract tests
pnpm --filter @lumi/backend test:contract
```

```typescript
import jestOpenAPI from "jest-openapi";

import openApiSpec from "@lumi/shared/api-schemas/openapi.yaml";

jestOpenAPI(openApiSpec);

test("Product listing matches OpenAPI spec", async () => {
  const response = await request(app).get("/api/v1/products");
  expect(response).toSatisfyApiSpec();
});
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics

- ✅ Test coverage ≥85% (all modules)
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ 100% Zod schema validation coverage
- ✅ 100% endpoint documentation coverage

### Performance Metrics

- ✅ Product queries < 100ms (P95)
- ✅ Order queries < 150ms (P95)
- ✅ Cart operations < 50ms (P95)
- ✅ API response time < 250ms (P95)
- ✅ Cache hit rate > 70% for product listings

### Security Metrics

- ✅ 100% admin endpoints protected (S3)
- ✅ 100% inputs sanitized (S2)
- ✅ Rate limiting active on all endpoints
- ✅ All admin actions logged
- ✅ 0 high/critical security vulnerabilities

### API Quality Metrics

- ✅ 100% endpoints return Q2 format
- ✅ OpenAPI spec 100% coverage
- ✅ Postman collection with all endpoints
- ✅ All endpoints documented with examples
- ✅ All error scenarios tested

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Inconsistent Response Formats

❌ **Wrong:**

```typescript
// Different endpoints returning different formats
return res.json({ products: [...] }); // No standard format
return res.json({ success: true, items: [...] }); // Inconsistent naming
```

✅ **Correct:**

```typescript
// Always use Q2 format helper
return formatSuccess(res, products, { pagination });
```

### 2. Missing Input Validation

❌ **Wrong:**

```typescript
// Direct database access without validation
const product = await prisma.product.create({ data: req.body });
```

✅ **Correct:**

```typescript
// Validate with Zod schema first (S2)
const validated = ProductCreateSchema.parse(req.body);
const sanitized = sanitizeInput(validated);
const product = await prisma.product.create({ data: sanitized });
```

### 3. N+1 Query Problems

❌ **Wrong:**

```typescript
// Fetches products, then variants separately for each
const products = await prisma.product.findMany();
for (const product of products) {
  product.variants = await prisma.productVariant.findMany({
    where: { productId: product.id },
  });
}
```

✅ **Correct:**

```typescript
// Eager load with include
const products = await prisma.product.findMany({
  include: { variants: true },
});
```

### 4. Missing RBAC Protection

❌ **Wrong:**

```typescript
// Admin endpoint without protection
router.get("/admin/users", getUsers);
```

✅ **Correct:**

```typescript
// Protected with RBAC middleware (S3)
router.get("/admin/users", requireAuth, requireRole("admin"), getUsers);
```

### 5. No Rate Limiting

❌ **Wrong:**

```typescript
// Endpoint with no rate limiting
router.post("/cart/items", addCartItem);
```

✅ **Correct:**

```typescript
// Rate limited endpoint
router.post("/cart/items", rateLimiter({ max: 120, window: "5m" }), addCartItem);
```

### 6. Missing Audit Logging

❌ **Wrong:**

```typescript
// Admin action with no logging
await prisma.product.delete({ where: { id } });
```

✅ **Correct:**

```typescript
// Log admin action (S3)
await prisma.product.delete({ where: { id } });
await auditLog.create({
  userId: req.user.id,
  action: "product.delete",
  resourceId: id,
  ipAddress: req.ip,
});
```

### 7. Hardcoded Pagination

❌ **Wrong:**

```typescript
// Hardcoded page size, no flexibility
const products = await prisma.product.findMany({ take: 20 });
```

✅ **Correct:**

```typescript
// Use pagination helper (P2)
const { page, perPage } = parsePagination(req.query);
const products = await prisma.product.findMany({
  skip: (page - 1) * perPage,
  take: perPage,
});
```

### 8. Missing Transaction for Order Creation

❌ **Wrong:**

```typescript
// No transaction, can fail mid-process
const order = await prisma.order.create({ data });
await reserveInventory(order.items);
await createPayment(order);
```

✅ **Correct:**

```typescript
// Atomic transaction
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data });
  await reserveInventory(tx, order.items);
  await createPayment(tx, order);
});
```

---

## 📦 DELIVERABLES

### 1. API Implementation

- ✅ All endpoints implemented and tested
- ✅ Q2 format responses on all endpoints
- ✅ RBAC protection on admin endpoints
- ✅ Input validation and sanitization
- ✅ Rate limiting configured
- ✅ Error handling with proper status codes

### 2. Documentation

- ✅ OpenAPI 3.1 specification (`openapi.yaml`)
- ✅ Swagger UI served at `/api/docs`
- ✅ API documentation files (catalog.md, cart.md, order.md, user.md)
- ✅ Postman collection with all endpoints
- ✅ API runbook (`docs/backend/api-runbook.md`)
- ✅ API changelog

### 3. Testing

- ✅ Unit tests for all services (≥85% coverage)
- ✅ Integration tests for all endpoints
- ✅ Average/Error/Recovery test suite
- ✅ Contract tests with jest-openapi
- ✅ Performance tests validating P1/P2

### 4. Infrastructure

- ✅ Database indexes for performance (P1)
- ✅ Redis caching configured (P2)
- ✅ Rate limiting middleware
- ✅ Audit logging system
- ✅ Monitoring metrics (Prometheus)
- ✅ Error tracking (Sentry)

### 5. Security

- ✅ Input sanitization on all endpoints (S2)
- ✅ RBAC enforcement (S3)
- ✅ Audit logging for admin actions (S3)
- ✅ Rate limiting configured
- ✅ CSRF protection for state changes

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 4: Core APIs - Completion Report

## Implementation Summary

- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items

- [x] Total Items: 218/218 (100%)
- [x] Catalog API: 32/32 endpoints
- [x] Cart API: 28/28 endpoints
- [x] Order API: 35/35 endpoints
- [x] User API: 24/24 endpoints
- [x] Tests: 30/30 test suites
- [x] Documentation: 16/16 items

## Metrics Achieved

- **Test Coverage**: X% (Target: ≥85%)
- **API Response Time**: Xms P95 (Target: <250ms)
- **OpenAPI Coverage**: 100%
- **Security Compliance**: S2 ✅, S3 ✅
- **Performance**: P1 ✅, P2 ✅

## Known Issues

- [List any known issues or technical debt]

## Next Phase Preparation

- Phase 5 dependencies ready: ✅
- Documentation complete: ✅
- Production deployment checklist: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 5: Cloudinary Media System**

- Cloudinary integration for image management
- WebP conversion and optimization (P2)
- Multiple size variants and transformations
- Upload API with security validation
- Frontend media components

**Dependencies from Phase 4:**

- Product model with media relations ✅
- User model for upload permissions ✅
- Admin endpoints for media management ✅
- Q2 format response helpers ✅

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue: Rate limit too restrictive**

- Solution: Adjust `rateLimiter` config in middleware

**Issue: Slow product queries**

- Solution: Check index usage with `EXPLAIN ANALYZE`, add caching

**Issue: Cart merge conflicts**

- Solution: Review merge logic, ensure atomic updates

**Issue: Order creation fails**

- Solution: Check inventory reservation, review transaction logs

### Debug Commands

```bash
# Check database indexes
pnpm prisma db execute --sql "SELECT * FROM pg_indexes WHERE tablename = 'Product';"

# Monitor Redis cache
redis-cli MONITOR

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/api/v1/products

# View audit logs
psma --filter @lumi/backend prisma studio
```

---

**END OF PHASE 4 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-10-01_
