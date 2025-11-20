# 🚀 PHASE 5: CLOUDINARY MEDIA SYSTEM

**Status**: 🔄 **IN PROGRESS**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3, 4
**Estimated Time**: 9 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Code**: PHASE-5
**Module Focus**: Enterprise Media Management & CDN Integration
**Expected Lines of Code**: ~6,200 lines
**Test Coverage Target**: ≥85%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Cloudinary Integration** - Complete SDK setup with secure configuration
2. **Upload Pipeline** - Multi-file upload with validation and processing
3. **Image Optimization** - WebP/AVIF conversion, responsive breakpoints (P2)
4. **Asset Management** - CRUD operations with versioning and soft delete
5. **Frontend Components** - Next.js Image wrapper, upload widget, gallery
6. **Security Hardening** - MIME validation, size limits, malware scanning
7. **Performance Optimization** - Eager transformations, CDN caching, lazy loading
8. **Operational Readiness** - Webhook handling, cleanup jobs, runbook

### Success Criteria

- ✅ Cloudinary integration functional with all transformations
- ✅ Automatic WebP/AVIF conversion (P2 compliance)
- ✅ Multiple size variants (thumbnail, medium, large)
- ✅ Upload security: MIME whitelist, size limits, antivirus
- ✅ Frontend: responsive images with Next.js Image component
- ✅ Admin controls: upload, update, delete with RBAC (S3)
- ✅ Webhook handling for async processing
- ✅ Orphan asset cleanup automation
- ✅ LCP < 1.2s for image-heavy pages
- ✅ 100% Q2 format compliance

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Standards (P2)

**P2: Image Optimization Rules**

```typescript
// Cloudinary transformation parameters
{
  format: "auto",           // Auto WebP/AVIF based on browser
  quality: "auto:good",     // Automatic quality optimization
  fetch_format: "auto",     // Format negotiation
  dpr: "auto",             // Device pixel ratio handling
  responsive: true,         // Responsive breakpoints
  breakpoints: [320, 640, 768, 1024, 1280, 1536, 1920],
  eager: [
    { width: 300, height: 300, crop: "fill" },  // Thumbnail
    { width: 800, height: 800, crop: "limit" }, // Medium
    { width: 1920, crop: "limit" }              // Large
  ]
}
```

**Performance Targets:**

- Upload processing < 5s (P95)
- Image delivery via CDN: TTFB < 100ms
- Largest Contentful Paint (LCP) < 1.2s
- Cache hit rate > 85%
- Lazy loading for below-fold images

### Security Standards (S2/S3)

**S2: Upload Security**

- MIME type whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- File size limits: 5MB for products, 10MB for banners
- Antivirus scanning (ClamAV or Cloudinary add-on)
- Signed URL expiry: 5 minutes
- Sanitize filenames (remove special characters)

**S3: Admin Controls**

- Upload/Delete operations require authentication
- RBAC enforcement: only admin/staff can delete
- Audit logging for all media operations
- Signed upload signatures server-side only
- No client-side API keys

### API Standards (Q2)

**Media Upload Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "cm2x1y2z3...",
    "publicId": "lumi/products/abc123",
    "url": "https://res.cloudinary.com/.../image.jpg",
    "secureUrl": "https://res.cloudinary.com/.../image.jpg",
    "format": "jpg",
    "width": 1920,
    "height": 1080,
    "bytes": 245678,
    "transformations": {
      "thumbnail": "https://res.cloudinary.com/.../w_300,h_300,c_fill/...",
      "medium": "https://res.cloudinary.com/.../w_800,h_800,c_limit/...",
      "large": "https://res.cloudinary.com/.../w_1920,c_limit/..."
    },
    "metadata": {
      "dominantColor": "#3B82F6",
      "aspectRatio": 1.78
    }
  },
  "meta": {
    "timestamp": "2025-10-01T12:00:00Z",
    "requestId": "uuid-v4"
  }
}
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
apps/backend/src/
├── modules/
│   └── media/
│       ├── media.controller.ts       # HTTP handlers
│       ├── media.service.ts          # Business logic
│       ├── media.repository.ts       # Data access
│       ├── media.validators.ts       # Zod schemas
│       ├── media.router.ts           # Route definitions
│       └── __tests__/
│           ├── media.unit.test.ts
│           ├── media.integration.test.ts
│           └── media.average.test.ts
├── integrations/
│   └── cloudinary/
│       ├── cloudinary.client.ts      # SDK wrapper
│       ├── cloudinary.config.ts      # Configuration
│       ├── cloudinary.helpers.ts     # Transformation helpers
│       └── __tests__/
│           └── cloudinary.test.ts
├── jobs/
│   └── media-cleanup.job.ts          # Orphan asset cleanup
└── webhooks/
    └── cloudinary.webhook.ts         # Cloudinary callbacks

