# PHASE 15: Analytics & Reporting System

**⏱️ Estimated Duration**: 5-6 days
**👥 Required Team**: 1 Full-Stack Developer + 1 Data Analyst
**📋 Total Checklist Items**: 168
**🔗 Dependencies**: Phase 9 (Admin Dashboard), Phase 13 (Performance & Optimization)

---

## 📋 Overview

Implement comprehensive analytics and reporting system with Google Analytics 4, custom dashboards, user behavior tracking, conversion funnels, A/B testing, real-time reporting, and data export capabilities.

**Business Value**:
- 📊 **Data-Driven Decisions**: Real-time insights into user behavior and business performance
- 🎯 **Conversion Optimization**: Track and optimize user journeys through conversion funnels
- 📈 **Revenue Analytics**: Detailed revenue tracking, cohort analysis, and forecasting
- 🧪 **A/B Testing**: Experiment framework for continuous optimization
- 📑 **Custom Reports**: Automated report generation and scheduled delivery

---

## 🎯 Phase Objectives

| Objective | Success Metric | Business Impact |
|-----------|---------------|-----------------|
| **Google Analytics 4 Integration** | 100% event tracking coverage | Complete user journey visibility |
| **Custom Analytics Dashboards** | <2s dashboard load time | Real-time business insights |
| **Conversion Funnel Tracking** | Track 5+ key funnels | Identify drop-off points |
| **A/B Testing Framework** | 95%+ statistical confidence | Data-driven optimization |
| **Automated Reporting** | Daily/weekly/monthly reports | Stakeholder visibility |
| **Data Export & Scheduling** | CSV/Excel/PDF export | External analysis capability |

---

## 📦 Requirements & Standards

### Security Requirements (S1-S4)
- **S1**: Encrypt all analytics API keys and credentials with `crypto.createCipheriv`
- **S2**: Sanitize all user inputs in custom event properties
- **S3**: RBAC for analytics access (admin, manager roles only)
- **S4**: Never hardcode GA4 measurement IDs or API keys

### Performance Requirements (P1-P2)
- **P1**: Analytics queries <1s (use Redis caching with 5-min TTL)
- **P2**: Event tracking non-blocking (use Bull queue for async processing)

### Quality Requirements (Q1-Q3)
- **Q1**: All analytics code in TypeScript with strict types
- **Q2**: Consistent event naming: `snake_case` (e.g., `product_view`, `add_to_cart`)
- **Q3**: All timestamps in UTC ISO 8601 format

### Brand Requirements (B1)
- **B1**: Dashboard colors from `deneme.html` (#2B5797, #E8F1F2, #1E3A5F)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Analytics System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │───▶│  Analytics   │───▶│  Google      │      │
│  │   Tracking   │    │  Middleware  │    │  Analytics 4 │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                                   │
│         │                    ▼                                   │
│         │            ┌──────────────┐                           │
│         │            │  Bull Queue  │                           │
│         │            │  (Events)    │                           │
│         │            └──────────────┘                           │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Custom     │◀───│   Database   │───▶│    Redis     │      │
│  │  Dashboards  │    │   (Events)   │    │   (Cache)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Conversion  │    │   A/B Test   │    │   Reports    │      │
│  │   Funnels    │    │   Engine     │    │   Export     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Implementation Checklist

### 1. Google Analytics 4 Integration (28 items)

#### 1.1 GA4 Setup
- [ ] Install `@vercel/analytics` and `react-ga4` packages
- [ ] Create GA4 property in Google Analytics console
- [ ] Configure data streams for web platform
- [ ] Set up enhanced measurement (page views, scrolls, outbound clicks)
- [ ] Add GA4 measurement ID to environment variables (S4)
- [ ] Encrypt GA4 API key with `crypto.createCipheriv` (S1)

#### 1.2 Event Tracking Implementation
- [ ] Create `lib/analytics/ga4.ts` event tracking utility
- [ ] Implement page view tracking with Next.js router events
- [ ] Track product view events with product details
- [ ] Track add to cart events with product and quantity
- [ ] Track checkout initiation and completion
- [ ] Track purchase events with transaction details
- [ ] Track user login and registration events
- [ ] Track search queries and results count
- [ ] Implement custom dimension tracking (user role, segment)
- [ ] Add ecommerce data layer for enhanced tracking
- [ ] Use Bull queue for async event processing (P2)

```typescript
// ❌ WRONG: Blocking event tracking
export const trackEvent = async (eventName: string, params: object) => {
  await fetch('/api/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ eventName, params })
  });
};

// ✅ CORRECT: Non-blocking with Bull queue (P2)
import { Queue } from 'bull';

const analyticsQueue = new Queue('analytics', {
  redis: { host: 'localhost', port: 6379 }
});

export const trackEvent = async (eventName: string, params: object) => {
  // Non-blocking queue job
  await analyticsQueue.add('track', {
    eventName,
    params,
    timestamp: new Date().toISOString() // Q3: UTC ISO 8601
  });
};

// Worker processes events asynchronously
analyticsQueue.process('track', async (job) => {
  const { eventName, params } = job.data;

  // Send to GA4
  await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA4_ID}&api_secret=${GA4_SECRET}`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: params.clientId,
      events: [{
        name: eventName, // Q2: snake_case
        params: sanitizeParams(params) // S2: sanitize inputs
      }]
    })
  });
});
```

#### 1.3 User Properties & Segments
- [ ] Set user ID for logged-in users
- [ ] Track user properties (lifetime value, total orders)
- [ ] Implement user segments (new, returning, VIP)
- [ ] Create custom audiences for remarketing
- [ ] Track user consent preferences (GDPR compliance)

#### 1.4 Ecommerce Tracking
- [ ] Implement view_item events with product details
- [ ] Track add_to_cart with item details and value
- [ ] Track remove_from_cart events
- [ ] Implement begin_checkout events
- [ ] Track add_payment_info step
- [ ] Track add_shipping_info step
- [ ] Implement purchase events with transaction ID
- [ ] Track refund events with transaction details
- [ ] Add product impressions tracking
- [ ] Track promotion views and clicks

---

### 2. Custom Analytics Dashboard (32 items)

#### 2.1 Dashboard Architecture
- [ ] Create `/admin/analytics` protected route (S3: admin only)
- [ ] Implement dashboard layout with sidebar navigation
- [ ] Add date range picker (today, 7d, 30d, custom)
- [ ] Create real-time metrics overview cards
- [ ] Add chart library (Recharts or Chart.js)
- [ ] Implement responsive grid layout for widgets
- [ ] Add dashboard customization (drag-and-drop widgets)
- [ ] Store user dashboard preferences in database

```typescript
// ❌ WRONG: No RBAC protection
export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}

