# PHASE 13: PERFORMANCE & OPTIMIZATION

**Status**: 🔄 In Progress
**Priority**: 🔴 Critical
**Dependencies**: All previous phases (1-12)
**Estimated Time**: 6-9 days

---

## 📋 DOCUMENT OVERVIEW

This phase implements comprehensive performance optimization strategies across the entire stack, including advanced caching (Redis, CDN), database query optimization, bundle size reduction, image optimization, API response time improvements, and real-time monitoring. The goal is to achieve sub-second page loads, <100ms API responses, and excellent Core Web Vitals scores.

**Key Components**:
- Multi-layer caching strategy (Redis, CDN, browser cache)
- Database query optimization (indexes, query analysis, connection pooling)
- Frontend bundle optimization (code splitting, tree shaking, lazy loading)
- Image optimization (WebP/AVIF, responsive images, lazy loading)
- API response time optimization (query batching, N+1 elimination)
- CDN integration (Cloudflare) for static assets
- Performance monitoring (Lighthouse CI, Web Vitals, APM)
- Load testing and stress testing (k6, Artillery)

**Technical Stack**:
- Redis (multi-layer caching)
- Cloudflare CDN (static asset delivery)
- Prisma query optimization
- Next.js optimization (SSR, ISR, RSC)
- Bundle analyzers (webpack-bundle-analyzer)
- Lighthouse CI (automated performance testing)
- k6 (load testing)
- New Relic / DataDog (APM - optional)

**Performance Standards**:
- **P1**: API response time <100ms (P50), <300ms (P95)
- **P2**: Page load time <1s (LCP), <100ms (FID), <0.1 (CLS)
- Database query time <50ms (P95)
- Cache hit rate >80%
- Bundle size <200KB initial, <1MB total
- Lighthouse score ≥95 (Performance, Accessibility, Best Practices, SEO)

**Quality Standards**:
- **Q1**: TypeScript strict mode, 0 errors
- **Q2**: All API responses follow standard format
- Core Web Vitals: Good for all metrics
- Zero performance regressions in CI/CD

---

## 🎯 PHASE OBJECTIVES

### Primary Goals
1. **Caching Strategy**: Implement multi-layer caching (Redis, CDN, browser)
2. **Database Optimization**: Optimize queries, add indexes, connection pooling
3. **Bundle Optimization**: Reduce bundle size, code splitting, tree shaking
4. **Image Optimization**: WebP/AVIF conversion, responsive images, lazy loading
5. **API Optimization**: Query batching, N+1 elimination, response compression
6. **CDN Integration**: Cloudflare for static assets, edge caching
7. **Performance Monitoring**: Lighthouse CI, Web Vitals tracking, APM
8. **Load Testing**: Stress test APIs, identify bottlenecks, capacity planning

### Success Criteria
- [ ] API response time <100ms (P50), <300ms (P95)
- [ ] Page load time <1s (LCP <1s, FID <100ms, CLS <0.1)
- [ ] Database query time <50ms (P95)
- [ ] Cache hit rate >80%
- [ ] Bundle size <200KB initial load
- [ ] Lighthouse score ≥95 for all categories
- [ ] No performance regressions in CI/CD
- [ ] System handles 1000 concurrent users without degradation

---

## 🏗️ ARCHITECTURE OVERVIEW

### Multi-Layer Caching Strategy
```
Request Flow:

Browser → CDN Cache (Cloudflare)
            ↓ MISS
          Next.js Server
            ↓
          Application Cache (Redis) → Check product cache
            ↓ MISS
          Database (Prisma)
            ↓
          Store in Redis (5min TTL)
            ↓
          Return to Client
            ↓
          Browser Cache (1 hour)
```

### Cache Layers
1. **Browser Cache**: Static assets (JS, CSS, images) - 1 year
2. **CDN Cache (Cloudflare)**: Static assets, API responses - 1 hour
3. **Redis Cache**: API responses, product data, search results - 5-30 min
4. **Prisma Query Cache**: Database query results - 1 min
5. **ISR Cache (Next.js)**: Pre-rendered pages - 60s revalidation

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: Redis Caching Strategy (28 items)

