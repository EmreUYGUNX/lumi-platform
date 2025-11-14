# PHASE 9: ADMIN DASHBOARD & ANALYTICS

**Status**: 🔄 In Progress
**Priority**: 🔴 High
**Dependencies**: Phase 1 (Express Server), Phase 2 (Database & Prisma), Phase 3 (Authentication & RBAC), Phase 4 (Core APIs), Phase 5 (Cloudinary Media), Phase 6 (Next.js Foundation), Phase 7 (Auth Orchestration), Phase 8 (E-commerce Interface)
**Estimated Time**: 7-10 days

---

## 📋 DOCUMENT OVERVIEW

This phase implements a comprehensive admin dashboard with real-time analytics, product/order/user management, and advanced reporting capabilities. The dashboard provides complete administrative control over the e-commerce platform with role-based access control, data visualization, and operational tools.

**Key Components**:

- Real-time analytics dashboard with sales metrics, visitor tracking, and conversion rates
- Product management with CRUD operations, bulk actions, inventory tracking
- Order management with status tracking, fulfillment workflow, shipping integration
- User management with role assignment, activity logs, customer insights
- Advanced reporting with data export, scheduled reports, custom queries
- System monitoring with performance metrics, error tracking, audit logs

**Technical Stack**:

- Next.js 14 App Router (admin interface)
- TanStack Query + Zustand (state management)
- Recharts + Chart.js (data visualization)
- shadcn/ui + Tailwind CSS (design system)
- React Hook Form + Zod (form validation)
- date-fns (date manipulation)
- react-table (data tables)
- Express.js APIs (backend)

**Security Standards**:

- **S3**: All admin routes protected with RBAC (admin, manager roles only)
- **S2**: Input sanitization on all forms
- **S4**: API keys and credentials in environment variables only
- **Q1**: TypeScript strict mode, 0 errors

**Performance Standards**:

- **P1**: Database queries optimized with indexes, pagination, caching
- **P2**: Dashboard loads in <2.5s, charts render in <800ms
- Dashboard bundle <220KB gzipped
- Real-time updates via Server-Sent Events (SSE) or polling

**Quality Standards**:

- **Q2**: All API responses follow standard format `{success, data|error, meta}`
- **Q3**: Timestamps consistent across dashboard
- ≥85% backend test coverage
- ≥80% frontend test coverage

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Admin Dashboard Foundation**: Create secure, role-protected admin interface with navigation, layout, authentication guard
2. **Analytics & Reporting**: Implement real-time sales analytics, visitor tracking, conversion metrics, revenue reports
3. **Product Management**: Build comprehensive product CRUD interface with bulk operations, image upload, inventory management
4. **Order Management**: Create order tracking, status updates, fulfillment workflow, shipping integration
5. **User Management**: Implement user list, search, role management, activity logs, customer insights
6. **Data Visualization**: Integrate charts for sales trends, top products, customer demographics
7. **System Monitoring**: Add performance metrics, error tracking, audit logs for admin actions

### Success Criteria

- [ ] Admin dashboard accessible only to authenticated admin/manager users (S3)
- [ ] Real-time analytics display sales, orders, revenue with <500ms update latency
- [ ] Product management supports CRUD operations with Cloudinary image integration
- [ ] Order management displays all orders with filtering, sorting, status updates
- [ ] User management shows all users with role assignment and activity logs
- [ ] Dashboard loads in <2.5s, charts render in <800ms (P2)
- [ ] All forms validated with React Hook Form + Zod (Q1)
- [ ] Mobile-responsive design (768px - 1920px)
- [ ] Comprehensive test coverage (≥85% backend, ≥80% frontend)

---

## 🎯 CRITICAL REQUIREMENTS

### Security Requirements (MANDATORY)

**S3: RBAC Protection**

```typescript
// ❌ WRONG: No role check
export default function AdminDashboard() {
  return <div>Admin Content</div>;
}

// ✅ CORRECT: RBAC middleware protection
// middleware.ts
export function middleware(request: NextRequest) {
  const session = await getServerSession();

  if (!session || !['admin', 'manager'].includes(session.user.role)) {
    return NextResponse.redirect(new URL('/403', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*'
};

// app/admin/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await getServerSession();

  if (!session || !['admin', 'manager'].includes(session.user.role)) {
    redirect('/403');
  }

  return <AdminShell>{children}</AdminShell>;
}
```

**S2: Input Sanitization**

```typescript
// ❌ WRONG: No validation
const updateProduct = async (data: any) => {
  await prisma.product.update({ where: { id: data.id }, data });
};

// ✅ CORRECT: Zod validation + sanitization
import { z } from 'zod';
import validator from 'validator';

const ProductUpdateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(3).max(255).transform(str => validator.escape(str)),
  description: z.string().max(5000).transform(str => validator.escape(str)),
  price: z.number().positive().max(999999.99),
  stock: z.number().int().nonnegative(),
  categoryId: z.string().cuid(),
  tags: z.array(z.string().max(50)).max(20)
});

const updateProduct = async (req: Request, res: Response) => {
  const validated = ProductUpdateSchema.parse(req.body);

  const product = await prisma.product.update({
    where: { id: validated.id },
    data: validated
  });

  res.json({ success: true, data: product, meta: { timestamp: new Date().toISOString() } });
};
```

**S4: No Hardcoded Secrets**

```typescript
// ❌ WRONG: Hardcoded credentials
const ADMIN_API_KEY = "sk_live_abc123";

// ✅ CORRECT: Environment variables
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_API_KEY) throw new Error("ADMIN_API_KEY not configured");
```

### Performance Requirements (MANDATORY)

**P1: Query Optimization**

```typescript
// ❌ WRONG: N+1 query, no pagination
const orders = await prisma.order.findMany();
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}

// ✅ CORRECT: Single query with includes, pagination, caching
const orders = await prisma.order.findMany({
  where: { status: status || undefined },
  include: {
    items: { include: { product: { select: { name: true, images: true } } } },
    user: { select: { name: true, email: true } }
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * perPage,
  take: perPage
});

// Cache analytics queries
const cacheKey = `analytics:${period}:${startDate}:${endDate}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const analytics = await calculateAnalytics(period, startDate, endDate);
await redis.set(cacheKey, JSON.stringify(analytics), 'EX', 300); // 5min cache
```

**P2: Dashboard Performance**

```typescript
// ✅ CORRECT: Code splitting, lazy loading
const ProductManagement = lazy(() => import("./ProductManagement"));
const OrderManagement = lazy(() => import("./OrderManagement"));
const Analytics = lazy(() => import("./Analytics"));

// Prefetch critical data
export async function getServerSideProps() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery(["dashboard-stats"], fetchDashboardStats);
  await queryClient.prefetchQuery(["recent-orders"], () => fetchRecentOrders(1, 5));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
}
```

### Quality Requirements (MANDATORY)

**Q2: Standard API Format**

```typescript
// ❌ WRONG: Inconsistent format
res.json({ orders: data });