// ✅ CORRECT: RBAC protection (S3)
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const session = await getServerSession();

  if (!session || !['admin', 'manager'].includes(session.user.role)) {
    redirect('/403');
  }

  return <AnalyticsDashboard />;
}
```

#### 2.2 Key Metrics Widgets
- [ ] Revenue overview widget (daily, weekly, monthly)
- [ ] Order count and average order value (AOV)
- [ ] Conversion rate widget (visits → purchases)
- [ ] Top products by revenue widget
- [ ] Top products by units sold widget
- [ ] Customer acquisition cost (CAC) widget
- [ ] Customer lifetime value (CLV) widget
- [ ] Cart abandonment rate widget
- [ ] Traffic sources breakdown (organic, paid, direct, referral)
- [ ] Real-time active users widget

#### 2.3 Chart Visualizations
- [ ] Revenue trend line chart (daily/weekly/monthly)
- [ ] Order volume bar chart
- [ ] Product category distribution pie chart
- [ ] Traffic sources funnel chart
- [ ] Conversion funnel visualization
- [ ] Cohort retention heatmap
- [ ] Geographic distribution map
- [ ] Hour-of-day activity heatmap

#### 2.4 Performance & Caching
- [ ] Implement Redis caching for dashboard queries (P1: <1s)
- [ ] Set cache TTL to 5 minutes for near real-time data
- [ ] Add cache invalidation on new orders/events
- [ ] Implement query batching with DataLoader
- [ ] Add loading skeletons for widgets
- [ ] Implement error boundaries for widget failures
- [ ] Add refresh button with cache bypass option
- [ ] Track dashboard load time (<2s target)

```typescript
// ✅ CORRECT: Redis caching for fast dashboard (P1)
import { redis } from '@/lib/redis';