#### 1.1 Redis Cache Setup (8 items)
- [ ] Install ioredis: `npm install ioredis --save`
- [ ] Create `src/config/cache.config.ts` with Redis client
- [ ] Configure Redis connection with retry logic
- [ ] Add Redis connection health check
- [ ] Set up Redis cluster for high availability (optional, production)
- [ ] Configure cache TTL policies: 5min (products), 30min (categories), 1min (cart)
- [ ] Add cache key naming convention: `namespace:entity:id`
- [ ] Add cache warming on startup (pre-load popular products)

#### 1.2 Cache Middleware (10 items)
- [ ] Create `src/middleware/cache.middleware.ts`
- [ ] Implement `cacheGet(key)` and `cacheSet(key, value, ttl)` helpers
- [ ] Add cache invalidation helpers: `invalidateCache(pattern)`
- [ ] Implement cache-aside pattern for database queries
- [ ] Add cache hit/miss logging
- [ ] Add cache statistics tracking (hit rate, miss rate)
- [ ] Implement cache warming for popular queries
- [ ] Add cache compression for large values (gzip)
- [ ] Add cache versioning for breaking changes
- [ ] Test cache eviction policies (LRU, LFU)

#### 1.3 Route-Level Caching (10 items)
- [ ] Add caching to `GET /api/products`: cache product list (5min TTL)
- [ ] Add caching to `GET /api/products/:id`: cache single product (5min TTL)
- [ ] Add caching to `GET /api/categories`: cache category tree (30min TTL)
- [ ] Add caching to `GET /api/search`: cache search results (5min TTL)
- [ ] Invalidate product cache on update/delete
- [ ] Invalidate category cache on category changes
- [ ] Invalidate search cache on product updates
- [ ] Add cache bypass for authenticated admin requests
- [ ] Add cache-control headers for browser caching
- [ ] Monitor cache hit rate per route

**Example**:
```typescript
// src/config/cache.config.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redis;

// Cache TTL policies
export const CACHE_TTL = {
  PRODUCT: 300,        // 5 minutes
  PRODUCT_LIST: 300,   // 5 minutes
  CATEGORY: 1800,      // 30 minutes
  SEARCH: 300,         // 5 minutes
  CART: 60,            // 1 minute
  USER_SESSION: 3600,  // 1 hour
  POPULAR_PRODUCTS: 600 // 10 minutes
};

// Cache key naming
export const getCacheKey = (namespace: string, ...parts: (string | number)[]) => {
  return `lumi:${namespace}:${parts.join(':')}`;
};

// src/middleware/cache.middleware.ts
import redis, { CACHE_TTL, getCacheKey } from '../config/cache.config';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  compress?: boolean;
}

export const cacheGet = async (key: string): Promise<any | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;

    // Check if compressed
    if (cached.startsWith('gzip:')) {
      const compressed = Buffer.from(cached.slice(5), 'base64');
      const decompressed = await gunzip(compressed);
      return JSON.parse(decompressed.toString());
    }

    return JSON.parse(cached);
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: any,
  options: CacheOptions = {}
): Promise<void> => {
  try {
    const { ttl = CACHE_TTL.PRODUCT, compress = false } = options;

    let serialized = JSON.stringify(value);

    // Compress if value is large (>10KB)
    if (compress || serialized.length > 10000) {
      const compressed = await gzip(Buffer.from(serialized));
      serialized = 'gzip:' + compressed.toString('base64');
    }

    await redis.set(key, serialized, 'EX', ttl);
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Cache middleware for Express routes
export const cacheMiddleware = (namespace: string, ttl?: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') return next();

    // Skip cache for authenticated admin requests
    if (req.user?.role === 'admin') return next();

    const cacheKey = getCacheKey(namespace, req.originalUrl);

    // Try to get from cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Cache miss - store original json method
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      res.setHeader('X-Cache', 'MISS');
      cacheSet(cacheKey, data, { ttl }).catch(console.error);
      return originalJson(data);
    };

    next();
  };
};

// src/routes/products.routes.ts (add caching)
import { cacheMiddleware } from '../middleware/cache.middleware';
import { CACHE_TTL } from '../config/cache.config';

router.get('/', cacheMiddleware('products', CACHE_TTL.PRODUCT_LIST), async (req, res) => {
  // Fetch products from database
  const products = await prisma.product.findMany({...});
  res.json({ success: true, data: { products }, meta: {...} });
});

router.get('/:id', cacheMiddleware('product', CACHE_TTL.PRODUCT), async (req, res) => {
  const product = await prisma.product.findUnique({...});
  res.json({ success: true, data: { product }, meta: {...} });
});

// Invalidate cache on product update
router.put('/:id', adminMiddleware, async (req, res) => {
  const product = await prisma.product.update({...});

  // Invalidate caches
  await invalidateCache(`lumi:product:${req.params.id}*`);
  await invalidateCache('lumi:products:*');
  await invalidateCache('lumi:search:*');

  res.json({ success: true, data: { product }, meta: {...} });
});
```