// ✅ CORRECT: Standard format
res.json({
  success: true,
  data: {
    orders: data,
    summary: { total: 156, pending: 23, shipped: 102, delivered: 31 },
  },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    pagination: {
      page: 1,
      perPage: 20,
      total: 156,
      totalPages: 8,
    },
  },
});
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
lumi-platform/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── analytics.routes.ts      # Analytics API
│   │   │   │   │   ├── products.routes.ts       # Product management API
│   │   │   │   │   ├── orders.routes.ts         # Order management API
│   │   │   │   │   ├── users.routes.ts          # User management API
│   │   │   │   │   ├── reports.routes.ts        # Reporting API
│   │   │   │   │   └── system.routes.ts         # System monitoring API
│   │   │   ├── services/
│   │   │   │   ├── analytics.service.ts         # Analytics calculations
│   │   │   │   ├── reports.service.ts           # Report generation
│   │   │   │   └── audit.service.ts             # Audit logging
│   │   │   ├── middleware/
│   │   │   │   ├── admin.middleware.ts          # Admin RBAC check
│   │   │   │   └── audit.middleware.ts          # Action logging
│   │   │   └── utils/
│   │   │       ├── export.utils.ts              # CSV/Excel export
│   │   │       └── date.utils.ts                # Date range helpers
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── layout.tsx               # Admin layout with nav
│   │   │   │   │   ├── page.tsx                 # Dashboard home
│   │   │   │   │   ├── analytics/
│   │   │   │   │   │   └── page.tsx             # Analytics dashboard
│   │   │   │   │   ├── products/
│   │   │   │   │   │   ├── page.tsx             # Product list
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx         # Product edit
│   │   │   │   │   │   └── new/
│   │   │   │   │   │       └── page.tsx         # Product create
│   │   │   │   │   ├── orders/
│   │   │   │   │   │   ├── page.tsx             # Order list
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx         # Order detail
│   │   │   │   │   ├── users/
│   │   │   │   │   │   ├── page.tsx             # User list
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx         # User detail
│   │   │   │   │   ├── reports/
│   │   │   │   │   │   └── page.tsx             # Reports dashboard
│   │   │   │   │   └── settings/
│   │   │   │   │       └── page.tsx             # System settings
│   │   │   │   └── middleware.ts                # Route protection
│   │   │   ├── components/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── AdminShell.tsx           # Admin layout wrapper
│   │   │   │   │   ├── Sidebar.tsx              # Navigation sidebar
│   │   │   │   │   ├── TopBar.tsx               # Top navigation
│   │   │   │   │   ├── DashboardStats.tsx       # Key metrics cards
│   │   │   │   │   ├── charts/
│   │   │   │   │   │   ├── SalesChart.tsx       # Sales trend chart
│   │   │   │   │   │   ├── OrdersChart.tsx      # Orders chart
│   │   │   │   │   │   ├── RevenueChart.tsx     # Revenue chart
│   │   │   │   │   │   └── TopProductsChart.tsx # Top products
│   │   │   │   │   ├── tables/
│   │   │   │   │   │   ├── ProductsTable.tsx    # Product data table
│   │   │   │   │   │   ├── OrdersTable.tsx      # Order data table
│   │   │   │   │   │   └── UsersTable.tsx       # User data table
│   │   │   │   │   ├── forms/
│   │   │   │   │   │   ├── ProductForm.tsx      # Product create/edit
│   │   │   │   │   │   ├── OrderStatusForm.tsx  # Order status update
│   │   │   │   │   │   └── UserRoleForm.tsx     # User role update
│   │   │   │   │   └── modals/
│   │   │   │   │       ├── BulkActionsModal.tsx # Bulk operations
│   │   │   │   │       └── ExportModal.tsx      # Data export
│   │   │   ├── hooks/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── useAnalytics.ts          # Analytics data hook
│   │   │   │   │   ├── useProducts.ts           # Product management hook
│   │   │   │   │   ├── useOrders.ts             # Order management hook
│   │   │   │   │   ├── useUsers.ts              # User management hook
│   │   │   │   │   └── useReports.ts            # Reports hook
│   │   │   └── lib/
│   │   │       ├── admin-api.ts                 # Admin API client
│   │   │       └── export.ts                    # Export utilities
```

### Data Flow Architecture

**Admin Dashboard Analytics**:

```
User Request → Next.js Admin Page (SSR) → TanStack Query
                                              ↓
Backend API ← Admin Middleware (RBAC) ← Express Route
    ↓
Analytics Service → Prisma Queries (aggregations, joins)
    ↓
Redis Cache (5min TTL for analytics)
    ↓
Response → Q2 Format → Frontend Charts (Recharts)
```

**Product Management Flow**:

```
Admin Form → React Hook Form + Zod Validation
                ↓
            TanStack Query Mutation
                ↓
Backend API ← S2 Validation ← Prisma Update/Create
    ↓
Cloudinary Image Upload (from Phase 5)
    ↓
Database Update → Cache Invalidation
    ↓
Optimistic UI Update → Success Toast
```

**Real-time Order Updates**:

```
Order Status Change → Backend API → Database Update
                                         ↓
                                    Audit Log Service
                                         ↓
                                    SSE Broadcast / Polling
                                         ↓
                                    Frontend Update
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: Admin Analytics API (26 items)

#### 1.1 Analytics Service (12 items)

- [ ] Create `src/services/analytics.service.ts` with analytics calculations
- [ ] Implement `calculateDashboardStats()`: total sales, orders, revenue, users
- [ ] Implement `getSalesAnalytics(period, startDate, endDate)`: daily/weekly/monthly sales
- [ ] Implement `getOrderAnalytics()`: order status breakdown, average order value
- [ ] Implement `getRevenueAnalytics()`: revenue by category, top products, trends
- [ ] Implement `getCustomerAnalytics()`: new customers, retention rate, LTV
- [ ] Implement `getProductPerformance()`: top selling, low stock, trending
- [ ] Implement `getConversionMetrics()`: cart abandonment, checkout completion
- [ ] Add date range helpers: today, yesterday, last 7 days, last 30 days, custom
- [ ] Add Redis caching for analytics queries (5min TTL)
- [ ] Add aggregation queries with Prisma `groupBy` and `aggregate`
- [ ] Add error handling for invalid date ranges

#### 1.2 Analytics Routes (8 items)

- [ ] Create `src/routes/admin/analytics.routes.ts`
- [ ] Add `GET /api/admin/analytics/dashboard`: overall stats for dashboard home
- [ ] Add `GET /api/admin/analytics/sales?period=7d&start=&end=`: sales trends
- [ ] Add `GET /api/admin/analytics/orders`: order status breakdown
- [ ] Add `GET /api/admin/analytics/revenue`: revenue analytics
- [ ] Add `GET /api/admin/analytics/customers`: customer metrics
- [ ] Add `GET /api/admin/analytics/products`: product performance
- [ ] Add `GET /api/admin/analytics/conversion`: conversion funnel metrics

#### 1.3 Validation & Security (6 items)

- [ ] Add admin middleware to all analytics routes (S3)
- [ ] Validate date range parameters with Zod schemas
- [ ] Add rate limiting: 100 req/15min per admin user
- [ ] Add query parameter sanitization (S2)
- [ ] Return Q2 standard format for all responses
- [ ] Add audit logging for analytics access

**Example**:

```typescript
// src/services/analytics.service.ts
import prisma from '../config/database';
import redis from '../config/redis';
import { startOfDay, subDays, format } from 'date-fns';

export const calculateDashboardStats = async () => {
  const cacheKey = 'analytics:dashboard:stats';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);

  const [totalOrders, totalRevenue, totalUsers, totalProducts] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.product.count({ where: { isActive: true } })
  ]);

  const todayOrders = await prisma.order.count({
    where: { createdAt: { gte: today } }
  });

  const yesterdayOrders = await prisma.order.count({
    where: { createdAt: { gte: yesterday, lt: today } }
  });

  const stats = {
    totalOrders,
    totalRevenue: totalRevenue._sum.total || 0,
    totalUsers,
    totalProducts,
    todayOrders,
    ordersTrend: todayOrders - yesterdayOrders
  };

  await redis.set(cacheKey, JSON.stringify(stats), 'EX', 300); // 5min cache
  return stats;
};

export const getSalesAnalytics = async (period: string, startDate: Date, endDate: Date) => {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['confirmed', 'shipped', 'delivered'] }
    },
    select: {
      createdAt: true,
      total: true
    }
  });

  // Group by day
  const salesByDay = orders.reduce((acc, order) => {
    const day = format(order.createdAt, 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = { date: day, revenue: 0, orders: 0 };
    acc[day].revenue += order.total;
    acc[day].orders += 1;
    return acc;
  }, {} as Record<string, { date: string; revenue: number; orders: number }>);

  return Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));
};

// src/routes/admin/analytics.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { adminMiddleware } from '../../middleware/admin.middleware';
import * as analyticsService from '../../services/analytics.service';
import { subDays } from 'date-fns';

const router = Router();

const DateRangeSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'custom']).optional().default('7d'),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional()
});

router.get('/dashboard', adminMiddleware, async (req, res) => {
  const stats = await analyticsService.calculateDashboardStats();

  res.json({
    success: true,
    data: stats,
    meta: { timestamp: new Date().toISOString(), requestId: req.id }
  });
});

router.get('/sales', adminMiddleware, async (req, res) => {
  const validated = DateRangeSchema.parse(req.query);

  let startDate: Date;
  let endDate: Date = new Date();

  if (validated.period === 'custom') {
    if (!validated.start || !validated.end) {
      return res.status(400).json({ success: false, error: 'Custom period requires start and end dates' });
    }
    startDate = new Date(validated.start);
    endDate = new Date(validated.end);
  } else {
    const days = parseInt(validated.period);
    startDate = subDays(endDate, days);
  }

  const sales = await analyticsService.getSalesAnalytics(validated.period, startDate, endDate);

  res.json({
    success: true,
    data: { sales, period: validated.period, startDate, endDate },
    meta: { timestamp: new Date().toISOString(), requestId: req.id }
  });
});

export default router;
```