apps/frontend/src/
├── features/
│   └── media/
│       ├── components/
│       │   ├── MediaUploader.tsx     # Drag & drop uploader
│       │   ├── MediaGallery.tsx      # Image gallery grid
│       │   ├── MediaImage.tsx        # Next.js Image wrapper
│       │   └── MediaManager.tsx      # Admin media manager
│       ├── hooks/
│       │   ├── useMediaUpload.ts     # TanStack Query mutation
│       │   ├── useMediaList.ts       # Media fetching
│       │   └── useMediaDelete.ts     # Delete mutation
│       └── types/
│           └── media.types.ts        # Frontend types
├── components/
│   └── ui/
│       └── image/
│           ├── ResponsiveImage.tsx   # Responsive wrapper
│           └── ImagePlaceholder.tsx  # Blur placeholder
└── lib/
    ├── cloudinary.ts                 # Cloudinary URL helpers
    └── image-loader.ts               # Custom Next.js loader

packages/shared/src/
├── media/
│   ├── media.dto.ts                  # DTOs
│   ├── media.validators.ts           # Zod schemas
│   └── media.types.ts                # Shared types
└── testing/
    └── media/
        └── fixtures.ts               # Test fixtures

prisma/schema.prisma
# MediaAsset model addition
```

### Database Schema

```prisma
model MediaAsset {
  id            String   @id @default(cuid())
  publicId      String   @unique // Cloudinary public_id
  url           String
  secureUrl     String
  format        String
  resourceType  String   @default("image") // image, video, raw
  type          String   @default("upload") // upload, fetch, private

  width         Int?
  height        Int?
  bytes         Int

  folder        String?  // lumi/products, lumi/banners
  version       Int      @default(1)

  tags          String[] // product:{id}, user:{id}

  metadata      Json?    // { dominantColor, aspectRatio, etc }

  // Relationships
  uploadedById  String
  uploadedBy    User     @relation(fields: [uploadedById], references: [id])

  // Associations (polymorphic)
  products      Product[]
  productVariants ProductVariant[]

  // Soft delete
  deletedAt     DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([publicId])
  @@index([uploadedById])
  @@index([folder])
  @@index([deletedAt])
  @@map("media_assets")
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Cloudinary Configuration & SDK Setup (12 items)

#### 1.1 Cloudinary Account Setup

- [ ] Create Cloudinary account (or use existing)
- [ ] Get API credentials (cloud_name, api_key, api_secret)
- [ ] Configure upload presets in Cloudinary dashboard
  - [ ] Preset: `lumi_products` (folder: lumi/products)
  - [ ] Preset: `lumi_banners` (folder: lumi/banners)
  - [ ] Preset: `lumi_avatars` (folder: lumi/avatars)
- [ ] Enable auto-upload mapping for domain
- [ ] Configure transformation defaults (quality, format)
- [ ] Set up webhook notification URL

#### 1.2 Backend SDK Integration

- [ ] Install Cloudinary SDK: `pnpm add cloudinary`
- [ ] Create `cloudinary.config.ts`
  - [ ] Load credentials from environment variables
  - [ ] Validate required config (cloud_name, api_key, api_secret)
  - [ ] Configure secure URLs (force HTTPS)
  - [ ] Set default transformation options
- [ ] Create `cloudinary.client.ts` wrapper
  - [ ] Initialize Cloudinary SDK
  - [ ] Create upload method with options
  - [ ] Create delete method
  - [ ] Create transformation URL generator
  - [ ] Add error handling for API failures

---

### 2. Database Schema & Models (8 items)

#### 2.1 Prisma Schema

- [ ] Add `MediaAsset` model to `schema.prisma`
- [ ] Add relations to `Product`, `ProductVariant`, `User`
- [ ] Add indexes on `publicId`, `uploadedById`, `folder`
- [ ] Create migration: `pnpm prisma migrate dev --name add-media-asset`
- [ ] Generate Prisma client: `pnpm prisma generate`

#### 2.2 Repository Layer

- [ ] Create `media.repository.ts`
  - [ ] `create(data)` - Create media record
  - [ ] `findById(id)` - Get media by ID
  - [ ] `findByPublicId(publicId)` - Get by Cloudinary ID
  - [ ] `list(filters)` - List media with pagination
  - [ ] `update(id, data)` - Update metadata
  - [ ] `softDelete(id)` - Mark as deleted
  - [ ] `findOrphans()` - Find unattached media
  - [ ] Test all repository methods

---

### 3. Media Upload Pipeline (28 items)

#### 3.1 Upload Endpoint & Validation

- [ ] Create `POST /api/v1/media/upload` endpoint
- [ ] Install `multer` for file handling: `pnpm add multer @types/multer`
- [ ] Configure `multer` with memory storage
- [ ] Create upload validator schema (Zod)
  - [ ] Validate MIME type (whitelist: jpeg, png, webp, gif)
  - [ ] Validate file size (< 5MB default)
  - [ ] Validate filename (sanitize special chars)
  - [ ] Validate required fields (folder, tags)
- [ ] Implement rate limiting (10 uploads/min per user)

#### 3.2 Upload Processing Service

- [ ] Create `media.service.ts` with `uploadImage()` method
  - [ ] Accept file buffer, metadata, user ID
  - [ ] Validate file type and size
  - [ ] Generate unique filename
  - [ ] Upload to Cloudinary with eager transformations
  - [ ] Extract metadata (width, height, dominant color)
  - [ ] Create database record
  - [ ] Return Q2 formatted response
- [ ] Implement multi-file upload support
  - [ ] Accept array of files
  - [ ] Process uploads in parallel (max 5 concurrent)
  - [ ] Aggregate results
  - [ ] Handle partial failures

#### 3.3 Eager Transformations

- [ ] Configure thumbnail transformation (300x300, crop: fill)
- [ ] Configure medium transformation (800x800, crop: limit)
- [ ] Configure large transformation (1920px width, crop: limit)
- [ ] Add WebP conversion (format: webp, quality: auto:good)
- [ ] Add progressive JPEG (flags: progressive)
- [ ] Store transformation URLs in response

#### 3.4 Security Measures

- [ ] Implement server-side upload signature generation
- [ ] Create `POST /api/v1/media/signature` endpoint
  - [ ] Generate Cloudinary upload signature
  - [ ] Include timestamp and folder
  - [ ] Set signature expiry (5 minutes)
  - [ ] Return signed parameters
- [ ] Add antivirus scanning integration
  - [ ] Option 1: Cloudinary's Advanced Protection add-on
  - [ ] Option 2: ClamAV integration
  - [ ] Reject files that fail virus scan
- [ ] Implement filename sanitization
  - [ ] Remove special characters
  - [ ] Convert spaces to hyphens
  - [ ] Lowercase all filenames
  - [ ] Prevent path traversal attacks

#### 3.5 Upload Error Handling

- [ ] Handle Cloudinary API errors
- [ ] Handle file size exceeded (413 Payload Too Large)
- [ ] Handle invalid MIME type (415 Unsupported Media Type)
- [ ] Handle rate limit (429 Too Many Requests)
- [ ] Handle storage quota exceeded
- [ ] Cleanup partial uploads on failure
- [ ] Return Q2 formatted error responses

---

### 4. Asset Management API (18 items)

#### 4.1 Media Retrieval Endpoints

- [ ] GET `/api/v1/media` - List media assets
  - [ ] Paginate results (default 24)
  - [ ] Filter by folder (query param)
  - [ ] Filter by resource type (image, video)
  - [ ] Filter by tags
  - [ ] Sort by upload date (newest first)
  - [ ] Include transformation URLs
  - [ ] Cache response (5min TTL)
- [ ] GET `/api/v1/media/:id` - Get single media asset
  - [ ] Include full metadata
  - [ ] Include transformation URLs
  - [ ] Include usage information (products, variants)
  - [ ] Return 404 if not found or deleted

#### 4.2 Media Update Endpoints (Admin)

- [ ] PUT `/api/v1/admin/media/:id` - Update media metadata
  - [ ] Update tags
  - [ ] Update folder
  - [ ] Update custom metadata
  - [ ] Validate ownership or admin role
  - [ ] Audit log update
- [ ] POST `/api/v1/admin/media/:id/regenerate` - Regenerate transformations
  - [ ] Trigger Cloudinary explicit transformation
  - [ ] Update transformation URLs
  - [ ] Return updated asset

#### 4.3 Media Delete Endpoints (Admin)

- [ ] DELETE `/api/v1/admin/media/:id` - Soft delete media
  - [ ] Check if media is in use (products, variants)
  - [ ] Warn if in use, prevent deletion
  - [ ] Mark as deleted in database (deletedAt)
  - [ ] Keep Cloudinary asset (for rollback)
  - [ ] Audit log deletion
- [ ] DELETE `/api/v1/admin/media/:id/permanent` - Hard delete
  - [ ] Verify media not in use
  - [ ] Delete from Cloudinary
  - [ ] Delete database record
  - [ ] Audit log permanent deletion
  - [ ] Cannot be undone

---

### 5. Frontend Components (32 items)

#### 5.1 Next.js Image Integration

- [ ] Create `MediaImage.tsx` component
  - [ ] Wrap Next.js `Image` component
  - [ ] Accept Cloudinary URL or publicId
  - [ ] Generate responsive `sizes` prop
  - [ ] Add blur placeholder support
  - [ ] Add loading="lazy" for below-fold
  - [ ] Add priority for above-fold images
  - [ ] Handle missing images gracefully
- [ ] Create custom Cloudinary image loader
  - [ ] `lib/image-loader.ts`
  - [ ] Generate Cloudinary URLs with transformations
  - [ ] Support custom width/height/quality
  - [ ] Support format negotiation (WebP/AVIF)

#### 5.2 Media Upload Component

- [ ] Install `react-dropzone`: `pnpm add react-dropzone`
- [ ] Create `MediaUploader.tsx` component
  - [ ] Drag & drop zone
  - [ ] File input fallback
  - [ ] Multiple file selection
  - [ ] File preview thumbnails
  - [ ] Upload progress bar per file
  - [ ] Cancel upload button
  - [ ] Error display per file
  - [ ] Success confirmation
  - [ ] Optimistic UI updates
- [ ] Add file validation on client
  - [ ] Check MIME type
  - [ ] Check file size
  - [ ] Show validation errors
- [ ] Implement upload queue
  - [ ] Max 5 concurrent uploads
  - [ ] Show queue status
  - [ ] Retry failed uploads

#### 5.3 Media Gallery Component

- [ ] Create `MediaGallery.tsx` component
  - [ ] Grid layout (responsive)
  - [ ] Infinite scroll pagination
  - [ ] Image lazy loading
  - [ ] Thumbnail hover preview
  - [ ] Selection mode (checkboxes)
  - [ ] Bulk delete action
  - [ ] Filter by folder
  - [ ] Search by tags
  - [ ] Sort options (date, size, name)
- [ ] Add lightbox for full-size view
  - [ ] Install `yet-another-react-lightbox`
  - [ ] Navigate between images
  - [ ] Download button
  - [ ] Delete button (admin only)
  - [ ] Zoom functionality

#### 5.4 Admin Media Manager

- [ ] Create `MediaManager.tsx` page
  - [ ] Upload section
  - [ ] Gallery view
  - [ ] List view toggle
  - [ ] Filters sidebar
  - [ ] Bulk operations toolbar
  - [ ] Storage usage indicator
  - [ ] Orphan detection warning

#### 5.5 TanStack Query Hooks

- [ ] Create `useMediaUpload()` hook
  - [ ] useMutation for upload
  - [ ] Invalidate media list on success
  - [ ] Handle upload errors
  - [ ] Progress tracking
- [ ] Create `useMediaList()` hook
  - [ ] useInfiniteQuery for pagination
  - [ ] Cache media list (5min)
  - [ ] Support filters and sorting
- [ ] Create `useMediaDelete()` hook
  - [ ] useMutation for delete
  - [ ] Optimistic update
  - [ ] Invalidate cache on success
- [ ] Create `useMediaUpdate()` hook
  - [ ] useMutation for metadata update
  - [ ] Update cache on success

---

### 6. Image Optimization & Performance (16 items)

#### 6.1 Responsive Images

- [ ] Define responsive breakpoints: 320, 640, 768, 1024, 1280, 1536, 1920
- [ ] Generate `srcset` for each image
- [ ] Calculate optimal `sizes` attribute
- [ ] Implement art direction (different crops per breakpoint)
- [ ] Test on multiple devices (mobile, tablet, desktop)

#### 6.2 Format Optimization

- [ ] Enable automatic format selection (f_auto)
  - [ ] WebP for Chrome, Firefox, Edge
  - [ ] AVIF for browsers that support it
  - [ ] JPEG fallback for older browsers
- [ ] Test format delivery across browsers
- [ ] Verify quality settings (auto:good)
- [ ] Monitor format distribution analytics

#### 6.3 Lazy Loading & Placeholders

- [ ] Implement lazy loading with IntersectionObserver
- [ ] Generate LQIP (Low Quality Image Placeholder)
  - [ ] Use Cloudinary blur transformation (w_20,e_blur:1000)
  - [ ] Base64 encode for inline placeholder
- [ ] Implement blur-up effect on load
- [ ] Add skeleton loader for image containers
- [ ] Measure LCP improvement

#### 6.4 CDN Caching

- [ ] Configure Cloudinary CDN cache headers
  - [ ] Cache-Control: public, max-age=31536000
  - [ ] Immutable URLs (version in URL)
- [ ] Implement cache invalidation strategy
- [ ] Add cache warming for popular images
- [ ] Monitor CDN cache hit rate (target: >85%)

---

### 7. Webhooks & Async Processing (12 items)

#### 7.1 Cloudinary Webhook Setup

- [ ] Create webhook endpoint: `POST /webhooks/cloudinary`
- [ ] Verify webhook signature
  - [ ] Use Cloudinary webhook secret
  - [ ] Validate HMAC-SHA256 signature
  - [ ] Reject invalid signatures
- [ ] Handle webhook events
  - [ ] `upload` - Update database on successful upload
  - [ ] `delete` - Mark as deleted in database
  - [ ] `transformation` - Update transformation URLs
  - [ ] `moderation` - Handle moderation results
- [ ] Implement idempotency (prevent duplicate processing)
- [ ] Queue webhook processing (Bull/BullMQ)
- [ ] Add retry logic for failed webhooks
- [ ] Log all webhook events

#### 7.2 Background Jobs

- [ ] Create media cleanup job (`media-cleanup`)
  - [ ] Run daily (cron: 0 2 \* \* \*)
  - [ ] Find orphan assets (not attached to any entity)
  - [ ] Find assets older than 30 days
  - [ ] Soft delete orphans
  - [ ] Report cleanup results
- [ ] Create transformation regeneration job
  - [ ] Regenerate all transformations for updated presets
  - [ ] Process in batches (100 assets per batch)
  - [ ] Update database with new URLs

---

### 8. Security & Compliance (14 items)

#### 8.1 Upload Security

- [ ] Enforce MIME type whitelist (S2)
- [ ] Validate file size limits (S2)
- [ ] Sanitize filenames (remove special chars)
- [ ] Implement rate limiting on upload endpoint
- [ ] Generate server-side upload signatures only
- [ ] Never expose API secret to client
- [ ] Add CSRF protection for upload forms

#### 8.2 Access Control

- [ ] Require authentication for all media endpoints
- [ ] RBAC for admin operations (update, delete)
- [ ] Verify user owns uploaded media or is admin
- [ ] Audit log all admin media actions (S3)
  - [ ] Log user ID, action, asset ID, timestamp
  - [ ] Log IP address for security
- [ ] Implement media visibility controls
  - [ ] Public: visible to all
  - [ ] Private: only uploader and admin
  - [ ] Internal: only authenticated users

#### 8.3 Content Security

- [ ] Integrate antivirus scanning
  - [ ] Scan all uploads before storage
  - [ ] Quarantine infected files
  - [ ] Notify admin of threats
- [ ] Implement content moderation (optional)
  - [ ] Cloudinary AI moderation add-on
  - [ ] Flag inappropriate content
  - [ ] Manual review queue

---

### 9. Testing Implementation (24 items)

#### 9.1 Unit Tests

- [ ] Test `cloudinary.client.ts`
  - [ ] Mock Cloudinary SDK calls (nock)
  - [ ] Test upload success
  - [ ] Test upload failure
  - [ ] Test delete success
  - [ ] Test transformation URL generation
- [ ] Test `media.service.ts`
  - [ ] Test uploadImage() method
  - [ ] Test validation (MIME, size)
  - [ ] Test metadata extraction
  - [ ] Test multi-file upload
  - [ ] Test error handling
- [ ] Test `media.repository.ts`
  - [ ] Test CRUD operations
  - [ ] Test findOrphans() logic
  - [ ] Test soft delete

#### 9.2 Integration Tests

- [ ] Test upload endpoint
  - [ ] Upload single image (success)
  - [ ] Upload multiple images (success)
  - [ ] Upload with invalid MIME (415 error)
  - [ ] Upload oversized file (413 error)
  - [ ] Upload without auth (401 error)
- [ ] Test media list endpoint
  - [ ] Returns paginated results
  - [ ] Filters work correctly
  - [ ] Sorting works
  - [ ] Cache headers present
- [ ] Test delete endpoint
  - [ ] Soft delete success
  - [ ] Prevents deletion if in use
  - [ ] Requires admin role
  - [ ] Audit log created

#### 9.3 Average/Error/Recovery Tests

- [ ] **Average Test** (`tests/average/media-average.test.ts`)
  - [ ] Upload 3 images
  - [ ] Verify transformations generated
  - [ ] Render gallery on frontend
  - [ ] Verify responsive images work
  - [ ] Delete 1 image
  - [ ] Verify cache invalidation
- [ ] **Error Tests**
  - [ ] 413 Payload Too Large (file > 5MB)
  - [ ] 415 Unsupported Media Type (invalid MIME)
  - [ ] 429 Too Many Requests (rate limit)
  - [ ] 401 Unauthorized (no auth token)
  - [ ] 403 Forbidden (non-admin delete)
- [ ] **Recovery Tests**
  - [ ] Cloudinary outage → Queue retry
  - [ ] Failed upload → Rollback database entry
  - [ ] Webhook failure → Retry logic
  - [ ] Orphan cleanup → Delete unused assets

#### 9.4 Performance Tests

- [ ] Measure upload processing time (target: < 5s P95)
- [ ] Measure image delivery TTFB (target: < 100ms)
- [ ] Measure LCP on image-heavy pages (target: < 1.2s)
- [ ] Test with Lighthouse (Performance score > 90)
- [ ] Verify cache hit rate (target: > 85%)

---

### 10. Documentation & Operational Readiness (18 items)

#### 10.1 API Documentation

- [ ] Document upload endpoint in OpenAPI spec
- [ ] Document media list endpoint
- [ ] Document media delete endpoint
- [ ] Add request/response examples
- [ ] Document error codes and messages
- [ ] Add Postman collection examples

#### 10.2 Runbook Creation

- [ ] Create `docs/ops/media-runbook.md`
  - [ ] Cloudinary dashboard access
  - [ ] API key rotation procedure
  - [ ] Upload troubleshooting steps
  - [ ] CDN cache purge procedure
  - [ ] Orphan cleanup manual trigger
  - [ ] Emergency media rollback
  - [ ] Quota monitoring and alerts
- [ ] Document webhook setup
  - [ ] Webhook URL configuration
  - [ ] Signature verification process
  - [ ] Retry policy
- [ ] Document backup strategy
  - [ ] Cloudinary backup features
  - [ ] Database backup for metadata
  - [ ] Recovery procedures

#### 10.3 Monitoring & Alerts

- [ ] Add Prometheus metrics
  - [ ] `media_uploads_total{status}`
  - [ ] `media_upload_duration_seconds`
  - [ ] `media_storage_bytes`
  - [ ] `cloudinary_api_errors_total`
- [ ] Configure Sentry alerts
  - [ ] Upload failures
  - [ ] Cloudinary API errors
  - [ ] Webhook processing failures
- [ ] Add Cloudinary usage monitoring
  - [ ] Track storage quota
  - [ ] Track bandwidth usage
  - [ ] Track transformation quota
  - [ ] Alert at 80% quota

#### 10.4 Frontend Documentation

- [ ] Document `MediaImage` component usage
- [ ] Document `MediaUploader` component
- [ ] Document TanStack Query hooks
- [ ] Create Storybook stories for all components
  - [ ] MediaImage with various props
  - [ ] MediaUploader with drag & drop
  - [ ] MediaGallery with sample data
- [ ] Add accessibility documentation (ARIA labels, keyboard nav)

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Run all media tests
pnpm --filter @lumi/backend test media

# Run integration tests
pnpm --filter @lumi/backend test:integration media

# Run average test suite
pnpm --filter @lumi/backend test:average media

# Frontend component tests
pnpm --filter @lumi/frontend test media

# Check test coverage (must be ≥85%)
pnpm test:coverage
```

### Upload Flow Validation

```typescript
// Test successful upload
const formData = new FormData();
formData.append("file", imageFile);
formData.append("folder", "lumi/products");

const response = await fetch("/api/v1/media/upload", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

expect(response.status).toBe(200);
const result = await response.json();
expect(result.success).toBe(true);
expect(result.data).toHaveProperty("publicId");
expect(result.data).toHaveProperty("transformations");
expect(result.data.transformations).toHaveProperty("thumbnail");

// Verify transformations are accessible
const thumbResponse = await fetch(result.data.transformations.thumbnail);
expect(thumbResponse.status).toBe(200);
expect(thumbResponse.headers.get("content-type")).toMatch(/image/);
```

### Security Validation

```typescript
// S2: MIME type validation
const invalidFile = new File(["test"], "test.exe", { type: "application/exe" });
const formData = new FormData();
formData.append("file", invalidFile);

const response = await fetch("/api/v1/media/upload", {
  method: "POST",
  body: formData,
});

expect(response.status).toBe(415); // Unsupported Media Type

// S2: File size validation
const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "large.jpg", {
  type: "image/jpeg",
});
const response2 = await fetch("/api/v1/media/upload", {
  method: "POST",
  body: formData,
});

expect(response2.status).toBe(413); // Payload Too Large

// S3: Admin-only delete
const deleteResponse = await fetch("/api/v1/admin/media/123", {
  method: "DELETE",
  headers: { Authorization: `Bearer ${customerToken}` },
});

expect(deleteResponse.status).toBe(403); // Forbidden

// S3: Audit log verification
const auditLog = await prisma.auditLog.findFirst({
  where: { action: "media.delete", resourceId: mediaId },
});
expect(auditLog).toBeDefined();
expect(auditLog.userId).toBe(adminUserId);
```

### Performance Validation (P2)

```typescript
// Verify WebP/AVIF conversion
const imageUrl = result.data.secureUrl;
expect(imageUrl).toContain("f_auto"); // Format auto
expect(imageUrl).toContain("q_auto:good"); // Quality auto

// Verify responsive breakpoints
const breakpoints = result.data.transformations.responsive;
expect(breakpoints).toHaveLength(7);
expect(breakpoints[0].width).toBe(320);
expect(breakpoints[6].width).toBe(1920);

// Measure LCP with Lighthouse
const lighthouse = await runLighthouse("http://localhost:3000/products/test");
expect(lighthouse.lcp).toBeLessThan(1200); // < 1.2s
```

### Q2 Format Validation

```typescript
// Verify Q2 response format
expect(response.body).toMatchObject({
  success: true,
  data: {
    id: expect.any(String),
    publicId: expect.any(String),
    url: expect.stringMatching(/^https:\/\/res\.cloudinary\.com/),
    transformations: expect.any(Object),
  },
  meta: {
    timestamp: expect.any(String),
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  },
});
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics

- ✅ Test coverage ≥85% (media module)
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ 100% Zod schema validation coverage
- ✅ Storybook stories for all components

### Performance Metrics

- ✅ Upload processing < 5s (P95)
- ✅ Image delivery TTFB < 100ms
- ✅ LCP < 1.2s for image-heavy pages
- ✅ CDN cache hit rate > 85%
- ✅ Lighthouse Performance score > 90

### Security Metrics

- ✅ 100% uploads validated (MIME + size)
- ✅ Antivirus scanning active
- ✅ Server-side signatures only (no client API keys)
- ✅ Admin operations protected (S3)
- ✅ All media actions audited

### Optimization Metrics (P2)

- ✅ 100% images served as WebP/AVIF
- ✅ Responsive breakpoints: 320-1920px
- ✅ Lazy loading for below-fold images
- ✅ Blur placeholders for all images
- ✅ Eager transformations (thumbnail, medium, large)

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Exposing API Secrets

❌ **Wrong:**

```typescript
// Client-side Cloudinary config with API secret
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: "lumi",
  api_key: "123456",
  api_secret: "SECRET", // NEVER expose this!
});
```

✅ **Correct:**

```typescript
// Server-side only, generate signed upload parameters
export async function generateUploadSignature() {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: "lumi/products" },
    process.env.CLOUDINARY_API_SECRET,
  );
  return { timestamp, signature };
}
```

### 2. Missing MIME Validation

❌ **Wrong:**

```typescript
// Accept any file type
app.post("/upload", upload.single("file"), async (req, res) => {
  const result = await cloudinary.uploader.upload(req.file.path);
  res.json(result);
});
```

✅ **Correct:**

```typescript
// Validate MIME type (S2)
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
  return res.status(415).json({
    success: false,
    error: { code: "INVALID_MIME_TYPE", message: "File type not supported" },
  });
}
```

### 3. No Image Optimization

❌ **Wrong:**

```typescript
// Serve original image without optimization
<img src={imageUrl} alt="Product" />
```

✅ **Correct:**

```typescript
// Use Next.js Image with Cloudinary loader (P2)
<Image
  src={publicId}
  alt="Product"
  width={800}
  height={800}
  loader={cloudinaryLoader}
  quality="auto:good"
  format="auto"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  placeholder="blur"
  blurDataURL={blurPlaceholder}
/>
```

### 4. Hardcoded Transformation URLs

❌ **Wrong:**

```typescript
// Hardcoded transformation in URL
const thumbnailUrl = `https://res.cloudinary.com/lumi/image/upload/w_300,h_300,c_fill/${publicId}`;
```

✅ **Correct:**

```typescript
// Use Cloudinary SDK to generate URLs
const thumbnailUrl = cloudinary.url(publicId, {
  width: 300,
  height: 300,
  crop: "fill",
  quality: "auto:good",
  format: "auto",
});
```

### 5. No Lazy Loading

❌ **Wrong:**

```typescript
// All images load eagerly
{images.map(img => (
  <Image src={img.url} alt={img.alt} />
))}
```

✅ **Correct:**

```typescript
// Lazy load below-fold images
{images.map((img, index) => (
  <Image
    src={img.url}
    alt={img.alt}
    loading={index < 3 ? 'eager' : 'lazy'} // First 3 eager, rest lazy
    priority={index === 0} // LCP optimization
  />
))}
```

### 6. Missing Error Handling

❌ **Wrong:**

```typescript
// No error handling for Cloudinary failures
const result = await cloudinary.uploader.upload(filePath);
return result;
```

✅ **Correct:**

```typescript
// Proper error handling
try {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "lumi/products",
    eager: transformations,
  });
  return formatSuccess(result);
} catch (error) {
  logger.error("Cloudinary upload failed", { error, filePath });
  if (error.http_code === 420) {
    return formatError({ code: "RATE_LIMIT", message: "Upload rate limit exceeded" });
  }
  return formatError({ code: "UPLOAD_FAILED", message: "Image upload failed" });
}
```

### 7. No Orphan Cleanup

❌ **Wrong:**

```typescript
// Upload media but never clean up unused assets
// Result: Storage quota fills up with orphaned images
```

✅ **Correct:**

```typescript
// Daily cleanup job
cron.schedule("0 2 * * *", async () => {
  const orphans = await mediaRepository.findOrphans();
  for (const orphan of orphans) {
    if (isOlderThan(orphan.createdAt, 30, "days")) {
      await mediaService.softDelete(orphan.id);
      logger.info("Deleted orphan media", { id: orphan.id });
    }
  }
});
```

### 8. Missing Cache Headers

❌ **Wrong:**

```typescript
// No cache headers, CDN can't cache effectively
res.json({ url: imageUrl });
```

✅ **Correct:**

```typescript
// Set proper cache headers
res.set({
  "Cache-Control": "public, max-age=31536000, immutable",
  ETag: generateETag(imageUrl),
});
res.json({ url: imageUrl });
```

---

## 📦 DELIVERABLES

### 1. Backend Implementation

- ✅ Cloudinary SDK integration
- ✅ Media upload API with validation
- ✅ Media management endpoints (CRUD)
- ✅ Webhook handler for async processing
- ✅ Orphan cleanup job
- ✅ Signed upload signature endpoint
- ✅ Q2 format responses

### 2. Frontend Implementation

- ✅ MediaImage component (Next.js wrapper)
- ✅ MediaUploader component (drag & drop)
- ✅ MediaGallery component
- ✅ MediaManager admin page
- ✅ TanStack Query hooks
- ✅ Custom Cloudinary image loader
- ✅ Storybook stories

### 3. Database

- ✅ MediaAsset model in Prisma schema
- ✅ Relations to Product, ProductVariant, User
- ✅ Indexes for performance
- ✅ Migration files

### 4. Testing

- ✅ Unit tests (≥85% coverage)
- ✅ Integration tests
- ✅ Average/Error/Recovery tests
- ✅ Performance tests (LCP, TTFB)
- ✅ Security tests (S2/S3 validation)

### 5. Documentation

- ✅ OpenAPI spec for media endpoints
- ✅ Media runbook (`docs/ops/media-runbook.md`)
- ✅ Component documentation (Storybook)
- ✅ API usage examples
- ✅ Troubleshooting guide

### 6. Infrastructure

- ✅ Cloudinary account configured
- ✅ Upload presets created
- ✅ Webhook configured
- ✅ CDN caching setup
- ✅ Monitoring and alerts

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 5: Cloudinary Media System - Completion Report

## Implementation Summary

- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items

- [x] Total Items: 182/182 (100%)
- [x] Cloudinary Setup: 12/12
- [x] Upload Pipeline: 28/28
- [x] Asset Management: 18/18
- [x] Frontend Components: 32/32
- [x] Performance Optimization: 16/16
- [x] Testing: 24/24

## Metrics Achieved

- **Test Coverage**: X% (Target: ≥85%)
- **Upload Processing Time**: Xms P95 (Target: <5s)
- **LCP**: Xms (Target: <1.2s)
- **CDN Cache Hit Rate**: X% (Target: >85%)
- **P2 Compliance**: WebP ✅, AVIF ✅, Responsive ✅

## Cloudinary Statistics

- **Total Assets**: X
- **Storage Used**: X GB
- **Bandwidth (30 days)**: X GB
- **Transformations**: X

## Known Issues

- [List any known issues or technical debt]

## Next Phase Preparation

- Phase 6 dependencies ready: ✅
- Documentation complete: ✅
- Production deployment checklist: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 6: Next.js Foundation**

- Next.js 14 App Router setup
- Tailwind CSS + Design System
- shadcn/ui integration
- Layout system (auth, dashboard, public)
- State management (Zustand + TanStack Query)
- Animation system (Framer Motion + GSAP)

**Dependencies from Phase 5:**

- MediaImage component for product images ✅
- Cloudinary loader for Next.js Image ✅
- Media upload hooks for admin ✅
- Performance optimizations (WebP, lazy loading) ✅

---

**END OF PHASE 5 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-10-01_