export const getDashboardMetrics = async (
  dateRange: { start: Date; end: Date }
) => {
  const cacheKey = `dashboard:metrics:${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;

  // Check cache first (P1: <1s response)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Calculate metrics
  const metrics = await prisma.$transaction([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        status: 'completed'
      },
      _sum: { total: true },
      _count: true
    }),
    prisma.product.findMany({
      where: {
        orderItems: {
          some: {
            order: {
              createdAt: { gte: dateRange.start, lte: dateRange.end },
              status: 'completed'
            }
          }
        }
      },
      include: {
        orderItems: {
          where: {
            order: {
              createdAt: { gte: dateRange.start, lte: dateRange.end },
              status: 'completed'
            }
          }
        }
      },
      orderBy: { orderItems: { _count: 'desc' } },
      take: 10
    })
  ]);

  const result = {
    totalRevenue: metrics[0]._sum.total || 0,
    orderCount: metrics[0]._count,
    topProducts: metrics[1]
  };

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);

  return result;
};
```

---

### 3. Conversion Funnel Tracking (24 items)

#### 3.1 Funnel Definition
- [ ] Define product view → add to cart → checkout → purchase funnel
- [ ] Create registration funnel (landing → form → email → complete)
- [ ] Define search funnel (search → results → click → purchase)
- [ ] Create category browse funnel
- [ ] Define wishlist funnel (add → revisit → purchase)

#### 3.2 Funnel Data Collection
- [ ] Create `AnalyticsEvent` model in Prisma schema
- [ ] Track funnel step entry with timestamp (Q3: UTC)
- [ ] Track funnel step exit and drop-off reason
- [ ] Store user session ID for funnel tracking
- [ ] Implement funnel step duration tracking
- [ ] Add device and browser context to events

```typescript
// Prisma schema for funnel tracking
model AnalyticsEvent {
  id            String   @id @default(cuid())
  eventName     String   // Q2: snake_case (product_view, add_to_cart, etc.)
  sessionId     String
  userId        String?
  funnelName    String?  // checkout_funnel, registration_funnel
  funnelStep    Int?     // 1, 2, 3, 4
  properties    Json?    // Event-specific data
  deviceType    String?  // mobile, tablet, desktop
  browser       String?
  timestamp     DateTime @default(now()) // Q3: UTC ISO 8601

  @@index([eventName, timestamp])
  @@index([funnelName, funnelStep])
  @@index([sessionId])
}
```

#### 3.3 Funnel Visualization
- [ ] Create funnel visualization component with step percentages
- [ ] Show drop-off rate between each step
- [ ] Add time-to-conversion metrics per step
- [ ] Implement funnel comparison (current vs previous period)
- [ ] Add segment filters (device, traffic source, user segment)
- [ ] Show conversion rate trends over time

#### 3.4 Funnel Optimization
- [ ] Identify high drop-off steps automatically
- [ ] Generate improvement recommendations based on data
- [ ] Track A/B test impact on funnel performance
- [ ] Create alerts for unusual drop-off spikes
- [ ] Export funnel data for external analysis
- [ ] Calculate funnel opportunity value (potential revenue from improvements)

---

### 4. A/B Testing Framework (28 items)

#### 4.1 Experiment Infrastructure
- [ ] Create `Experiment` model in Prisma schema
- [ ] Implement experiment configuration (name, variants, traffic allocation)
- [ ] Create experiment assignment logic with consistent hashing
- [ ] Store user variant assignments in database
- [ ] Implement experiment start/stop controls
- [ ] Add experiment exclusion rules (e.g., exclude admins)

```typescript
// Prisma schema for A/B testing
model Experiment {
  id                String   @id @default(cuid())
  name              String   @unique
  description       String?
  status            ExperimentStatus @default(draft) // draft, running, paused, completed
  variants          Json     // [{ id: 'control', name: 'Control', traffic: 50 }, { id: 'variant_a', name: 'Variant A', traffic: 50 }]
  targetMetric      String   // conversion_rate, revenue_per_user, etc.
  startDate         DateTime?
  endDate           DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  assignments       ExperimentAssignment[]
  results           ExperimentResult[]
}

model ExperimentAssignment {
  id            String   @id @default(cuid())
  experimentId  String
  userId        String?
  sessionId     String
  variantId     String   // control, variant_a, variant_b
  assignedAt    DateTime @default(now())

  experiment    Experiment @relation(fields: [experimentId], references: [id])

  @@unique([experimentId, sessionId])
  @@index([experimentId, variantId])
}

model ExperimentResult {
  id            String   @id @default(cuid())
  experimentId  String
  variantId     String
  metric        String   // conversion_rate, revenue, etc.
  value         Float
  sampleSize    Int
  timestamp     DateTime @default(now())

  experiment    Experiment @relation(fields: [experimentId], references: [id])

  @@index([experimentId, timestamp])
}

enum ExperimentStatus {
  draft
  running
  paused
  completed
}
```

#### 4.2 Variant Assignment
- [ ] Implement deterministic variant assignment (same user → same variant)
- [ ] Use MurmurHash3 for consistent hashing
- [ ] Respect traffic allocation percentages
- [ ] Handle new experiments mid-session gracefully
- [ ] Store assignment in cookie for consistency
- [ ] Track assignment timestamp for analysis

```typescript
// ✅ CORRECT: Consistent variant assignment
import MurmurHash3 from 'imurmurhash';

export const getExperimentVariant = async (
  experimentId: string,
  userId?: string,
  sessionId?: string
): Promise<string> => {
  // Check existing assignment
  const existing = await prisma.experimentAssignment.findUnique({
    where: {
      experimentId_sessionId: {
        experimentId,
        sessionId: sessionId || 'anonymous'
      }
    }
  });

  if (existing) return existing.variantId;

  // Get experiment config
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId, status: 'running' }
  });

  if (!experiment) return 'control';

  // Deterministic assignment using hash
  const hashKey = userId || sessionId || 'anonymous';
  const hash = MurmurHash3(hashKey).result();
  const bucket = hash % 100;

  // Allocate based on traffic percentages
  const variants = experiment.variants as Array<{
    id: string;
    traffic: number;
  }>;

  let cumulative = 0;
  let assignedVariant = 'control';

  for (const variant of variants) {
    cumulative += variant.traffic;
    if (bucket < cumulative) {
      assignedVariant = variant.id;
      break;
    }
  }

  // Store assignment
  await prisma.experimentAssignment.create({
    data: {
      experimentId,
      userId,
      sessionId: sessionId || 'anonymous',
      variantId: assignedVariant
    }
  });

  return assignedVariant;
};
```

#### 4.3 Frontend Integration
- [ ] Create `useExperiment` React hook for variant access
- [ ] Implement `ExperimentProvider` context for global state
- [ ] Add feature flag system for server-side rendering
- [ ] Create variant-specific components (e.g., `PricingVariantA`, `PricingVariantB`)
- [ ] Track variant exposure events automatically
- [ ] Handle experiment loading states

#### 4.4 Statistical Analysis
- [ ] Implement conversion rate calculation per variant
- [ ] Calculate statistical significance (p-value < 0.05)
- [ ] Compute confidence intervals (95% confidence)
- [ ] Detect early winners with sequential testing
- [ ] Calculate required sample size before starting
- [ ] Implement Bayesian probability of being best

```typescript
// ✅ CORRECT: Statistical significance calculation
import * as stats from 'simple-statistics';

export const calculateSignificance = (
  controlConversions: number,
  controlSamples: number,
  variantConversions: number,
  variantSamples: number
) => {
  const controlRate = controlConversions / controlSamples;
  const variantRate = variantConversions / variantSamples;

  // Pooled standard error
  const pooledRate = (controlConversions + variantConversions) / (controlSamples + variantSamples);
  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / controlSamples + 1 / variantSamples)
  );

  // Z-score
  const zScore = (variantRate - controlRate) / standardError;

  // Two-tailed p-value
  const pValue = 2 * (1 - stats.cumulativeStdNormalProbability(Math.abs(zScore)));

  // 95% confidence interval for lift
  const lift = (variantRate - controlRate) / controlRate;
  const liftCI = 1.96 * standardError / controlRate;

  return {
    controlRate,
    variantRate,
    lift,
    liftCI,
    zScore,
    pValue,
    isSignificant: pValue < 0.05,
    confidence: 1 - pValue
  };
};
```

#### 4.5 Experiment Management UI
- [ ] Create experiment creation form in admin panel (S3)
- [ ] Implement variant configuration UI (name, traffic %)
- [ ] Add experiment monitoring dashboard
- [ ] Show real-time results and statistical significance
- [ ] Implement winner declaration and rollout
- [ ] Add experiment archival and history

---

### 5. Automated Reporting (26 items)

#### 5.1 Report Templates
- [ ] Create daily sales report template
- [ ] Create weekly performance report template
- [ ] Create monthly business review report template
- [ ] Create product performance report template
- [ ] Create customer acquisition report template
- [ ] Create inventory report template

#### 5.2 Report Generation
- [ ] Install `puppeteer` for PDF generation
- [ ] Create report generation service with Bull queue
- [ ] Implement HTML-to-PDF conversion
- [ ] Add chart rendering in reports (static images)
- [ ] Support CSV export for raw data
- [ ] Support Excel export with formatted sheets
- [ ] Add report cover page with branding (B1)
- [ ] Include summary insights and recommendations

```typescript
// ✅ CORRECT: PDF report generation
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';

export const generatePDFReport = async (
  reportType: string,
  dateRange: { start: Date; end: Date }
) => {
  // Fetch report data
  const data = await getReportData(reportType, dateRange);

  // Render React component to HTML
  const html = renderToString(
    <ReportTemplate
      type={reportType}
      data={data}
      dateRange={dateRange}
      branding={{
        primaryColor: '#2B5797', // B1: deneme.html colors
        secondaryColor: '#E8F1F2'
      }}
    />
  );

  // Launch headless browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set content and generate PDF
  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
  });

  await browser.close();

  return pdf;
};
```

#### 5.3 Scheduling System
- [ ] Create `ScheduledReport` model in Prisma
- [ ] Implement cron-based scheduling with `node-cron`
- [ ] Support daily, weekly, monthly frequencies
- [ ] Add custom day-of-week/month selection
- [ ] Implement timezone support for scheduling
- [ ] Add report delivery via email
- [ ] Store generated reports in S3/cloud storage
- [ ] Track report generation history

```typescript
// Prisma schema for scheduled reports
model ScheduledReport {
  id              String   @id @default(cuid())
  name            String
  reportType      String   // daily_sales, weekly_performance, etc.
  frequency       ReportFrequency
  schedule        String   // Cron expression
  recipients      String[] // Email addresses
  format          ReportFormat[] // pdf, csv, excel
  timezone        String   @default("Europe/Istanbul")
  isActive        Boolean  @default(true)
  lastRunAt       DateTime?
  nextRunAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, nextRunAt])
}

enum ReportFrequency {
  daily
  weekly
  monthly
  custom
}

enum ReportFormat {
  pdf
  csv
  excel
}
```

#### 5.4 Report Delivery
- [ ] Implement email delivery with attachments (use Phase 12 email system)
- [ ] Add Slack webhook integration for report notifications
- [ ] Support report download links with expiration
- [ ] Implement report sharing with secure tokens
- [ ] Add report archive section in admin panel
- [ ] Track report open and download events

---

### 6. Data Export & Business Intelligence (18 items)

#### 6.1 Export Functionality
- [ ] Create `/api/analytics/export` endpoint (S3: admin only)
- [ ] Implement CSV export with proper encoding (UTF-8 BOM)
- [ ] Support Excel export with multiple sheets
- [ ] Add JSON export for API integration
- [ ] Implement date range filtering for exports
- [ ] Support column selection for custom exports
- [ ] Add data transformation options (aggregation, grouping)

```typescript
// ✅ CORRECT: CSV export with UTF-8 BOM for Excel compatibility
import { Parser } from 'json2csv';

export const exportToCSV = async (
  data: any[],
  fields: string[]
): Promise<Buffer> => {
  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csv;

  return Buffer.from(csvWithBOM, 'utf-8');
};
```

#### 6.2 BI Tool Integration
- [ ] Create read-only database user for BI tools
- [ ] Generate API keys for external BI platforms
- [ ] Document data schema for analysts
- [ ] Create materialized views for common queries
- [ ] Implement rate limiting for export API (100 req/hour)
- [ ] Add webhook support for real-time data push
- [ ] Create data dictionary documentation

#### 6.3 Export Scheduling
- [ ] Support scheduled data exports
- [ ] Add FTP/SFTP upload for automated exports
- [ ] Implement incremental exports (only new data)
- [ ] Support export to Google Sheets via API
- [ ] Add export notification on completion
- [ ] Track export history and file sizes

---

### 7. Real-Time Analytics (12 items)

#### 7.1 Real-Time Infrastructure
- [ ] Implement WebSocket connection for real-time updates
- [ ] Use Socket.IO for bidirectional communication
- [ ] Create real-time event stream from database triggers
- [ ] Implement Redis Pub/Sub for event broadcasting
- [ ] Add connection pooling for WebSocket scalability

#### 7.2 Real-Time Metrics
- [ ] Show live active users count
- [ ] Display real-time revenue counter
- [ ] Track live order events (new order notifications)
- [ ] Show real-time traffic sources
- [ ] Display live product views and cart additions
- [ ] Implement real-time geographic map of users

```typescript
// ✅ CORRECT: Real-time analytics with Socket.IO
import { Server } from 'socket.io';
import { redis } from '@/lib/redis';

export const initializeRealtimeAnalytics = (io: Server) => {
  // Subscribe to Redis events
  const subscriber = redis.duplicate();

  subscriber.subscribe('analytics:events', (err) => {
    if (err) console.error('Redis subscribe error:', err);
  });

  subscriber.on('message', (channel, message) => {
    const event = JSON.parse(message);

    // Broadcast to connected admin clients (S3)
    io.to('admin-analytics').emit('analytics:event', event);
  });

  io.on('connection', (socket) => {
    // Verify admin role (S3)
    const { user } = socket.handshake.auth;
    if (!['admin', 'manager'].includes(user?.role)) {
      socket.disconnect();
      return;
    }

    socket.join('admin-analytics');
  });
};

// Publish events from application
export const publishAnalyticsEvent = async (event: AnalyticsEvent) => {
  await redis.publish('analytics:events', JSON.stringify(event));
};
```

---

## 🔍 Validation Criteria

### 1. Google Analytics 4 Validation
```bash
# Check GA4 environment variables
grep -r "NEXT_PUBLIC_GA4_MEASUREMENT_ID" .env*

# Verify event tracking implementation
grep -r "trackEvent" app/ lib/

# Check Bull queue for analytics
docker exec -it redis redis-cli KEYS "bull:analytics:*"
```

### 2. Dashboard Performance Validation
```bash
# Check Redis cache hit rate
docker exec -it redis redis-cli INFO stats | grep keyspace_hits

# Verify dashboard load time
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/admin/analytics"

# Check dashboard queries execution time
grep "Prisma query" logs/*.log | grep "getDashboardMetrics"
```

### 3. A/B Testing Validation
```typescript
// Test variant assignment consistency
const userId = 'test-user-123';
const experiment = 'pricing_test';

const variant1 = await getExperimentVariant(experiment, userId);
const variant2 = await getExperimentVariant(experiment, userId);
const variant3 = await getExperimentVariant(experiment, userId);

console.assert(variant1 === variant2 && variant2 === variant3,
  'Variant assignment must be consistent');

// Test traffic allocation
const assignments = await Promise.all(
  Array.from({ length: 1000 }, (_, i) =>
    getExperimentVariant(experiment, `user-${i}`)
  )
);

const distribution = assignments.reduce((acc, variant) => {
  acc[variant] = (acc[variant] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('Traffic distribution:', distribution);
// Should match configured percentages (±5%)
```

### 4. Report Generation Validation
```bash
# Test PDF generation
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "daily_sales",
    "format": "pdf",
    "dateRange": { "start": "2025-01-01", "end": "2025-01-31" }
  }' \
  --output test-report.pdf

# Verify PDF file
file test-report.pdf  # Should show "PDF document"

# Check scheduled reports
pnpm prisma studio  # Open ScheduledReport table
```

### 5. Security Validation (S1-S4)
```bash
# S1: Verify GA4 API key encryption
grep -r "GA4_API_SECRET" app/ lib/  # Should NOT find plaintext

# S2: Check input sanitization
grep -r "sanitizeParams" lib/analytics/

# S3: Verify RBAC on analytics routes
grep -r "getServerSession" app/admin/analytics/

# S4: Check for hardcoded credentials
grep -ri "G-[A-Z0-9]" app/ lib/  # Should only find in .env reference
```

---

## 📊 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **GA4 Event Coverage** | 100% of key events | Track 15+ event types |
| **Dashboard Load Time** | <2s | Lighthouse Performance |
| **Cache Hit Rate** | >80% | Redis INFO stats |
| **Funnel Tracking Accuracy** | >95% | Compare with GA4 data |
| **A/B Test Statistical Power** | >80% | Sample size calculation |
| **Report Generation Time** | <30s for PDF | Bull queue metrics |
| **Export Success Rate** | >99% | Track failed exports |
| **Real-Time Latency** | <500ms | WebSocket ping time |

---

## ⚠️ Common Pitfalls

### ❌ Pitfall 1: Blocking Event Tracking
```typescript
// ❌ WRONG: Synchronous tracking blocks rendering
export const ProductCard = ({ product }) => {
  const handleClick = async () => {
    await trackEvent('product_view', { productId: product.id });
    router.push(`/products/${product.id}`);
  };

  return <button onClick={handleClick}>View</button>;
};

// ✅ CORRECT: Non-blocking tracking (P2)
export const ProductCard = ({ product }) => {
  const handleClick = () => {
    // Fire and forget - non-blocking
    trackEvent('product_view', { productId: product.id });
    router.push(`/products/${product.id}`);
  };

  return <button onClick={handleClick}>View</button>;
};
```

### ❌ Pitfall 2: Inconsistent Variant Assignment
```typescript
// ❌ WRONG: Random assignment - different every time
export const getVariant = () => {
  return Math.random() > 0.5 ? 'control' : 'variant_a';
};

// ✅ CORRECT: Deterministic assignment
export const getVariant = async (userId: string) => {
  const hash = MurmurHash3(userId).result();
  return hash % 2 === 0 ? 'control' : 'variant_a';
};
```

### ❌ Pitfall 3: Slow Dashboard Queries
```typescript
// ❌ WRONG: No caching, slow queries
export const getMetrics = async () => {
  const revenue = await prisma.order.aggregate({
    _sum: { total: true }
  });
  return revenue;
};

// ✅ CORRECT: Redis caching (P1: <1s)
export const getMetrics = async () => {
  const cached = await redis.get('metrics:revenue');
  if (cached) return JSON.parse(cached);

  const revenue = await prisma.order.aggregate({
    _sum: { total: true }
  });

  await redis.set('metrics:revenue', JSON.stringify(revenue), 'EX', 300);
  return revenue;
};
```

### ❌ Pitfall 4: Missing RBAC on Analytics
```typescript
// ❌ WRONG: No access control
export async function GET(req: Request) {
  const analytics = await getAnalyticsData();
  return Response.json(analytics);
}

// ✅ CORRECT: RBAC enforcement (S3)
export async function GET(req: Request) {
  const session = await getServerSession();

  if (!session || !['admin', 'manager'].includes(session.user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const analytics = await getAnalyticsData();
  return Response.json(analytics);
}
```

### ❌ Pitfall 5: CSV Export Without BOM
```typescript
// ❌ WRONG: UTF-8 without BOM - Excel shows garbled text
const csv = parser.parse(data);
return Buffer.from(csv, 'utf-8');

// ✅ CORRECT: UTF-8 with BOM for Excel compatibility
const csv = parser.parse(data);
const BOM = '\uFEFF';
return Buffer.from(BOM + csv, 'utf-8');
```

---

## 📦 Deliverables Checklist

### Code Deliverables
- [ ] `lib/analytics/ga4.ts` - GA4 event tracking utility
- [ ] `lib/analytics/queue.ts` - Bull queue for async events
- [ ] `app/admin/analytics/page.tsx` - Main dashboard (RBAC protected)
- [ ] `components/analytics/MetricsCard.tsx` - Reusable metric widget
- [ ] `components/analytics/ConversionFunnel.tsx` - Funnel visualization
- [ ] `lib/experiments/assignment.ts` - A/B test variant assignment
- [ ] `lib/experiments/stats.ts` - Statistical significance calculation
- [ ] `hooks/useExperiment.ts` - React hook for experiments
- [ ] `lib/reports/generator.ts` - PDF/CSV/Excel report generation
- [ ] `lib/reports/scheduler.ts` - Cron-based scheduling
- [ ] `lib/analytics/realtime.ts` - WebSocket real-time analytics
- [ ] `app/api/analytics/export/route.ts` - Data export API

### Database Deliverables
- [ ] `AnalyticsEvent` Prisma model with indexes
- [ ] `Experiment` Prisma model
- [ ] `ExperimentAssignment` Prisma model with unique constraints
- [ ] `ExperimentResult` Prisma model
- [ ] `ScheduledReport` Prisma model
- [ ] Database migration file: `20250102_analytics_schema.sql`

### Documentation Deliverables
- [ ] `docs/ANALYTICS.md` - Analytics implementation guide
- [ ] `docs/AB_TESTING.md` - A/B testing framework documentation
- [ ] `docs/REPORTING.md` - Report generation and scheduling guide
- [ ] `docs/DATA_DICTIONARY.md` - Schema documentation for BI tools
- [ ] API documentation for export endpoints

### Testing Deliverables
- [ ] `__tests__/analytics/tracking.test.ts` - Event tracking tests
- [ ] `__tests__/analytics/dashboard.test.ts` - Dashboard component tests
- [ ] `__tests__/experiments/assignment.test.ts` - Variant assignment tests
- [ ] `__tests__/experiments/stats.test.ts` - Statistical calculation tests
- [ ] `__tests__/reports/generation.test.ts` - Report generation tests
- [ ] E2E tests for analytics dashboard (Playwright)

### Configuration Deliverables
- [ ] Environment variables in `.env.example`:
  ```env
  # Google Analytics 4
  NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
  GA4_API_SECRET=xxxxxxxxxxxxx

  # Reports
  REPORT_STORAGE_BUCKET=s3://reports-bucket
  REPORT_SMTP_FROM=reports@lumi.com

  # Real-time
  WEBSOCKET_PORT=3001
  REDIS_URL=redis://localhost:6379
  ```

---

## 🎯 Phase Completion Report Template

```markdown
# Phase 15 Completion Report: Analytics & Reporting System

## ✅ Completed Items: [X/168]

### Google Analytics 4 Integration
- [x] GA4 property configured with measurement ID
- [x] Event tracking implemented for 15+ event types
- [x] Bull queue for async event processing
- [x] Ecommerce tracking with enhanced measurement
- [x] User properties and segments configured
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### Custom Analytics Dashboard
- [x] RBAC-protected admin dashboard (S3)
- [x] Redis caching with 5-min TTL (P1: <1s response)
- [x] 10 key metrics widgets implemented
- [x] 8 chart visualizations (line, bar, pie, funnel)
- [x] Real-time data refresh
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### Conversion Funnel Tracking
- [x] 5 key funnels defined and tracked
- [x] AnalyticsEvent model with proper indexes
- [x] Funnel visualization with drop-off rates
- [x] Segment filtering by device/traffic source
- [x] Funnel optimization recommendations
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### A/B Testing Framework
- [x] Experiment, Assignment, Result models created
- [x] Deterministic variant assignment with MurmurHash3
- [x] Statistical significance calculation (p-value, CI)
- [x] useExperiment React hook
- [x] Admin UI for experiment management
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### Automated Reporting
- [x] 6 report templates (daily, weekly, monthly, etc.)
- [x] PDF generation with Puppeteer
- [x] CSV/Excel export with UTF-8 BOM
- [x] Cron-based scheduling with node-cron
- [x] Email delivery integration
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### Data Export & BI
- [x] Export API with RBAC (S3)
- [x] CSV, Excel, JSON export formats
- [x] Read-only DB user for BI tools
- [x] Data dictionary documentation
- [x] Export scheduling and automation
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

### Real-Time Analytics
- [x] WebSocket connection with Socket.IO
- [x] Redis Pub/Sub for event broadcasting
- [x] Live metrics (users, revenue, orders)
- [x] Real-time geographic map
- [x] Connection pooling for scalability
**Status**: ✅ Complete | ⏳ In Progress | ❌ Blocked

## 📊 Metrics Achieved

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| GA4 Event Coverage | 100% | [X]% | ✅/❌ |
| Dashboard Load Time | <2s | [X]s | ✅/❌ |
| Cache Hit Rate | >80% | [X]% | ✅/❌ |
| A/B Test Power | >80% | [X]% | ✅/❌ |
| Report Gen Time | <30s | [X]s | ✅/❌ |
| Export Success Rate | >99% | [X]% | ✅/❌ |
| Real-Time Latency | <500ms | [X]ms | ✅/❌ |

## 🔒 Security Compliance (S1-S4)
- [x] S1: GA4 API key encrypted with crypto.createCipheriv
- [x] S2: Input sanitization on all event properties
- [x] S3: RBAC on /admin/analytics and export API
- [x] S4: No hardcoded measurement IDs or API keys

## ⚡ Performance Compliance (P1-P2)
- [x] P1: Dashboard queries <1s with Redis caching
- [x] P2: Event tracking non-blocking with Bull queue

## 🎨 Quality & Brand (Q1-Q3, B1)
- [x] Q1: TypeScript with strict types
- [x] Q2: snake_case event naming
- [x] Q3: UTC ISO 8601 timestamps
- [x] B1: Dashboard colors (#2B5797, #E8F1F2, #1E3A5F)

## 🐛 Issues & Resolutions
1. **Issue**: [Description]
   - **Resolution**: [How it was fixed]
   - **Prevention**: [How to avoid in future]

## 📈 Business Impact
- **Data-Driven Insights**: [X]% increase in actionable insights
- **Conversion Optimization**: [X]% improvement in funnel conversion
- **A/B Testing ROI**: $[X] revenue from winning variants
- **Report Automation**: [X] hours saved per week

## 🔄 Next Phase Dependencies
- Phase 16: Security & Compliance
  - Uses analytics for security event tracking
  - Audit logging integration with analytics events
  - Compliance reporting leverages export system

## 📝 Notes & Recommendations
- [Any important observations]
- [Suggestions for improvement]
- [Technical debt identified]
```

---

## 🔗 Integration Points

**Phase 9 (Admin Dashboard)**:
- Analytics dashboard embedded in admin panel
- Reuse RBAC and layout components

**Phase 10 (Payment Integration)**:
- Track payment events (initiate, success, fail)
- Revenue analytics from payment data

**Phase 12 (Notifications)**:
- Email delivery for scheduled reports
- Notification events tracked in analytics

**Phase 13 (Performance)**:
- Redis caching for dashboard performance
- CDN for report file delivery

**Phase 14 (Multi-Language)**:
- Localized analytics dashboards
- Multi-currency revenue reporting

---

## 📚 References & Resources

### Google Analytics 4
- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [GA4 Events Reference](https://support.google.com/analytics/answer/9267735)
- [Enhanced Ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)

### A/B Testing
- [Evan Miller's A/B Test Calculator](https://www.evanmiller.org/ab-testing/)
- [Sequential Testing](https://en.wikipedia.org/wiki/Sequential_analysis)
- [Statistical Power Analysis](https://www.statisticshowto.com/probability-and-statistics/hypothesis-testing/statistical-power/)

### Reporting
- [Puppeteer Documentation](https://pptr.dev/)
- [json2csv Library](https://www.npmjs.com/package/json2csv)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)

---

**Phase 15 Total**: ~1,850 lines | 168 checklist items
**Running Total**: ~20,170 lines | 3,106 checklist items across Phases 0-15

---

**Next Phase**: Phase 16 - Security & Compliance
**Focus**: Security hardening, GDPR compliance, PCI-DSS validation, penetration testing, audit logging