---

### 2. Backend: Product Management API (28 items)

#### 2.1 Product CRUD Routes (12 items)

- [ ] Create `src/routes/admin/products.routes.ts`
- [ ] Add `GET /api/admin/products?page=1&perPage=20&search=&category=&status=`: paginated list
- [ ] Add `GET /api/admin/products/:id`: single product detail
- [ ] Add `POST /api/admin/products`: create new product with Cloudinary integration
- [ ] Add `PUT /api/admin/products/:id`: update product
- [ ] Add `DELETE /api/admin/products/:id`: soft delete product
- [ ] Add `POST /api/admin/products/bulk-delete`: bulk soft delete
- [ ] Add `POST /api/admin/products/bulk-update`: bulk status/category update
- [ ] Add `GET /api/admin/products/low-stock?threshold=10`: low stock alerts
- [ ] Add `POST /api/admin/products/:id/duplicate`: duplicate product
- [ ] Add `POST /api/admin/products/:id/images`: add additional images
- [ ] Add `DELETE /api/admin/products/:id/images/:imageId`: remove image

#### 2.2 Inventory Management (8 items)

- [ ] Add `GET /api/admin/inventory`: inventory summary
- [ ] Add `PUT /api/admin/products/:id/stock`: update stock quantity
- [ ] Add `POST /api/admin/products/:id/stock/history`: stock movement log
- [ ] Add stock validation: prevent negative stock
- [ ] Add low stock notifications when threshold crossed
- [ ] Add stock reservation tracking (orders pending payment)
- [ ] Add bulk stock import from CSV
- [ ] Add inventory audit log

#### 2.3 Validation & Security (8 items)

- [ ] Add admin middleware to all product routes (S3)
- [ ] Create ProductCreateSchema with Zod validation (S2)
- [ ] Create ProductUpdateSchema with Zod validation (S2)
- [ ] Validate price: positive, max 999999.99
- [ ] Validate stock: non-negative integer
- [ ] Validate images: max 10 images per product
- [ ] Add audit logging for product create/update/delete
- [ ] Return Q2 standard format for all responses

**Example**:

```typescript
// src/routes/admin/products.routes.ts
import { Router } from "express";
import validator from "validator";
import { z } from "zod";

import prisma from "../../config/database";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { auditLog } from "../../services/audit.service";

const router = Router();

const ProductCreateSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(255)
    .transform((str) => validator.escape(str)),
  description: z
    .string()
    .max(5000)
    .transform((str) => validator.escape(str)),
  price: z.number().positive().max(999999.99),
  compareAtPrice: z.number().positive().max(999999.99).optional(),
  cost: z.number().nonnegative().max(999999.99).optional(),
  stock: z.number().int().nonnegative(),
  sku: z.string().max(100).optional(),
  categoryId: z.string().cuid(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string(),
        width: z.number().positive(),
        height: z.number().positive(),
        format: z.string(),
      }),
    )
    .min(1)
    .max(10),
  variants: z
    .array(
      z.object({
        name: z.string().max(100),
        value: z.string().max(100),
        priceAdjustment: z.number().default(0),
        stockAdjustment: z.number().int().default(0),
      }),
    )
    .optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

router.get("/", adminMiddleware, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const search = req.query.search as string;
  const categoryId = req.query.category as string;
  const status = req.query.status as string;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "low-stock") where.stock = { lte: 10 };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        _count: { select: { orderItems: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    success: true,
    data: { products },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    },
  });
});

router.post("/", adminMiddleware, async (req, res) => {
  const validated = ProductCreateSchema.parse(req.body);

  const product = await prisma.product.create({
    data: {
      ...validated,
      images: { create: validated.images },
      variants: validated.variants ? { create: validated.variants } : undefined,
    },
    include: { category: true, images: true, variants: true },
  });

  await auditLog("product.create", req.user.id, { productId: product.id });

  res.status(201).json({
    success: true,
    data: { product },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

router.post("/bulk-delete", adminMiddleware, async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().cuid()).min(1) }).parse(req.body);

  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false, deletedAt: new Date() },
  });

  await auditLog("product.bulk-delete", req.user.id, { count: result.count, ids });

  res.json({
    success: true,
    data: { deletedCount: result.count },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

export default router;
```

---

### 3. Backend: Order Management API (32 items)

#### 3.1 Order List & Detail Routes (10 items)

- [ ] Create `src/routes/admin/orders.routes.ts`
- [ ] Add `GET /api/admin/orders?page=1&perPage=20&status=&search=&dateFrom=&dateTo=`: paginated list
- [ ] Add `GET /api/admin/orders/:id`: single order detail with items, user, shipping
- [ ] Add advanced filtering: status, date range, payment method, customer
- [ ] Add sorting: newest, oldest, highest value, lowest value
- [ ] Add search: order number, customer name, customer email
- [ ] Include order items with product details
- [ ] Include customer information with order history count
- [ ] Include payment and shipping information
- [ ] Add Q2 format with pagination metadata

#### 3.2 Order Status Management (12 items)

- [ ] Add `PUT /api/admin/orders/:id/status`: update order status
- [ ] Implement status workflow: pending → confirmed → processing → shipped → delivered
- [ ] Add `POST /api/admin/orders/:id/cancel`: cancel order with reason
- [ ] Add `POST /api/admin/orders/:id/refund`: process refund
- [ ] Add status change validation (prevent invalid transitions)
- [ ] Add inventory updates on status change (restore stock on cancel)
- [ ] Add email notifications on status change (confirmed, shipped, delivered)
- [ ] Add `PUT /api/admin/orders/:id/shipping`: update shipping info (tracking number, carrier)
- [ ] Add `POST /api/admin/orders/:id/notes`: add internal notes
- [ ] Add order timeline tracking (status history with timestamps)
- [ ] Add bulk status update for multiple orders
- [ ] Add order export to CSV

#### 3.3 Order Analytics (10 items)

- [ ] Add `GET /api/admin/orders/stats`: order statistics (total, pending, shipped, etc.)
- [ ] Add `GET /api/admin/orders/recent`: recent orders for dashboard
- [ ] Calculate average order value (AOV)
- [ ] Calculate order fulfillment time (avg time from order to delivery)
- [ ] Track orders by status percentage
- [ ] Track orders by payment method
- [ ] Track top customers by order count and value
- [ ] Add audit logging for all order updates (S3)
- [ ] Add rate limiting: 200 req/15min per admin
- [ ] Return Q2 standard format for all responses

**Example**:

```typescript
// src/routes/admin/orders.routes.ts
import { Router } from "express";
import { z } from "zod";

import prisma from "../../config/database";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { auditLog } from "../../services/audit.service";
import { sendOrderStatusEmail } from "../../services/email.service";

const router = Router();

const OrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
  notes: z.string().max(500).optional(),
});

const OrderShippingSchema = z.object({
  trackingNumber: z.string().max(100),
  carrier: z.string().max(100),
  estimatedDelivery: z.string().datetime().optional(),
});

router.get("/", adminMiddleware, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const status = req.query.status as string;
  const search = req.query.search as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        items: {
          include: {
            product: { select: { name: true, images: true } },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    success: true,
    data: { orders },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    },
  });
});

router.get("/:id", adminMiddleware, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          _count: { select: { orders: true } },
        },
      },
      items: {
        include: {
          product: { select: { name: true, images: true, sku: true } },
        },
      },
      shippingAddress: true,
      billingAddress: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  res.json({
    success: true,
    data: { order },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

router.put("/:id/status", adminMiddleware, async (req, res) => {
  const validated = OrderStatusSchema.parse(req.body);

  const order = await prisma.$transaction(async (tx) => {
    // Update order status
    const updated = await tx.order.update({
      where: { id: req.params.id },
      data: { status: validated.status },
      include: { user: true, items: { include: { product: true } } },
    });

    // Add to status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: updated.id,
        status: validated.status,
        notes: validated.notes,
        changedBy: req.user.id,
      },
    });

    // If cancelled, restore inventory
    if (validated.status === "cancelled") {
      for (const item of updated.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return updated;
  });

  // Send email notification
  await sendOrderStatusEmail(order.user.email, order.orderNumber, validated.status);

  await auditLog("order.status-update", req.user.id, {
    orderId: order.id,
    oldStatus: order.status,
    newStatus: validated.status,
  });

  res.json({
    success: true,
    data: { order },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

router.put("/:id/shipping", adminMiddleware, async (req, res) => {
  const validated = OrderShippingSchema.parse(req.body);

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      trackingNumber: validated.trackingNumber,
      carrier: validated.carrier,
      estimatedDelivery: validated.estimatedDelivery
        ? new Date(validated.estimatedDelivery)
        : undefined,
      status: "shipped",
    },
    include: { user: true },
  });

  await sendOrderStatusEmail(order.user.email, order.orderNumber, "shipped", {
    trackingNumber: validated.trackingNumber,
    carrier: validated.carrier,
  });

  await auditLog("order.shipping-update", req.user.id, { orderId: order.id });

  res.json({
    success: true,
    data: { order },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

export default router;
```