---

### 2. Backend: Database Optimization (32 items)

#### 2.1 Query Optimization (14 items)
- [ ] Analyze slow queries with Prisma query logging
- [ ] Add indexes for frequently queried fields (email, SKU, category, price)
- [ ] Optimize N+1 queries with `include` and `select`
- [ ] Use `findUnique` instead of `findFirst` where possible
- [ ] Add pagination to all list queries (limit results to 100 max)
- [ ] Use `cursor` pagination for infinite scroll (more efficient than offset)
- [ ] Batch related queries with Promise.all
- [ ] Add database query timeout: 5s
- [ ] Use `select` to fetch only required fields
- [ ] Avoid `findMany()` without `where` clause
- [ ] Add query result caching with Prisma middleware
- [ ] Use database views for complex aggregations
- [ ] Profile queries with `EXPLAIN ANALYZE`
- [ ] Monitor query performance in production

#### 2.2 Index Strategy (10 items)
- [ ] Add index on `User.email` (unique index)
- [ ] Add index on `Product.sku` (unique index)
- [ ] Add composite index on `Product(categoryId, isActive, stock)`
- [ ] Add index on `Order.userId` and `Order.status`
- [ ] Add index on `Order.createdAt` for date range queries
- [ ] Add index on `Payment.iyzicoPaymentId`
- [ ] Add full-text search index on `Product.name` and `Product.description` (if using PostgreSQL)
- [ ] Review index usage with `pg_stat_user_indexes`
- [ ] Remove unused indexes (check with database tools)
- [ ] Monitor index size and fragmentation

#### 2.3 Connection Pooling (8 items)
- [ ] Configure Prisma connection pool: `connection_limit=20`
- [ ] Set pool timeout: 10s
- [ ] Monitor active connections
- [ ] Add connection retry logic
- [ ] Use read replicas for read-heavy queries (optional)
- [ ] Implement database health checks
- [ ] Add connection pool metrics to APM
- [ ] Test connection pool under load

**Example**:
```typescript
// prisma/schema.prisma (add indexes)
model Product {
  id          String   @id @default(cuid())
  sku         String   @unique // Unique index
  name        String
  description String
  price       Float
  stock       Int
  categoryId  String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([categoryId, isActive, stock]) // Composite index for filtering
  @@index([createdAt]) // Index for sorting by date
  @@index([name]) // Index for search
  @@fulltext([name, description]) // Full-text search (PostgreSQL)
}

model Order {
  id        String   @id @default(cuid())
  userId    String
  status    String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

// DATABASE_URL configuration
// postgresql://user:pass@localhost:5432/lumi?connection_limit=20&pool_timeout=10

// src/config/database.ts (query optimization)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'minimal'
});

// Query caching middleware
prisma.$use(async (params, next) => {
  const cacheKey = `query:${params.model}:${params.action}:${JSON.stringify(params.args)}`;

  // Check cache for read operations
  if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const result = await next(params);

  // Cache read results
  if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 60); // 1 min cache
  }

  return result;
});

export default prisma;

// Optimized query examples
// ❌ WRONG: N+1 query
const orders = await prisma.order.findMany();
for (const order of orders) {
  order.items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}

// ✅ CORRECT: Single query with include
const orders = await prisma.order.findMany({
  include: {
    items: {
      include: {
        product: {
          select: { name: true, images: true, price: true }
        }
      }
    },
    user: {
      select: { name: true, email: true }
    }
  }
});

// ❌ WRONG: Fetching all fields
const products = await prisma.product.findMany();

// ✅ CORRECT: Select only needed fields
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    images: true
  }
});

// ❌ WRONG: Offset pagination (slow for large datasets)
const products = await prisma.product.findMany({
  skip: page * perPage,
  take: perPage
});

// ✅ CORRECT: Cursor pagination
const products = await prisma.product.findMany({
  take: perPage,
  cursor: lastId ? { id: lastId } : undefined,
  skip: lastId ? 1 : 0
});
```