---

### 4. Backend: User Management API (24 items)

#### 4.1 User List & Detail (10 items)

- [ ] Create `src/routes/admin/users.routes.ts`
- [ ] Add `GET /api/admin/users?page=1&perPage=20&role=&search=&status=`: paginated list
- [ ] Add `GET /api/admin/users/:id`: single user detail
- [ ] Add filtering: role (admin, manager, customer), status (active, inactive)
- [ ] Add search: name, email
- [ ] Include user order count, total spent, last order date
- [ ] Include user activity: last login, account created date
- [ ] Add sorting: newest, oldest, highest spent, most orders
- [ ] Add Q2 format with pagination metadata
- [ ] Add admin middleware (S3) to all routes

#### 4.2 User Role Management (8 items)

- [ ] Add `PUT /api/admin/users/:id/role`: update user role (admin, manager, customer)
- [ ] Add role change validation: prevent last admin removal
- [ ] Add `PUT /api/admin/users/:id/status`: activate/deactivate user account
- [ ] Add `POST /api/admin/users/:id/password-reset`: send password reset email
- [ ] Add audit logging for role changes (S3)
- [ ] Validate role changes with Zod schema
- [ ] Return Q2 standard format
- [ ] Add email notification on role change

#### 4.3 User Activity & Analytics (6 items)

- [ ] Add `GET /api/admin/users/:id/orders`: user order history
- [ ] Add `GET /api/admin/users/:id/activity`: user activity log (logins, changes)
- [ ] Calculate user lifetime value (LTV)
- [ ] Track user registration trends (daily/weekly/monthly)
- [ ] Track user retention rate
- [ ] Add user export to CSV

**Example**:

```typescript
// src/routes/admin/users.routes.ts
import { Router } from "express";
import { z } from "zod";

import prisma from "../../config/database";
import { adminMiddleware } from "../../middleware/admin.middleware";
import { auditLog } from "../../services/audit.service";

const router = Router();

const UserRoleSchema = z.object({
  role: z.enum(["admin", "manager", "customer"]),
});

router.get("/", adminMiddleware, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const role = req.query.role as string;
  const search = req.query.search as string;
  const status = req.query.status as string;

  const where: any = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { orders: true } },
        orders: {
          select: { total: true },
          where: { status: { in: ["confirmed", "shipped", "delivered"] } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  // Calculate total spent for each user
  const usersWithStats = users.map((user) => ({
    ...user,
    totalSpent: user.orders.reduce((sum, order) => sum + order.total, 0),
    orderCount: user._count.orders,
    orders: undefined,
    _count: undefined,
  }));

  res.json({
    success: true,
    data: { users: usersWithStats },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    },
  });
});

router.put("/:id/role", adminMiddleware, async (req, res) => {
  const validated = UserRoleSchema.parse(req.body);

  // Prevent last admin removal
  if (validated.role !== "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount === 1) {
      const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (targetUser?.role === "admin") {
        return res.status(400).json({
          success: false,
          error: "Cannot change role of last admin user",
        });
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: validated.role },
    select: { id: true, name: true, email: true, role: true },
  });

  await auditLog("user.role-change", req.user.id, {
    userId: user.id,
    newRole: validated.role,
  });

  res.json({
    success: true,
    data: { user },
    meta: { timestamp: new Date().toISOString(), requestId: req.id },
  });
});

export default router;
```

---

### 5. Backend: Reports & Export API (18 items)

#### 5.1 Report Generation (10 items)

- [ ] Create `src/routes/admin/reports.routes.ts`
- [ ] Create `src/services/reports.service.ts`
- [ ] Add `GET /api/admin/reports/sales?from=&to=&format=json|csv`: sales report
- [ ] Add `GET /api/admin/reports/products?from=&to=&format=json|csv`: product performance
- [ ] Add `GET /api/admin/reports/customers?from=&to=&format=json|csv`: customer analytics
- [ ] Add `GET /api/admin/reports/inventory?format=json|csv`: current inventory status
- [ ] Implement CSV export with proper headers and formatting
- [ ] Implement Excel export with `exceljs` library
- [ ] Add report caching (10min TTL for large reports)
- [ ] Add date range validation with Zod

#### 5.2 Data Export Utilities (8 items)

- [ ] Create `src/utils/export.utils.ts`
- [ ] Implement `generateCSV(data, headers)`: CSV generation
- [ ] Implement `generateExcel(data, headers, sheetName)`: Excel generation
- [ ] Add CSV escaping for special characters
- [ ] Add streaming for large datasets (>10k rows)
- [ ] Add compression (gzip) for large files
- [ ] Add audit logging for report generation (S3)
- [ ] Return Q2 standard format with download URL

**Example**:

```typescript
// src/utils/export.utils.ts
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

export const generateCSV = (data: any[], fields: string[]) => {
  const parser = new Parser({ fields });
  return parser.parse(data);
};

export const generateExcel = async (data: any[], headers: string[], sheetName: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = headers.map(header => ({
    header,
    key: header.toLowerCase().replace(/\s+/g, '_'),
    width: 20
  }));

  worksheet.addRows(data);

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// src/routes/admin/reports.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { generateCSV, generateExcel } from '../../utils/export.utils';

const router = Router();

const ReportQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  format: z.enum(['json', 'csv', 'excel']).default('json')
});

router.get('/sales', adminMiddleware, async (req, res) => {
  const validated = ReportQuerySchema.parse(req.query);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: new Date(validated.from),
        lte: new Date(validated.to)
      },
      status: { in: ['confirmed', 'shipped', 'delivered'] }
    },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } }
    }
  });

  const reportData = orders.map(order => ({
    orderNumber: order.orderNumber,
    date: order.createdAt,
    customerName: order.user.name,
    customerEmail: order.user.email,
    total: order.total,
    status: order.status,
    itemCount: order.items.length
  }));

  if (validated.format === 'csv') {
    const csv = generateCSV(reportData, [
      'orderNumber',
      'date',
      'customerName',
      'customerEmail',
      'total',
      'status',
      'itemCount'
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
    return res.send(csv);
  }

  if (validated.format === 'excel') {
    const buffer = await generateExcel(
      reportData,
      ['Order Number', 'Date', 'Customer Name', 'Customer Email', 'Total', 'Status', 'Items'],
      'Sales Report'
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
    return res.send(buffer);
  }

  res.json({
    success: true,
    data: { orders: reportData },
    meta: { timestamp: new Date().toISOString(), requestId: req.id, count: reportData.length }
  });
});

export default router;
```

---

### 6. Backend: Audit Logging & Monitoring (16 items)

#### 6.1 Audit Service (8 items)

- [ ] Create `src/services/audit.service.ts`
- [ ] Implement `auditLog(action, userId, metadata)`: log admin actions
- [ ] Create `AuditLog` model in Prisma schema
- [ ] Log actions: product.create, product.update, product.delete, order.status-update, user.role-change
- [ ] Include IP address, user agent, timestamp
- [ ] Add `GET /api/admin/audit?page=1&perPage=50&action=&userId=&from=&to=`: audit log query
- [ ] Add audit log retention policy (90 days)
- [ ] Add audit log export to CSV

#### 6.2 System Monitoring (8 items)