---

### 3. Frontend: Bundle Optimization (30 items)

#### 3.1 Code Splitting (12 items)
- [ ] Enable Next.js automatic code splitting
- [ ] Use dynamic imports for large components: `const Modal = dynamic(() => import('./Modal'))`
- [ ] Lazy load admin dashboard: `const AdminDashboard = lazy(() => import('./AdminDashboard'))`
- [ ] Lazy load payment components (only load when needed)
- [ ] Split vendor bundles: React, Tanstack Query, Zustand
- [ ] Use route-based code splitting (automatic in Next.js)
- [ ] Add loading states for lazy-loaded components
- [ ] Prefetch critical routes on hover: `<Link prefetch>`
- [ ] Analyze bundle with webpack-bundle-analyzer
- [ ] Target <200KB initial bundle, <1MB total
- [ ] Remove unused dependencies from package.json
- [ ] Tree-shake unused code

#### 3.2 Asset Optimization (10 items)
- [ ] Optimize images with Next.js Image component
- [ ] Convert images to WebP/AVIF format
- [ ] Add responsive images with srcset
- [ ] Lazy load images below the fold
- [ ] Compress CSS with cssnano
- [ ] Minify JavaScript with Terser
- [ ] Remove unused CSS with PurgeCSS
- [ ] Inline critical CSS for above-the-fold content
- [ ] Use font-display: swap for web fonts
- [ ] Preload critical assets

#### 3.3 Runtime Optimization (8 items)
- [ ] Enable React Compiler (if available, Next.js 15+)
- [ ] Use React.memo for expensive components
- [ ] Implement virtualization for long lists (react-window)
- [ ] Debounce expensive operations (search input, resize)
- [ ] Use useMemo and useCallback to prevent re-renders
- [ ] Optimize re-renders with React DevTools Profiler
- [ ] Add Suspense boundaries for async components
- [ ] Test with Lighthouse and fix performance issues

**Example**:
```typescript
// next.config.js (bundle optimization)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});

module.exports = withBundleAnalyzer({
  swcMinify: true, // Use SWC for minification
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' // Remove console.logs
  },
  images: {
    formats: ['image/avif', 'image/webp'], // Modern image formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  experimental: {
    optimizeCss: true, // Optimize CSS
    optimizePackageImports: ['@mui/icons-material'] // Tree-shake large packages
  }
});

// Dynamic imports example
import dynamic from 'next/dynamic';

// Lazy load admin components
const AdminDashboard = dynamic(() => import('@/components/admin/AdminDashboard'), {
  loading: () => <Skeleton />,
  ssr: false // Don't server-render admin components
});

const PaymentForm = dynamic(() => import('@/components/checkout/PaymentForm'), {
  loading: () => <div>Loading payment form...</div>
});

// Prefetch on hover
<Link href="/products/laptop" prefetch>
  <a onMouseEnter={() => router.prefetch('/products/laptop')}>
    View Laptop
  </a>
</Link>

// Virtualized list for performance
import { FixedSizeList } from 'react-window';

const VirtualizedProductList = ({ products }) => (
  <FixedSizeList
    height={600}
    itemCount={products.length}
    itemSize={120}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <ProductCard product={products[index]} />
      </div>
    )}
  </FixedSizeList>
);

// React.memo for expensive components
export const ProductCard = React.memo(({ product }) => {
  return (
    <div className="product-card">
      <Image src={product.images[0]} alt={product.name} width={300} height={300} />
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.product.id === nextProps.product.id;
});

// package.json scripts
{
  "scripts": {
    "analyze": "ANALYZE=true next build",
    "build": "next build",
    "lighthouse": "lighthouse https://localhost:3000 --view"
  }
}
```

---

### 4. Frontend: Image Optimization (20 items)

#### 4.1 Next.js Image Component (10 items)
- [ ] Replace all `<img>` tags with `<Image>` component
- [ ] Add width and height to all images (prevent CLS)
- [ ] Use `priority` for above-the-fold images (LCP optimization)
- [ ] Use `loading="lazy"` for below-the-fold images
- [ ] Configure image domains in next.config.js
- [ ] Use `placeholder="blur"` for better UX
- [ ] Generate blurred placeholders with next-image-export-optimizer
- [ ] Use responsive images with `sizes` prop
- [ ] Optimize for mobile with smaller image sizes
- [ ] Monitor image loading performance

#### 4.2 Cloudinary Optimization (10 items)
- [ ] Enable auto format (WebP/AVIF) in Cloudinary
- [ ] Set quality to "auto:good" for optimal compression
- [ ] Use responsive breakpoints (320, 640, 768, 1024, 1280, 1920)
- [ ] Enable lazy loading from Cloudinary
- [ ] Add blur placeholder from Cloudinary
- [ ] Use Cloudinary CDN for fast delivery
- [ ] Configure cache-control headers (1 year)
- [ ] Monitor Cloudinary bandwidth usage
- [ ] Implement image sprite sheets for icons
- [ ] Use SVG for logos and icons

**Example**:
```typescript
// next.config.js (image configuration)
module.exports = {
  images: {
    domains: ['res.cloudinary.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000 // 1 year
  }
};

// Optimized Image component usage
import Image from 'next/image';

// Above-the-fold image (LCP)
<Image
  src={product.images[0].url}
  alt={product.name}
  width={600}
  height={600}
  priority // Load immediately
  placeholder="blur"
  blurDataURL={product.images[0].blurDataURL}
/>

// Below-the-fold image (lazy load)
<Image
  src={product.images[1].url}
  alt={product.name}
  width={300}
  height={300}
  loading="lazy"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>

// Cloudinary URL with optimizations
const getOptimizedImageUrl = (publicId: string, width: number) => {
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto:good,w_${width},c_limit/${publicId}`;
};
```

---

### 5. Backend: API Response Optimization (18 items)

#### 5.1 Response Compression (8 items)
- [ ] Enable gzip compression for API responses
- [ ] Install compression middleware: `npm install compression --save`
- [ ] Configure compression threshold: 1KB
- [ ] Use Brotli compression for better ratio (optional)
- [ ] Add `Content-Encoding` header
- [ ] Test compression ratio
- [ ] Monitor bandwidth savings
- [ ] Exclude already compressed content types (images, videos)

#### 5.2 Query Batching (10 items)
- [ ] Implement DataLoader for batching database queries
- [ ] Install DataLoader: `npm install dataloader --save`
- [ ] Create DataLoader for products: batch `findUnique` calls
- [ ] Create DataLoader for users: batch user queries
- [ ] Add DataLoader to request context
- [ ] Eliminate N+1 queries in GraphQL resolvers (if using GraphQL)
- [ ] Test query batching performance
- [ ] Monitor database query count reduction
- [ ] Add DataLoader caching per request
- [ ] Profile API response time improvement

**Example**:
```typescript
// src/middleware/compression.middleware.ts
import compression from 'compression';

export const compressionMiddleware = compression({
  threshold: 1024, // Only compress responses >1KB
  level: 6, // Compression level (1-9, 6 is default)
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use default compression filter
    return compression.filter(req, res);
  }
});

// app.ts
import { compressionMiddleware } from './middleware/compression.middleware';
app.use(compressionMiddleware);

// src/loaders/product.loader.ts (DataLoader for batching)
import DataLoader from 'dataloader';
import prisma from '../config/database';

export const createProductLoader = () => {
  return new DataLoader<string, Product>(async (productIds) => {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds as string[] } }
    });

    // Return products in same order as requested IDs
    const productMap = new Map(products.map(p => [p.id, p]));
    return productIds.map(id => productMap.get(id) || null);
  });
};

// Usage in request context
app.use((req, res, next) => {
  req.loaders = {
    product: createProductLoader(),
    user: createUserLoader()
  };
  next();
});