- [ ] Create `src/routes/admin/system.routes.ts`
- [ ] Add `GET /api/admin/system/health`: system health check
- [ ] Add `GET /api/admin/system/metrics`: performance metrics (CPU, memory, response time)
- [ ] Add `GET /api/admin/system/errors?page=1&perPage=20&from=&to=`: error log query
- [ ] Implement error tracking middleware
- [ ] Track API response times with histogram
- [ ] Add database connection pool metrics
- [ ] Add Redis connection metrics

**Example**:

```typescript
// prisma/schema.prisma
model AuditLog {
  id        String   @id @default(cuid())
  action    String   // e.g., "product.create", "order.status-update"
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  metadata  Json     // Additional context (productId, oldStatus, newStatus, etc.)
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([action])
  @@index([userId])
  @@index([createdAt])
}

// src/services/audit.service.ts
import prisma from '../config/database';

export const auditLog = async (
  action: string,
  userId: string,
  metadata: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
) => {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      metadata,
      ipAddress,
      userAgent
    }
  });
};

// src/routes/admin/audit.routes.ts
import { Router } from 'express';
import prisma from '../../config/database';
import { adminMiddleware } from '../../middleware/admin.middleware';

const router = Router();

router.get('/', adminMiddleware, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 50;
  const action = req.query.action as string;
  const userId = req.query.userId as string;
  const from = req.query.from as string;
  const to = req.query.to as string;

  const where: any = {};
  if (action) where.action = { contains: action };
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage
    }),
    prisma.auditLog.count({ where })
  ]);

  res.json({
    success: true,
    data: { logs },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    }
  });
});

export default router;
```

---

### 7. Frontend: Admin Dashboard Shell (32 items)

#### 7.1 Admin Layout & Navigation (14 items)

- [ ] Create `src/app/admin/layout.tsx` with RBAC check
- [ ] Create `middleware.ts` with admin route protection (S3)
- [ ] Create `src/components/admin/AdminShell.tsx`: layout wrapper
- [ ] Create `src/components/admin/Sidebar.tsx`: collapsible navigation sidebar
- [ ] Add navigation items: Dashboard, Analytics, Products, Orders, Users, Reports, Settings
- [ ] Add active route highlighting
- [ ] Create `src/components/admin/TopBar.tsx`: top navigation with user menu
- [ ] Add breadcrumbs navigation
- [ ] Add notifications dropdown
- [ ] Add user profile dropdown with logout
- [ ] Add mobile responsive menu (hamburger on <768px)
- [ ] Add sidebar collapse/expand functionality
- [ ] Use B1 brand colors from deneme.html
- [ ] Add loading skeleton for dashboard

#### 7.2 Dashboard Home Page (18 items)

- [ ] Create `src/app/admin/page.tsx`: dashboard home
- [ ] Create `src/components/admin/DashboardStats.tsx`: key metrics cards
- [ ] Display total orders, total revenue, total users, total products
- [ ] Add trend indicators (up/down arrows, percentages)
- [ ] Create `src/components/admin/charts/SalesChart.tsx`: sales trend line chart
- [ ] Create `src/components/admin/charts/OrdersChart.tsx`: orders bar chart
- [ ] Create `src/components/admin/charts/RevenueChart.tsx`: revenue area chart
- [ ] Create `src/components/admin/charts/TopProductsChart.tsx`: top products bar chart
- [ ] Add date range selector: today, 7 days, 30 days, custom
- [ ] Fetch analytics data with TanStack Query
- [ ] Add real-time updates (polling every 30s or SSE)
- [ ] Add loading states for all charts
- [ ] Add empty states for no data
- [ ] Add error states with retry button
- [ ] Make charts responsive with Recharts `ResponsiveContainer`
- [ ] Add chart tooltips with formatted data
- [ ] Add chart legends
- [ ] Prefetch dashboard data on server (SSR)

**Example**:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !['admin', 'manager'].includes(token.role as string)) {
    return NextResponse.redirect(new URL('/403', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*'
};

// src/app/admin/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session || !['admin', 'manager'].includes(session.user.role)) {
    redirect('/403');
  }

  return <AdminShell>{children}</AdminShell>;
}

// src/components/admin/AdminShell.tsx
'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// src/components/admin/DashboardStats.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';

const fetchDashboardStats = async () => {
  const res = await fetch('/api/admin/analytics/dashboard');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
};

export default function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000 // Refresh every 30s
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const stats = data?.data || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Orders"
        value={stats.totalOrders}
        trend={stats.ordersTrend}
        icon="📦"
      />
      <StatCard
        title="Total Revenue"
        value={`₺${stats.totalRevenue?.toFixed(2)}`}
        trend={stats.revenueTrend}
        icon="💰"
      />
      <StatCard
        title="Total Users"
        value={stats.totalUsers}
        trend={stats.usersTrend}
        icon="👥"
      />
      <StatCard
        title="Total Products"
        value={stats.totalProducts}
        trend={stats.productsTrend}
        icon="🛍️"
      />
    </div>
  );
}