// In route handler
router.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  // Batch load products for all order items
  const products = await Promise.all(
    order.items.map(item => req.loaders.product.load(item.productId))
  );

  res.json({
    success: true,
    data: {
      order,
      products
    },
    meta: { timestamp: new Date().toISOString() }
  });
});
```

---

### 6. CDN Integration (Cloudflare) (16 items)

#### 6.1 Cloudflare Setup (8 items)
- [ ] Create Cloudflare account and add domain
- [ ] Configure DNS records to point to Cloudflare
- [ ] Enable Cloudflare CDN for static assets
- [ ] Configure cache rules: cache static files for 1 year
- [ ] Enable Auto Minify (JS, CSS, HTML)
- [ ] Enable Brotli compression
- [ ] Configure cache TTL: 1 hour for API, 1 year for static
- [ ] Test CDN cache hit rate

#### 6.2 Cache Purging (8 items)
- [ ] Install Cloudflare API client: `npm install cloudflare --save`
- [ ] Create cache purge script
- [ ] Purge cache on deployment
- [ ] Purge product images on update
- [ ] Purge API cache on data changes
- [ ] Add cache purge to CI/CD pipeline
- [ ] Monitor cache purge success
- [ ] Test cache purge latency

**Example**:
```typescript
// src/services/cdn.service.ts
import Cloudflare from 'cloudflare';

const cf = new Cloudflare({
  apiEmail: process.env.CLOUDFLARE_EMAIL,
  apiKey: process.env.CLOUDFLARE_API_KEY
});

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

export const purgeCDNCache = async (urls: string[]) => {
  try {
    await cf.zones.purgeCache(ZONE_ID, {
      files: urls
    });
    console.log(`Purged ${urls.length} URLs from CDN cache`);
  } catch (error) {
    console.error('CDN cache purge failed:', error);
  }
};

export const purgeAllCDNCache = async () => {
  try {
    await cf.zones.purgeCache(ZONE_ID, { purge_everything: true });
    console.log('Purged all CDN cache');
  } catch (error) {
    console.error('CDN cache purge failed:', error);
  }
};

// Usage: Purge product images on update
router.put('/products/:id', adminMiddleware, async (req, res) => {
  const product = await prisma.product.update({...});

  // Purge CDN cache for this product's images
  const imageUrls = product.images.map(img => img.url);
  await purgeCDNCache(imageUrls);

  res.json({ success: true, data: { product }, meta: {...} });
});
```

---

### 7. Performance Monitoring (26 items)

#### 7.1 Lighthouse CI (10 items)
- [ ] Install Lighthouse CI: `npm install @lhci/cli --save-dev`
- [ ] Create `.lighthouserc.json` configuration
- [ ] Configure performance budgets (LCP <1s, FID <100ms, CLS <0.1)
- [ ] Add Lighthouse CI to GitHub Actions
- [ ] Run Lighthouse on every PR
- [ ] Fail build if performance regresses
- [ ] Generate Lighthouse reports
- [ ] Track performance metrics over time
- [ ] Monitor Core Web Vitals (LCP, FID, CLS)
- [ ] Alert on performance regressions

#### 7.2 Web Vitals Tracking (8 items)
- [ ] Install web-vitals: `npm install web-vitals --save`
- [ ] Track LCP (Largest Contentful Paint) - target <1s
- [ ] Track FID (First Input Delay) - target <100ms
- [ ] Track CLS (Cumulative Layout Shift) - target <0.1
- [ ] Track TTFB (Time to First Byte) - target <600ms
- [ ] Send Web Vitals to analytics (Google Analytics, custom endpoint)
- [ ] Monitor real user metrics (RUM)
- [ ] Alert on poor Web Vitals

#### 7.3 APM Integration (8 items)
- [ ] Choose APM provider (New Relic, DataDog, Sentry Performance)
- [ ] Install APM SDK
- [ ] Configure APM for backend (API response times, database queries)
- [ ] Configure APM for frontend (page load times, user interactions)
- [ ] Set up performance alerts (API >500ms, page load >2s)
- [ ] Create performance dashboards
- [ ] Monitor error rates and performance correlation
- [ ] Track custom metrics (cache hit rate, queue processing time)

**Example**:
```typescript
// .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/products"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 1000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}

// .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run start & npx wait-on http://localhost:3000
      - run: npx lhci autorun