function StatCard({ title, value, trend, icon }) {
  const isPositive = trend >= 0;

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        {trend !== undefined && (
          <div className={`flex items-center text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {Math.abs(trend)}
          </div>
        )}
      </div>
      <h3 className="text-gray-600 text-sm mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// src/components/admin/charts/SalesChart.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fetchSalesData = async (period: string) => {
  const res = await fetch(`/api/admin/analytics/sales?period=${period}`);
  if (!res.ok) throw new Error('Failed to fetch sales data');
  return res.json();
};

export default function SalesChart({ period = '7d' }: { period?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-chart', period],
    queryFn: () => fetchSalesData(period)
  });

  if (isLoading) {
    return <div className="h-80 bg-gray-100 animate-pulse rounded"></div>;
  }

  const chartData = data?.data?.sales || [];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue (₺)" />
        <Line type="monotone" dataKey="orders" stroke="#8B5CF6" strokeWidth={2} name="Orders" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

### 8. Frontend: Product Management Interface (42 items)

#### 8.1 Product List Page (18 items)

- [ ] Create `src/app/admin/products/page.tsx`
- [ ] Create `src/components/admin/tables/ProductsTable.tsx`
- [ ] Display products in table: image, name, SKU, category, price, stock, status
- [ ] Add pagination controls (prev/next, page numbers)
- [ ] Add per-page selector: 10, 20, 50, 100
- [ ] Add search bar with debounced input (300ms)
- [ ] Add filter dropdowns: category, status (active/inactive), stock level
- [ ] Add sorting: name, price, stock, created date
- [ ] Add bulk actions: bulk delete, bulk status change
- [ ] Add bulk selection with checkboxes (select all, select individual)
- [ ] Add "New Product" button → navigate to create page
- [ ] Add quick actions per row: Edit, Delete, Duplicate
- [ ] Add low stock badge for products with stock ≤10
- [ ] Add featured badge for featured products
- [ ] Fetch products with TanStack Query + pagination
- [ ] Add loading skeleton for table
- [ ] Add empty state: "No products found"
- [ ] Make table responsive (horizontal scroll on mobile)

#### 8.2 Product Create/Edit Form (24 items)

- [ ] Create `src/app/admin/products/new/page.tsx`: create page
- [ ] Create `src/app/admin/products/[id]/page.tsx`: edit page
- [ ] Create `src/components/admin/forms/ProductForm.tsx`
- [ ] Use React Hook Form + Zod validation (Q1)
- [ ] Add form fields: name, description, price, compareAtPrice, cost, SKU
- [ ] Add category selector (dropdown from categories API)
- [ ] Add tags input (multi-select or comma-separated)
- [ ] Add stock quantity input
- [ ] Add image upload with Cloudinary (from Phase 5)
- [ ] Support multiple image upload (max 10)
- [ ] Add image preview with remove button
- [ ] Add drag-and-drop image reordering
- [ ] Add variants section: name, value, price adjustment, stock adjustment
- [ ] Add "Add Variant" button
- [ ] Add toggles: isActive, isFeatured
- [ ] Add SEO section: metaTitle, metaDescription
- [ ] Add form validation error messages
- [ ] Add submit button with loading state
- [ ] Add cancel button → navigate back
- [ ] Implement optimistic updates with TanStack Query
- [ ] Show success toast on save
- [ ] Show error toast on failure
- [ ] Prefetch product data on edit page (SSR)
- [ ] Add unsaved changes warning (beforeunload)

**Example**:

```typescript
// src/app/admin/products/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProductsTable from '@/components/admin/tables/ProductsTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';

const fetchProducts = async (page: number, perPage: number, search: string, category: string, status: string) => {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    ...(search && { search }),
    ...(category && { category }),
    ...(status && { status })
  });

  const res = await fetch(`/api/admin/products?${params}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
};

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', page, perPage, debouncedSearch, category, status],
    queryFn: () => fetchProducts(page, perPage, debouncedSearch, category, status)
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/admin/products/new">
          <Button>+ New Product</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {/* Load categories from API */}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low-stock">Low Stock</option>
          </Select>
          <Select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </Select>
        </div>
      </div>

      <ProductsTable
        products={data?.data?.products || []}
        isLoading={isLoading}
        pagination={data?.meta?.pagination}
        onPageChange={setPage}
      />
    </div>
  );
}

// src/components/admin/forms/ProductForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { toast } from 'sonner';

const ProductSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(255),
  description: z.string().max(5000),
  price: z.number().positive('Price must be positive').max(999999.99),
  compareAtPrice: z.number().positive().max(999999.99).optional(),
  cost: z.number().nonnegative().max(999999.99).optional(),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  sku: z.string().max(100).optional(),
  categoryId: z.string().cuid('Invalid category'),
  tags: z.array(z.string().max(50)).max(20).default([]),
  images: z.array(z.object({
    url: z.string().url(),
    publicId: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string()
  })).min(1, 'At least one image required').max(10, 'Maximum 10 images'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional()
});

type ProductFormData = z.infer<typeof ProductSchema>;

export default function ProductForm({ product, onSuccess }: { product?: ProductFormData; onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!product;

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: product || {
      tags: [],
      images: [],
      isActive: true,
      isFeatured: false
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const url = isEdit ? `/api/admin/products/${product.id}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error('Failed to save product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(isEdit ? 'Product updated' : 'Product created');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Basic Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product Name</label>
            <Input {...register('name')} />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea {...register('description')} rows={5} />
            {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price (₺)</label>
              <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
              {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Compare at Price (₺)</label>
              <Input type="number" step="0.01" {...register('compareAtPrice', { valueAsNumber: true })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <Input type="number" {...register('stock', { valueAsNumber: true })} />
              {errors.stock && <p className="text-red-600 text-sm mt-1">{errors.stock.message}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Images</h2>
        <ImageUpload
          images={watch('images')}
          onChange={(images) => setValue('images', images)}
          maxImages={10}
        />
        {errors.images && <p className="text-red-600 text-sm mt-1">{errors.images.message}</p>}
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
```

---

### 9. Frontend: Order Management Interface (38 items)

#### 9.1 Order List Page (16 items)

- [ ] Create `src/app/admin/orders/page.tsx`
- [ ] Create `src/components/admin/tables/OrdersTable.tsx`
- [ ] Display orders in table: order number, date, customer, status, total, items count
- [ ] Add pagination controls
- [ ] Add search: order number, customer name, customer email
- [ ] Add filter dropdowns: status, date range, payment method
- [ ] Add sorting: newest, oldest, highest total, lowest total
- [ ] Add status badges with colors (pending: yellow, confirmed: blue, shipped: purple, delivered: green, cancelled: red)
- [ ] Add quick actions per row: View Details, Update Status
- [ ] Add bulk actions: bulk status update, bulk export
- [ ] Add date range picker with presets (today, 7 days, 30 days, custom)
- [ ] Fetch orders with TanStack Query + pagination
- [ ] Add loading skeleton
- [ ] Add empty state
- [ ] Make table responsive
- [ ] Add real-time updates (polling every 60s)

#### 9.2 Order Detail Page (22 items)

- [ ] Create `src/app/admin/orders/[id]/page.tsx`
- [ ] Display order summary: order number, date, status, total
- [ ] Display customer info: name, email, phone, order history count
- [ ] Display order items table: product, variant, quantity, price, subtotal
- [ ] Display shipping address
- [ ] Display billing address
- [ ] Display payment info: method, status, transaction ID
- [ ] Display shipping info: carrier, tracking number, estimated delivery
- [ ] Display order timeline: status history with timestamps and admin names
- [ ] Create `src/components/admin/forms/OrderStatusForm.tsx`
- [ ] Add status update form with dropdown and notes field
- [ ] Validate status transitions (prevent invalid changes)
- [ ] Add shipping info form: tracking number, carrier, estimated delivery
- [ ] Add internal notes section (admin-only, not visible to customer)
- [ ] Add cancel order button with confirmation modal
- [ ] Add refund button (placeholder for Phase 10)
- [ ] Add print invoice button
- [ ] Implement optimistic status updates
- [ ] Show success toast on status update
- [ ] Send email notification on status change
- [ ] Prefetch order data (SSR)
- [ ] Add breadcrumbs: Orders > Order #12345

**Example**:

```typescript
// src/app/admin/orders/[id]/page.tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useState } from 'react';

const fetchOrder = async (id: string) => {
  const res = await fetch(`/api/admin/orders/${id}`);
  if (!res.ok) throw new Error('Failed to fetch order');
  return res.json();
};

const updateOrderStatus = async (id: string, status: string, notes: string) => {
  const res = await fetch(`/api/admin/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes })
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-order', params.id],
    queryFn: () => fetchOrder(params.id)
  });

  const mutation = useMutation({
    mutationFn: () => updateOrderStatus(params.id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-order', params.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated');
      setNotes('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  if (isLoading) return <div>Loading...</div>;

  const order = data?.data?.order;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Order #{order.orderNumber}</h1>
        <div className="flex gap-2">
          <Button variant="outline">Print Invoice</Button>
          <Button variant="destructive">Cancel Order</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Order Items</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <img src={item.product.images[0]?.url} alt={item.product.name} className="w-12 h-12 object-cover rounded" />
                        <span>{item.product.name}</span>
                      </div>
                    </td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">₺{item.price.toFixed(2)}</td>
                    <td className="text-right">₺{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right py-3 font-bold">Total</td>
                  <td className="text-right font-bold">₺{order.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Customer</h2>
            <p className="font-medium">{order.user.name}</p>
            <p className="text-gray-600">{order.user.email}</p>
            <p className="text-sm text-gray-500 mt-2">
              Total orders: {order.user._count.orders}
            </p>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-2">Shipping Address</h3>
              <p>{order.shippingAddress.street}</p>
              <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold mb-2">Billing Address</h3>
              <p>{order.billingAddress.street}</p>
              <p>{order.billingAddress.city}, {order.billingAddress.postalCode}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status Update */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Update Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Status</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Select status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => mutation.mutate()}
                disabled={!status || mutation.isPending}
                className="w-full"
              >
                {mutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>

          {/* Order Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Timeline</h2>
            <div className="space-y-4">
              {order.statusHistory.map((history: any) => (
                <div key={history.id} className="flex gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium capitalize">{history.status}</p>
                    <p className="text-sm text-gray-600">{new Date(history.createdAt).toLocaleString()}</p>
                    {history.notes && <p className="text-sm text-gray-500 mt-1">{history.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 10. Frontend: User Management Interface (26 items)

#### 10.1 User List Page (14 items)

- [ ] Create `src/app/admin/users/page.tsx`
- [ ] Create `src/components/admin/tables/UsersTable.tsx`
- [ ] Display users in table: name, email, role, status, orders count, total spent, last login
- [ ] Add pagination controls
- [ ] Add search: name, email
- [ ] Add filter dropdowns: role (admin, manager, customer), status (active, inactive)
- [ ] Add sorting: newest, oldest, highest spent, most orders
- [ ] Add role badges with colors (admin: red, manager: blue, customer: gray)
- [ ] Add quick actions per row: View Details, Change Role, Activate/Deactivate
- [ ] Fetch users with TanStack Query + pagination
- [ ] Add loading skeleton
- [ ] Add empty state
- [ ] Make table responsive
- [ ] Add export to CSV button

#### 10.2 User Detail Page (12 items)

- [ ] Create `src/app/admin/users/[id]/page.tsx`
- [ ] Display user info: name, email, phone, role, status, created date, last login
- [ ] Display user stats: total orders, total spent, average order value
- [ ] Display recent orders table with links to order details
- [ ] Create `src/components/admin/forms/UserRoleForm.tsx`
- [ ] Add role change form with dropdown
- [ ] Validate: prevent last admin role removal
- [ ] Add activate/deactivate toggle
- [ ] Add send password reset button
- [ ] Implement optimistic role updates
- [ ] Show success toast on save
- [ ] Prefetch user data (SSR)

**Example**:

```typescript
// src/app/admin/users/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UsersTable from '@/components/admin/tables/UsersTable';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';

const fetchUsers = async (page: number, perPage: number, search: string, role: string, status: string) => {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    ...(search && { search }),
    ...(role && { role }),
    ...(status && { status })
  });

  const res = await fetch(`/api/admin/users?${params}`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, perPage, debouncedSearch, role, status],
    queryFn: () => fetchUsers(page, perPage, debouncedSearch, role, status)
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Users</h1>
        <Button onClick={() => {/* Export to CSV */}}>Export CSV</Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="customer">Customer</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
          </Select>
        </div>
      </div>

      <UsersTable
        users={data?.data?.users || []}
        isLoading={isLoading}
        pagination={data?.meta?.pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
```

---

### 11. Frontend: Analytics Dashboard (24 items)

#### 11.1 Analytics Page (14 items)

- [ ] Create `src/app/admin/analytics/page.tsx`
- [ ] Add date range selector with presets (today, 7d, 30d, 90d, custom)
- [ ] Create revenue analytics section with line chart
- [ ] Create sales analytics section with bar chart
- [ ] Create order status breakdown with pie chart
- [ ] Create top products section with horizontal bar chart
- [ ] Create customer analytics section with area chart
- [ ] Create conversion funnel visualization
- [ ] Add metric cards: total revenue, avg order value, conversion rate
- [ ] Fetch analytics data with TanStack Query
- [ ] Add loading states for all charts
- [ ] Add empty states
- [ ] Add export button for each chart (PNG, CSV)
- [ ] Make charts responsive

#### 11.2 Reports Dashboard (10 items)

- [ ] Create `src/app/admin/reports/page.tsx`
- [ ] Add report type selector: Sales, Products, Customers, Inventory
- [ ] Add date range selector
- [ ] Add format selector: JSON, CSV, Excel
- [ ] Add "Generate Report" button
- [ ] Display report preview table
- [ ] Add download button for generated reports
- [ ] Fetch reports with TanStack Query
- [ ] Add loading state during report generation
- [ ] Add error handling with retry button

**Example**:

```typescript
// src/app/admin/analytics/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SalesChart from '@/components/admin/charts/SalesChart';
import RevenueChart from '@/components/admin/charts/RevenueChart';
import TopProductsChart from '@/components/admin/charts/TopProductsChart';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { subDays } from 'date-fns';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          presets={[
            { label: 'Today', value: { from: new Date(), to: new Date() } },
            { label: 'Last 7 days', value: { from: subDays(new Date(), 7), to: new Date() } },
            { label: 'Last 30 days', value: { from: subDays(new Date(), 30), to: new Date() } },
            { label: 'Last 90 days', value: { from: subDays(new Date(), 90), to: new Date() } }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Sales Trend</h2>
          <SalesChart period={`${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))}d`} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Revenue</h2>
          <RevenueChart period={`${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))}d`} />
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Top Products</h2>
          <TopProductsChart />
        </div>
      </div>
    </div>
  );
}
```

---

### 12. Testing & Quality Assurance (36 items)

#### 12.1 Backend API Tests (18 items)

- [ ] Create `tests/admin/analytics.test.ts`: test analytics endpoints
- [ ] Create `tests/admin/products.test.ts`: test product CRUD, bulk operations
- [ ] Create `tests/admin/orders.test.ts`: test order list, detail, status updates
- [ ] Create `tests/admin/users.test.ts`: test user list, role changes
- [ ] Create `tests/admin/reports.test.ts`: test report generation, CSV export
- [ ] Test S3 RBAC: verify admin-only access, reject customer access
- [ ] Test S2 validation: verify input sanitization, reject XSS payloads
- [ ] Test Q2 format: verify all responses follow standard format
- [ ] Test pagination: verify correct page/perPage/total calculation
- [ ] Test search: verify case-insensitive search works
- [ ] Test filtering: verify category, status, date range filters
- [ ] Test sorting: verify sort by different fields
- [ ] Test bulk actions: bulk delete, bulk update
- [ ] Test audit logging: verify admin actions logged
- [ ] Test rate limiting: verify 100-200 req/15min limits
- [ ] Test error handling: verify 400/401/403/404/500 responses
- [ ] Test caching: verify Redis cache hit/miss for analytics
- [ ] Achieve ≥85% backend test coverage

#### 12.2 Frontend Component Tests (12 items)

- [ ] Create `src/components/admin/__tests__/DashboardStats.test.tsx`
- [ ] Create `src/components/admin/__tests__/ProductsTable.test.tsx`
- [ ] Create `src/components/admin/__tests__/OrdersTable.test.tsx`
- [ ] Create `src/components/admin/__tests__/ProductForm.test.tsx`
- [ ] Test loading states: verify skeletons display
- [ ] Test empty states: verify "no data" messages
- [ ] Test error states: verify error messages and retry buttons
- [ ] Test form validation: verify Zod error messages display
- [ ] Test optimistic updates: verify UI updates before API response
- [ ] Test pagination: verify page change, perPage change
- [ ] Test search: verify debounced search input
- [ ] Achieve ≥80% frontend test coverage

#### 12.3 E2E Admin Tests (6 items)

- [ ] Create `e2e/admin/dashboard.spec.ts`: test dashboard load, stats display
- [ ] Create `e2e/admin/products.spec.ts`: test product create, edit, delete flow
- [ ] Create `e2e/admin/orders.spec.ts`: test order list, detail, status update flow
- [ ] Create `e2e/admin/users.spec.ts`: test user list, role change flow
- [ ] Test RBAC: verify customer cannot access /admin routes (redirect to 403)
- [ ] Test complete admin workflow: login as admin → create product → view in list → edit → delete

---

## 🧪 VALIDATION CRITERIA

### Security Validation (S3, S2, S4)

```bash
# S3: RBAC Protection
curl -H "Authorization: Bearer <customer_token>" http://localhost:3000/api/admin/analytics/dashboard
# Expected: 403 Forbidden

curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/api/admin/analytics/dashboard
# Expected: 200 OK with data

# S2: Input Sanitization
curl -X POST http://localhost:3000/api/admin/products \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","price":99.99,...}'
# Expected: 400 Bad Request (Zod validation error)

# S4: No Hardcoded Secrets
grep -r "sk_live_" packages/backend/src/
grep -r "api_key.*=" packages/backend/src/
# Expected: No matches (all in .env)
```

### Performance Validation (P1, P2)

```bash
# P1: Query Optimization
# Verify queries use indexes, pagination, includes (not N+1)
grep -A 10 "findMany" packages/backend/src/routes/admin/*.ts
# Should show: include, skip, take, orderBy

# P2: Dashboard Performance
# Lighthouse performance test
npx lighthouse http://localhost:3000/admin --preset=desktop --only-categories=performance
# Expected: Score ≥90

# Bundle size check
npm run build
# Expected: admin bundle <220KB gzipped
```

### Quality Validation (Q1, Q2)

```bash
# Q1: TypeScript Strict Mode
npx tsc --noEmit
# Expected: 0 errors

# Q2: API Response Format
curl http://localhost:3000/api/admin/products | jq '.success, .data, .meta'
# Expected: All three fields present
```

### Functional Validation

```typescript
// Analytics API
GET /api/admin/analytics/dashboard → 200 OK, returns totalOrders, totalRevenue
GET /api/admin/analytics/sales?period=7d → 200 OK, returns sales array

// Product Management
POST /api/admin/products → 201 Created
PUT /api/admin/products/:id → 200 OK
DELETE /api/admin/products/:id → 200 OK (soft delete)
POST /api/admin/products/bulk-delete → 200 OK

// Order Management
GET /api/admin/orders → 200 OK, paginated
PUT /api/admin/orders/:id/status → 200 OK, updates status
PUT /api/admin/orders/:id/shipping → 200 OK, updates tracking

// User Management
GET /api/admin/users → 200 OK, paginated
PUT /api/admin/users/:id/role → 200 OK (if not last admin)
PUT /api/admin/users/:id/status → 200 OK

// Reports
GET /api/admin/reports/sales?format=csv → 200 OK, returns CSV

// Audit Logging
GET /api/admin/audit → 200 OK, returns audit logs
```

---

## 📊 SUCCESS METRICS

### Performance Metrics

- Dashboard load time <2.5s (P2)
- Chart render time <800ms (P2)
- API response time (P50) <200ms, (P95) <500ms (P1)
- Admin bundle size <220KB gzipped
- Database query time <100ms (P1)
- Redis cache hit rate >80% for analytics queries

### Quality Metrics

- Backend test coverage ≥85%
- Frontend test coverage ≥80%
- TypeScript errors: 0 (Q1)
- ESLint errors: 0
- Lighthouse performance score ≥90
- Accessibility score (axe) ≥90

### Security Metrics

- All admin routes protected with S3 RBAC middleware
- All forms validated with Zod schemas (S2)
- No hardcoded secrets in codebase (S4)
- Audit logs capture 100% of admin actions
- Rate limiting active on all admin endpoints

### Functional Metrics

- Product CRUD operations: 100% functional
- Order management: 100% functional
- User management: 100% functional
- Analytics dashboard: 100% functional
- Report generation: 100% functional
- Bulk operations: 100% functional

---

## 🚨 COMMON PITFALLS TO AVOID

### Security Anti-Patterns

❌ **WRONG**: Missing RBAC check on admin routes

```typescript
// No middleware protection
router.get("/api/admin/products", async (req, res) => {
  // Anyone can access!
});
```

✅ **CORRECT**: Always use admin middleware

```typescript
router.get("/api/admin/products", adminMiddleware, async (req, res) => {
  // Only admin/manager can access
});
```

❌ **WRONG**: No input validation

```typescript
const product = await prisma.product.create({ data: req.body });
```

✅ **CORRECT**: Zod validation + sanitization

```typescript
const validated = ProductCreateSchema.parse(req.body);
const product = await prisma.product.create({ data: validated });
```

### Performance Anti-Patterns

❌ **WRONG**: N+1 queries

```typescript
const orders = await prisma.order.findMany();
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}
```

✅ **CORRECT**: Single query with includes

```typescript
const orders = await prisma.order.findMany({
  include: { items: { include: { product: true } } },
});
```

❌ **WRONG**: No caching for expensive analytics

```typescript
// Recalculates on every request
const stats = await calculateDashboardStats();
```

✅ **CORRECT**: Redis caching

```typescript
const cached = await redis.get('analytics:dashboard:stats');
if (cached) return JSON.parse(cached);
const stats = await calculateDashboardStats();
await redis.set('analytics:dashboard:stats', JSON.stringify(stats), 'EX', 300);
```

### Quality Anti-Patterns

❌ **WRONG**: Inconsistent API responses

```typescript
res.json({ orders: data }); // Missing success, meta
```

✅ **CORRECT**: Q2 standard format

```typescript
res.json({
  success: true,
  data: { orders: data },
  meta: { timestamp, requestId, pagination },
});
```

### Frontend Anti-Patterns

❌ **WRONG**: No loading/error states

```typescript
const { data } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
return <div>{data.products.map(...)}</div>; // Breaks if loading or error
```

✅ **CORRECT**: Handle all states

```typescript
const { data, isLoading, error } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
if (isLoading) return <Skeleton />;
if (error) return <Error message={error.message} onRetry={refetch} />;
return <div>{data.products.map(...)}</div>;
```

---

## 📦 DELIVERABLES

### Backend Deliverables

- [ ] `src/routes/admin/analytics.routes.ts` - Analytics API with Redis caching
- [ ] `src/routes/admin/products.routes.ts` - Product CRUD + bulk operations
- [ ] `src/routes/admin/orders.routes.ts` - Order management + status workflow
- [ ] `src/routes/admin/users.routes.ts` - User management + role changes
- [ ] `src/routes/admin/reports.routes.ts` - Report generation + CSV/Excel export
- [ ] `src/routes/admin/audit.routes.ts` - Audit log query API
- [ ] `src/services/analytics.service.ts` - Analytics calculations
- [ ] `src/services/reports.service.ts` - Report generation logic
- [ ] `src/services/audit.service.ts` - Audit logging service
- [ ] `src/middleware/admin.middleware.ts` - RBAC protection middleware
- [ ] `src/utils/export.utils.ts` - CSV/Excel export utilities
- [ ] `tests/admin/*.test.ts` - Backend API tests (≥85% coverage)

### Frontend Deliverables

- [ ] `src/app/admin/layout.tsx` - Admin layout with RBAC guard
- [ ] `src/app/admin/page.tsx` - Dashboard home with analytics
- [ ] `src/app/admin/analytics/page.tsx` - Analytics dashboard
- [ ] `src/app/admin/products/page.tsx` - Product list
- [ ] `src/app/admin/products/new/page.tsx` - Product create
- [ ] `src/app/admin/products/[id]/page.tsx` - Product edit
- [ ] `src/app/admin/orders/page.tsx` - Order list
- [ ] `src/app/admin/orders/[id]/page.tsx` - Order detail
- [ ] `src/app/admin/users/page.tsx` - User list
- [ ] `src/app/admin/users/[id]/page.tsx` - User detail
- [ ] `src/app/admin/reports/page.tsx` - Reports dashboard
- [ ] `src/components/admin/AdminShell.tsx` - Layout wrapper
- [ ] `src/components/admin/Sidebar.tsx` - Navigation sidebar
- [ ] `src/components/admin/TopBar.tsx` - Top navigation
- [ ] `src/components/admin/DashboardStats.tsx` - Metrics cards
- [ ] `src/components/admin/charts/*.tsx` - All chart components
- [ ] `src/components/admin/tables/*.tsx` - All table components
- [ ] `src/components/admin/forms/*.tsx` - All form components
- [ ] `src/hooks/admin/*.ts` - Admin-specific hooks
- [ ] `middleware.ts` - Route protection middleware
- [ ] `e2e/admin/*.spec.ts` - E2E tests for admin workflows

### Documentation Deliverables

- [ ] API documentation for all admin endpoints (OpenAPI/Swagger)
- [ ] Admin user guide with screenshots
- [ ] Database schema updates (AuditLog model)
- [ ] Environment variables documentation (.env.example updates)

---

## 📝 PHASE COMPLETION REPORT TEMPLATE

```markdown
# Phase 9: Admin Dashboard - Completion Report

## ✅ Completed Items

- Backend Analytics API: X/26 items
- Backend Product Management: X/28 items
- Backend Order Management: X/32 items
- Backend User Management: X/24 items
- Backend Reports & Export: X/18 items
- Backend Audit & Monitoring: X/16 items
- Frontend Admin Shell: X/32 items
- Frontend Product Management: X/42 items
- Frontend Order Management: X/38 items
- Frontend User Management: X/26 items
- Frontend Analytics: X/24 items
- Testing & QA: X/36 items

**Total Progress**: X/342 items (X%)

## 📊 Metrics Achieved

- Dashboard load time: Xs
- Chart render time: Xms
- API response time P50: Xms, P95: Xms
- Bundle size: XKB gzipped
- Backend test coverage: X%
- Frontend test coverage: X%
- TypeScript errors: 0 ✅
- Lighthouse performance: X/100

## 🔒 Security Validation

- S3 RBAC: ✅ All admin routes protected
- S2 Input Sanitization: ✅ All forms validated with Zod
- S4 No Hardcoded Secrets: ✅ All secrets in .env
- Audit Logging: ✅ All admin actions logged

## 🎯 Functional Validation

- Analytics Dashboard: ✅ Real-time stats, charts working
- Product Management: ✅ CRUD, bulk operations functional
- Order Management: ✅ Status updates, shipping info functional
- User Management: ✅ Role changes, activity logs functional
- Reports: ✅ CSV/Excel export working

## 🚧 Known Issues / Technical Debt

- [ ] Issue 1 description
- [ ] Issue 2 description

## 📚 Documentation

- [ ] API documentation updated
- [ ] Admin user guide created
- [ ] Environment variables documented

## 👥 Phase Review

**Reviewed by**: [Name]
**Date**: [Date]
**Approved**: ✅ / ⏸️ / ❌

**Next Phase**: Phase 10 - Payment Integration (Iyzico)
```

---

**END OF PHASE 9 DOCUMENTATION**
**Total Checklist Items**: 342 items
**Estimated Completion Time**: 7-10 days
**Dependencies**: Phases 1-8 must be completed first
**Next Phase**: Phase 10 - Payment Integration (Iyzico Integration, 3D Secure, Card Tokenization)