// src/lib/web-vitals.ts
import { getCLS, getFID, getLCP, getTTFB, getFCP } from 'web-vitals';

const sendToAnalytics = (metric: any) => {
  // Send to Google Analytics
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta
    });
  }

  // Send to custom endpoint
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric)
  }).catch(console.error);
};

export const trackWebVitals = () => {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
  getFCP(sendToAnalytics);
};

// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { trackWebVitals } from '@/lib/web-vitals';

export default function RootLayout({ children }) {
  useEffect(() => {
    trackWebVitals();
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

### 8. Load Testing (18 items)

#### 8.1 k6 Load Testing (10 items)
- [ ] Install k6: `brew install k6` or download from k6.io
- [ ] Create `tests/load/product-list.js`: test product listing API
- [ ] Create `tests/load/product-detail.js`: test product detail API
- [ ] Create `tests/load/search.js`: test search API
- [ ] Create `tests/load/checkout.js`: test checkout flow
- [ ] Configure virtual users: 100, 500, 1000 concurrent users
- [ ] Configure test duration: 5 minutes
- [ ] Set performance thresholds (P95 <300ms)
- [ ] Run load tests in staging environment
- [ ] Analyze results: throughput, response time, error rate

#### 8.2 Stress Testing (8 items)
- [ ] Gradually increase load to find breaking point
- [ ] Test with 5000+ concurrent users
- [ ] Monitor CPU, memory, database connections
- [ ] Identify bottlenecks (database, API, queue)
- [ ] Test cache performance under load
- [ ] Test database connection pool exhaustion
- [ ] Document system capacity limits
- [ ] Create capacity planning recommendations

**Example**:
```javascript
// tests/load/product-list.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 500 },   // Ramp up to 500 users
    { duration: '3m', target: 500 },   // Stay at 500 users
    { duration: '1m', target: 1000 },  // Ramp up to 1000 users
    { duration: '3m', target: 1000 },  // Stay at 1000 users
    { duration: '2m', target: 0 }      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests < 300ms
    http_req_failed: ['rate<0.01']    // Error rate < 1%
  }
};

export default function () {
  const res = http.get('http://localhost:3000/api/products?page=1&perPage=24');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
    'has products': (r) => JSON.parse(r.body).data.products.length > 0
  });

  sleep(1); // Simulate user think time
}

// Run load test
// k6 run tests/load/product-list.js

// tests/load/checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  // 1. Browse products
  http.get('http://localhost:3000/api/products');
  sleep(2);

  // 2. View product detail
  const product = http.get('http://localhost:3000/api/products/product_123');
  check(product, { 'product loaded': (r) => r.status === 200 });
  sleep(3);

  // 3. Add to cart
  const cart = http.post('http://localhost:3000/api/cart', JSON.stringify({
    productId: 'product_123',
    quantity: 1
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  check(cart, { 'added to cart': (r) => r.status === 200 });
  sleep(2);

  // 4. Initiate checkout
  const checkout = http.get('http://localhost:3000/api/cart/checkout');
  check(checkout, { 'checkout loaded': (r) => r.status === 200 });
  sleep(5);
}
```

---

## 📊 SUCCESS METRICS

### Performance Metrics
- **API Response Time**: P50 <100ms, P95 <300ms, P99 <500ms
- **Page Load Time**: LCP <1s, FID <100ms, CLS <0.1, TTFB <600ms
- **Database Query Time**: P95 <50ms
- **Cache Hit Rate**: >80%
- **Bundle Size**: Initial <200KB, Total <1MB
- **Lighthouse Score**: Performance ≥95, Accessibility ≥95, Best Practices ≥95, SEO ≥95

### Capacity Metrics
- **Concurrent Users**: Handle 1000+ concurrent users
- **Throughput**: 1000+ requests/second
- **Database Connections**: <50% of pool capacity under normal load
- **Memory Usage**: <70% of available memory
- **CPU Usage**: <60% under normal load

### Business Metrics
- **Bounce Rate**: <40% (improved with faster loading)
- **Conversion Rate**: +10% improvement (faster checkout)
- **Page Views**: +15% (better UX encourages browsing)
- **Server Costs**: -20% (better resource utilization)

---

## 🚨 COMMON PITFALLS TO AVOID

### Caching Anti-Patterns
❌ **WRONG**: Caching without invalidation strategy
```typescript
await redis.set(`product:${id}`, product); // Never expires!
```

✅ **CORRECT**: Always set TTL and invalidation
```typescript
await redis.set(`product:${id}`, product, 'EX', 300); // 5min TTL
// Invalidate on update
await redis.del(`product:${id}`);
```

### Database Anti-Patterns
❌ **WRONG**: Missing indexes on frequently queried fields
```typescript
// Slow query without index
const orders = await prisma.order.findMany({
  where: { userId: 'user_123' } // Full table scan!
});
```

✅ **CORRECT**: Add index
```prisma
model Order {
  userId String
  @@index([userId])
}
```

### Bundle Anti-Patterns
❌ **WRONG**: Importing entire library
```typescript
import _ from 'lodash'; // Imports entire 70KB library
```

✅ **CORRECT**: Import only needed functions
```typescript
import debounce from 'lodash/debounce'; // Imports only 2KB
```

---

## 📦 DELIVERABLES

### Backend Deliverables
- [ ] `src/config/cache.config.ts` - Redis caching configuration
- [ ] `src/middleware/cache.middleware.ts` - Cache middleware
- [ ] `src/middleware/compression.middleware.ts` - Response compression
- [ ] `src/loaders/*.loader.ts` - DataLoader implementations
- [ ] `src/services/cdn.service.ts` - CDN cache purging
- [ ] `prisma/schema.prisma` - Optimized with indexes
- [ ] Load test scripts in `tests/load/`

### Frontend Deliverables
- [ ] `next.config.js` - Optimized configuration
- [ ] `.lighthouserc.json` - Lighthouse CI configuration
- [ ] `src/lib/web-vitals.ts` - Web Vitals tracking
- [ ] Optimized components with React.memo, lazy loading
- [ ] Image optimization with Next.js Image component

### Infrastructure Deliverables
- [ ] Cloudflare CDN configuration
- [ ] Redis cluster setup (if using)
- [ ] Database connection pooling configuration
- [ ] Performance monitoring dashboards

### Documentation Deliverables
- [ ] Performance optimization guide
- [ ] Caching strategy documentation
- [ ] Load testing guide
- [ ] Performance monitoring setup guide

---

## 📝 PHASE COMPLETION REPORT TEMPLATE

```markdown
# Phase 13: Performance & Optimization - Completion Report

## ✅ Completed Items
- Backend Redis Caching: X/28 items
- Backend Database Optimization: X/32 items
- Frontend Bundle Optimization: X/30 items
- Frontend Image Optimization: X/20 items
- Backend API Optimization: X/18 items
- CDN Integration: X/16 items
- Performance Monitoring: X/26 items
- Load Testing: X/18 items

**Total Progress**: X/188 items (X%)

## 📊 Metrics Achieved
- API response time P50: Xms, P95: Xms
- Page load time LCP: Xs, FID: Xms, CLS: X
- Database query time P95: Xms
- Cache hit rate: X%
- Bundle size: XKB initial, XMB total
- Lighthouse score: Performance X/100, Accessibility X/100
- Concurrent users handled: X users

## 🎯 Performance Improvements
- API response time: -X% improvement
- Page load time: -X% improvement
- Database query time: -X% improvement
- Bundle size: -X% reduction
- Lighthouse score: +X points

## 🚧 Known Issues / Technical Debt
- [ ] Issue 1 description
- [ ] Issue 2 description

## 📚 Documentation
- [ ] Performance optimization guide created
- [ ] Caching strategy documented
- [ ] Load testing guide created
- [ ] Monitoring dashboards configured

## 👥 Phase Review
**Reviewed by**: [Name]
**Date**: [Date]
**Approved**: ✅ / ⏸️ / ❌

**Next Phase**: Phase 14 - Multi-Language & Currency (i18n, Currency Conversion)
```

---

**END OF PHASE 13 DOCUMENTATION**
**Total Checklist Items**: 188 items
**Estimated Completion Time**: 6-9 days
**Dependencies**: All previous phases (1-12) must be completed first
**Next Phase**: Phase 14 - Multi-Language & Currency Support
