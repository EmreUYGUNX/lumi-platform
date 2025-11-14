# 🚀 PHASE 8.5: PRODUCT CUSTOMIZATION & DESIGN EDITOR

**Status**: ⏸️ **PENDING**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3, 4, 5, 8
**Estimated Time**: 14 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-11-14
**Phase Code**: PHASE-8.5
**Module Focus**: Advanced Product Customization & Interactive Design Editor
**Expected Lines of Code**: ~9,800 lines
**Test Coverage Target**: ≥85%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Interactive Canvas Editor** - Fabric.js powered design workspace with real-time preview
2. **Multi-Layer Design System** - Support for multiple designs, text layers, and effects
3. **Product Template System** - Admin-configurable design areas (front, back, sleeves, custom zones)
4. **Real-Time Preview Generation** - Cloudinary overlay API for instant product visualization
5. **Advanced Positioning Tools** - Drag, resize, rotate, align, layer ordering with precision
6. **Text Customization** - Custom text with font selection, colors, effects, and styling
7. **Design Library System** - Pre-made designs, clipart, and template marketplace
8. **Production-Ready Output** - High-resolution export for manufacturing with print specs
9. **Order Integration** - Seamless cart and checkout flow with design persistence
10. **Mobile-Optimized Editor** - Touch-friendly interface for mobile design creation

### Success Criteria

- ✅ Canvas editor with Fabric.js: drag, resize, rotate, layer management
- ✅ Real-time Cloudinary preview generation < 2s (P95)
- ✅ Multi-layer support: images, text, clipart (unlimited layers)
- ✅ Product templates: configurable design areas per product
- ✅ Text editor: 20+ fonts, colors, stroke, shadow, effects
- ✅ Design persistence: save/load designs, share designs via URL
- ✅ Mobile responsive: full editor on mobile with touch gestures
- ✅ Production export: 300 DPI PNG with transparent background
- ✅ Cart integration: design previews in cart, edit from cart
- ✅ Admin production dashboard: download production files
- ✅ Performance: 60 FPS canvas rendering, < 100ms interactions
- ✅ Test coverage ≥85% for editor logic
- ✅ Lighthouse Performance ≥85 for editor page

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Standards (P1/P2)

**P1: Editor Performance**

- Canvas rendering: 60 FPS minimum
- User interactions: < 100ms response time
- Preview generation: < 2s (P95)
- Design save/load: < 500ms
- Undo/redo operations: < 50ms
- Layer operations: < 100ms

**P2: Image Optimization**

- Customer design uploads: < 5MB, compressed to < 2MB
- Preview images: WebP/AVIF with Cloudinary optimization
- Production files: 300 DPI PNG, unlimited size
- Canvas textures: lazy loaded, progressive enhancement
- Thumbnail generation: < 500ms

**Performance Targets:**

```typescript
// P1: Canvas Performance
{
  fps: 60,                    // Smooth animations
  interactionDelay: 100,      // Max interaction lag
  previewGeneration: 2000,    // Preview render time (P95)
  canvasLoadTime: 1000,       // Initial canvas load
  layerOperations: 100        // Layer add/remove/reorder
}

// P2: Production Export
{
  exportResolution: 300,      // DPI for production
  maxFileSize: 50,           // MB for production files
  compressionQuality: 95,     // PNG compression
  transparentBackground: true // Required for printing
}
```

### Security Standards (S2/S3)

**S2: Upload Security**

- Customer design uploads: MIME whitelist (jpeg, png, svg)
- File size limits: 5MB for designs, 2MB for text images
- SVG sanitization: strip scripts, remove dangerous tags
- Rate limiting: 20 uploads per user per hour
- Malware scanning: ClamAV or Cloudinary scanning
- Filename sanitization: alphanumeric only

**S3: Design Ownership & Privacy**

- Design ownership: user_id tied to all designs
- Private designs: only owner can view/edit
- Public designs: shareable via unique URL
- RBAC enforcement: admin can view all, user only own
- Audit logging: all design operations logged
- Design deletion: soft delete with 30-day recovery

**S4: Production File Access**

- Production files: admin/staff only access
- Download logging: track who downloaded what
- Watermarking: preview images watermarked for non-paid orders
- Order verification: must have paid order to download production files

### API Standards (Q2)

**Design Upload Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "design_cm2x1y2z3",
    "publicId": "lumi/customer-designs/user123/abc456",
    "url": "https://res.cloudinary.com/.../design.png",
    "secureUrl": "https://res.cloudinary.com/.../design.png",
    "thumbnailUrl": "https://res.cloudinary.com/.../w_300,h_300/design.png",
    "format": "png",
    "width": 2000,
    "height": 2000,
    "bytes": 1245678,
    "userId": "user_abc123",
    "isPublic": false,
    "metadata": {
      "originalFilename": "my-design.png",
      "uploadedFrom": "canvas-editor",
      "backgroundColor": "transparent"
    }
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
    "requestId": "uuid-v4"
  }
}
```

**Preview Generation Response:**

```typescript
{
  "success": true,
  "data": {
    "previewId": "preview_xyz789",
    "previewUrl": "https://res.cloudinary.com/.../product-with-design.jpg",
    "productId": "product_abc",
    "designLayers": [
      {
        "layerId": "layer_1",
        "type": "image",
        "designId": "design_cm2x1y2z3",
        "position": { "x": 150, "y": 200, "width": 300, "height": 300, "rotation": 15 },
        "zIndex": 1
      },
      {
        "layerId": "layer_2",
        "type": "text",
        "text": "Custom Text",
        "font": "Helvetica",
        "fontSize": 48,
        "color": "#FFFFFF",
        "position": { "x": 150, "y": 100, "width": 300, "height": 60, "rotation": 0 },
        "zIndex": 2,
        "effects": {
          "stroke": { "width": 2, "color": "#000000" },
          "shadow": { "blur": 5, "offsetX": 2, "offsetY": 2, "color": "rgba(0,0,0,0.5)" }
        }
      }
    ],
    "designArea": "front",
    "resolution": "web",
    "timestamp": "2025-11-14T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
    "requestId": "uuid-v4"
  }
}
```

**Production Export Response:**

```typescript
{
  "success": true,
  "data": {
    "productionFileId": "prod_abc123",
    "highResUrl": "https://res.cloudinary.com/.../w_5000,dpr_3.0,q_100/production.png",
    "resolution": {
      "width": 5000,
      "height": 5000,
      "dpi": 300
    },
    "format": "png",
    "backgroundColor": "transparent",
    "bytes": 25678901,
    "orderId": "order_xyz",
    "designArea": "front",
    "printSpecifications": {
      "printMethod": "DTG",
      "colorProfile": "CMYK",
      "bleedArea": "5mm",
      "safeArea": "10mm"
    },
    "downloadUrl": "https://api.lumi.com/v1/production/download/prod_abc123",
    "expiresAt": "2025-11-21T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
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
│   ├── customization/
│   │   ├── customization.controller.ts      # HTTP handlers
│   │   ├── customization.service.ts         # Business logic
│   │   ├── customization.repository.ts      # Data access
│   │   ├── customization.validators.ts      # Zod schemas
│   │   ├── customization.router.ts          # Route definitions
│   │   └── __tests__/
│   │       ├── customization.unit.test.ts
│   │       ├── customization.integration.test.ts
│   │       └── customization.average.test.ts
│   ├── design/
│   │   ├── design.controller.ts             # Design CRUD
│   │   ├── design.service.ts                # Design operations
│   │   ├── design.repository.ts             # Design data access
│   │   ├── design.validators.ts             # Design schemas
│   │   ├── design.router.ts
│   │   └── __tests__/
│   ├── preview/
│   │   ├── preview.controller.ts            # Preview generation
│   │   ├── preview.service.ts               # Cloudinary overlay logic
│   │   ├── preview.repository.ts            # Preview caching
│   │   ├── preview.validators.ts
│   │   ├── preview.router.ts
│   │   └── __tests__/
│   └── production/
│       ├── production.controller.ts         # Production file management
│       ├── production.service.ts            # High-res export
│       ├── production.repository.ts
│       ├── production.validators.ts
│       ├── production.router.ts
│       └── __tests__/
├── integrations/
│   └── canvas/
│       ├── cloudinary-overlay.ts            # Cloudinary overlay API wrapper
│       ├── design-renderer.ts               # Server-side canvas rendering
│       ├── production-exporter.ts           # High-res export logic
│       └── __tests__/
├── jobs/
│   ├── design-cleanup.job.ts                # Orphan design cleanup
│   └── preview-cache-warmup.job.ts          # Popular product preview caching
└── webhooks/
    └── cloudinary-design.webhook.ts         # Design upload callbacks

apps/frontend/src/
├── features/
│   └── customization/
│       ├── components/
│       │   ├── editor/
│       │   │   ├── DesignCanvas.tsx         # Main Fabric.js canvas
│       │   │   ├── CanvasToolbar.tsx        # Top toolbar
│       │   │   ├── LayerPanel.tsx           # Layer management sidebar
│       │   │   ├── PropertiesPanel.tsx      # Selected layer properties
│       │   │   ├── DesignLibrary.tsx        # Design picker modal
│       │   │   ├── TextEditor.tsx           # Text customization panel
│       │   │   ├── ImageUploader.tsx        # Upload custom images
│       │   │   ├── TemplateSelector.tsx     # Pre-made templates
│       │   │   ├── GridOverlay.tsx          # Alignment grid
│       │   │   ├── RulerGuides.tsx          # Ruler and guides
│       │   │   ├── ZoomControls.tsx         # Zoom in/out/fit
│       │   │   ├── UndoRedoButtons.tsx      # History controls
│       │   │   ├── SaveDesignButton.tsx     # Save to library
│       │   │   └── ProductPreview.tsx       # Real-time preview
│       │   ├── tools/
│       │   │   ├── SelectTool.tsx           # Selection tool
│       │   │   ├── TextTool.tsx             # Text tool
│       │   │   ├── ImageTool.tsx            # Image tool
│       │   │   ├── ShapeTool.tsx            # Shape tool
│       │   │   ├── DrawingTool.tsx          # Free drawing
│       │   │   └── EraserTool.tsx           # Eraser
│       │   ├── modals/
│       │   │   ├── DesignEditorModal.tsx    # Full-screen editor modal
│       │   │   ├── SaveDesignModal.tsx      # Save design dialog
│       │   │   ├── LoadDesignModal.tsx      # Load saved designs
│       │   │   ├── ShareDesignModal.tsx     # Share design link
│       │   │   └── ExportOptionsModal.tsx   # Export settings
│       │   ├── product/
│       │   │   ├── ProductTemplateEditor.tsx # Admin: define design areas
│       │   │   ├── DesignAreaDrawer.tsx     # Draw design areas
│       │   │   ├── TemplatePreview.tsx      # Template preview
│       │   │   └── DesignAreaConfig.tsx     # Area settings
│       │   └── mobile/
│       │       ├── MobileEditor.tsx         # Mobile-optimized editor
│       │       ├── TouchControls.tsx        # Touch gestures
│       │       └── MobileToolbar.tsx        # Bottom toolbar
│       ├── hooks/
│       │   ├── useDesignCanvas.ts           # Canvas state management
│       │   ├── useCanvasLayers.ts           # Layer operations
│       │   ├── useCanvasHistory.ts          # Undo/redo
│       │   ├── useCanvasZoom.ts             # Zoom/pan controls
│       │   ├── useDesignUpload.ts           # Upload designs
│       │   ├── usePreviewGeneration.ts      # Generate previews
│       │   ├── useSaveDesign.ts             # Save design
│       │   ├── useLoadDesign.ts             # Load design
│       │   ├── useProductTemplate.ts        # Get product template
│       │   ├── useTextFormatting.ts         # Text styling
│       │   └── useDesignExport.ts           # Export logic
│       ├── utils/
│       │   ├── canvas-helpers.ts            # Canvas utility functions
│       │   ├── layer-serializer.ts          # Serialize/deserialize layers
│       │   ├── position-calculator.ts       # Position calculations
│       │   ├── snap-to-grid.ts              # Grid snapping
│       │   ├── alignment-guides.ts          # Smart guides
│       │   └── export-renderer.ts           # Export rendering
│       ├── store/
│       │   ├── canvas.store.ts              # Zustand canvas state
│       │   ├── editor.store.ts              # Editor UI state
│       │   └── design-library.store.ts      # Design library state
│       ├── types/
│       │   ├── canvas.types.ts              # Canvas types
│       │   ├── layer.types.ts               # Layer types
│       │   ├── design.types.ts              # Design types
│       │   └── template.types.ts            # Template types
│       └── __tests__/
│           ├── canvas.test.tsx
│           ├── layers.test.tsx
│           └── preview.test.tsx

packages/shared/src/
├── customization/
│   ├── customization.dto.ts                 # DTOs
│   ├── customization.validators.ts          # Zod schemas
│   ├── customization.types.ts               # Shared types
│   ├── design.dto.ts
│   ├── design.validators.ts
│   ├── design.types.ts
│   ├── preview.dto.ts
│   └── preview.types.ts
└── testing/
    └── customization/
        ├── fixtures.ts                      # Test fixtures
        ├── mock-canvas.ts                   # Mock Fabric.js
        └── mock-designs.ts                  # Sample designs

prisma/schema.prisma
# Customization models addition
```

### Database Schema

```prisma
// Product customization configuration
model ProductCustomization {
  id              String   @id @default(cuid())
  productId       String   @unique
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  // Customization settings
  enabled         Boolean  @default(false)
  designAreas     Json     // [{name: "front", x, y, width, height, rotation, minSize, maxSize}]
  maxLayers       Int      @default(10)
  allowImages     Boolean  @default(true)
  allowText       Boolean  @default(true)
  allowShapes     Boolean  @default(false)
  allowDrawing    Boolean  @default(false)

  // Constraints
  minImageSize    Int?     // Minimum image dimension (px)
  maxImageSize    Int?     // Maximum image dimension (px)
  allowedFonts    String[] // Font whitelist

  // Pricing
  basePriceModifier Decimal @default(0) @db.Decimal(10, 2)
  pricePerLayer     Decimal @default(0) @db.Decimal(10, 2)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("product_customizations")
}

// Customer uploaded designs
model CustomerDesign {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Image data
  publicId        String   @unique // Cloudinary public_id
  url             String
  secureUrl       String
  thumbnailUrl    String
  format          String
  width           Int
  height          Int
  bytes           Int

  // Metadata
  originalFilename String?
  isPublic        Boolean  @default(false)
  tags            String[]

  // Usage tracking
  usageCount      Int      @default(0)

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  designSessions  DesignSession[]
  orderCustomizations OrderItemCustomization[]

  @@index([userId])
  @@index([isPublic])
  @@index([deletedAt])
  @@map("customer_designs")
}

// Design session (workspace)
model DesignSession {
  id              String   @id @default(cuid())
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  designArea      String   // "front", "back", "sleeve", etc.

  // Session data
  sessionData     Json     // Full canvas state (layers, positions, etc.)
  previewUrl      String?  // Last generated preview

  // Sharing
  shareToken      String?  @unique // For public sharing
  isPublic        Boolean  @default(false)

  // Session state
  lastEditedAt    DateTime @default(now())
  expiresAt       DateTime // Auto-expire after 30 days

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  designs         CustomerDesign[]

  @@index([userId])
  @@index([productId])
  @@index([shareToken])
  @@index([expiresAt])
  @@map("design_sessions")
}

// Order item customization
model OrderItemCustomization {
  id              String    @id @default(cuid())
  orderItemId     String    @unique
  orderItem       OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  productId       String
  product         Product   @relation(fields: [productId], references: [id])

  designArea      String    // Which area was customized

  // Design data (serialized canvas state)
  designData      Json      // Full layer data

  // Preview URLs
  previewUrl      String    // Web preview (optimized)
  thumbnailUrl    String    // Small thumbnail for cart/admin

  // Production files
  productionFileUrl String? // High-res production file
  productionDPI     Int     @default(300)
  productionGenerated Boolean @default(false)

  // Metadata
  layerCount      Int       @default(0)
  hasImages       Boolean   @default(false)
  hasText         Boolean   @default(false)

  // Design references
  customerDesigns CustomerDesign[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([orderItemId])
  @@index([productId])
  @@index([productionGenerated])
  @@map("order_item_customizations")
}

// Pre-made design templates
model DesignTemplate {
  id              String   @id @default(cuid())

  // Template info
  name            String
  description     String?
  category        String   // "text", "graphics", "patterns", "holiday", etc.
  tags            String[]

  // Template data
  templateData    Json     // Pre-configured layers
  thumbnailUrl    String
  previewUrl      String

  // Pricing
  isFree          Boolean  @default(true)
  price           Decimal? @db.Decimal(10, 2)

  // Visibility
  isPublic        Boolean  @default(true)
  isFeatured      Boolean  @default(false)

  // Stats
  usageCount      Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([category])
  @@index([isPublic])
  @@index([isFeatured])
  @@map("design_templates")
}

// Clipart library
model ClipartAsset {
  id              String   @id @default(cuid())

  // Asset info
  name            String
  description     String?
  category        String   // "animals", "shapes", "icons", "holiday", etc.
  tags            String[]

  // Image data
  publicId        String   @unique
  url             String
  thumbnailUrl    String
  svgUrl          String?  // Optional vector version

  // Dimensions
  width           Int
  height          Int

  // Licensing
  isFree          Boolean  @default(true)
  licenseType     String?  // "commercial", "personal", "attribution"
  attribution     String?

  // Stats
  usageCount      Int      @default(0)

  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([category])
  @@index([isActive])
  @@map("clipart_assets")
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: Customization Configuration API (24 items)

#### 1.1 Product Customization Settings

- [ ] Add `ProductCustomization` model to Prisma schema
- [ ] Run migration: `pnpm prisma migrate dev --name add-product-customization`
- [ ] Create `customization.repository.ts`
  - [ ] `findByProductId(productId)` - Get product customization config
  - [ ] `create(data)` - Create customization config
  - [ ] `update(productId, data)` - Update config
  - [ ] `delete(productId)` - Remove config
- [ ] Create `customization.service.ts`
  - [ ] `getProductCustomization(productId)` - Get config with validation
  - [ ] `enableCustomization(productId, config)` - Enable for product
  - [ ] `updateDesignAreas(productId, areas)` - Update design areas
  - [ ] `validateDesignAreaCoordinates(areas)` - Validate area definitions
- [ ] Create `customization.controller.ts`
  - [ ] `GET /api/v1/products/:id/customization` - Get config
  - [ ] `POST /api/v1/admin/products/:id/customization` - Create/enable (admin)
  - [ ] `PUT /api/v1/admin/products/:id/customization` - Update (admin)
  - [ ] `DELETE /api/v1/admin/products/:id/customization` - Disable (admin)
- [ ] Create Zod validation schemas
  - [ ] `ProductCustomizationConfigSchema` - Full config
  - [ ] `DesignAreaSchema` - Single design area
  - [ ] `CustomizationConstraintsSchema` - Limits and rules

#### 1.2 Design Area Configuration

- [ ] Create `DesignAreaDTO`

```typescript
interface DesignArea {
  name: string; // "front", "back", "left-sleeve"
  x: number; // Position on product image (px)
  y: number;
  width: number; // Design area dimensions (px)
  height: number;
  rotation: number; // Area rotation (degrees)
  minDesignSize: number; // Min design dimension (px)
  maxDesignSize: number; // Max design dimension (px)
  aspectRatio?: number; // Enforce aspect ratio (optional)
  allowResize: boolean; // Allow user to resize design
  allowRotation: boolean; // Allow user to rotate design
}
```

- [ ] Add validation for design area overlap detection
- [ ] Add validation for design area boundaries (within product image)
- [ ] Create helper functions:
  - [ ] `isPointInDesignArea(x, y, area)` - Check if point is in area
  - [ ] `areAreasOverlapping(area1, area2)` - Check area overlap
  - [ ] `getDesignAreaBounds(area)` - Calculate absolute bounds

---

### 2. Backend: Customer Design Upload API (32 items)

#### 2.1 Design Upload Endpoint

- [ ] Add `CustomerDesign` model to Prisma schema
- [ ] Create `design.repository.ts`
  - [ ] `create(data)` - Save design metadata
  - [ ] `findById(id)` - Get design by ID
  - [ ] `findByUserId(userId, filters)` - Get user's designs
  - [ ] `updateUsageCount(id)` - Increment usage
  - [ ] `softDelete(id)` - Soft delete design
  - [ ] `findPublic(filters)` - Get public designs
- [ ] Create `design.service.ts`
  - [ ] `uploadDesign(file, userId, metadata)` - Upload to Cloudinary
  - [ ] `getDesign(id, userId)` - Get with auth check
  - [ ] `getUserDesigns(userId, pagination)` - List user designs
  - [ ] `deleteDesign(id, userId)` - Delete with auth check
  - [ ] `shareDesign(id, userId)` - Make design public
  - [ ] `validateDesignFile(file)` - Validate upload

#### 2.2 Upload Implementation

- [ ] Create `POST /api/v1/designs/upload` endpoint
  - [ ] Accept multipart/form-data
  - [ ] Validate file type (jpeg, png, svg)
  - [ ] Validate file size (< 5MB)
  - [ ] Compress image if > 2MB (Sharp)
  - [ ] Upload to Cloudinary folder: `lumi/customer-designs/{userId}/`
  - [ ] Generate thumbnail (300x300)
  - [ ] Extract metadata (width, height, dominant colors)
  - [ ] Save to database
  - [ ] Return Q2 formatted response

#### 2.3 SVG Sanitization (Security)

- [ ] Install `svg-sanitizer`: `pnpm add svg-sanitizer`
- [ ] Create SVG sanitization middleware
  - [ ] Strip `<script>` tags
  - [ ] Remove `onclick`, `onerror` attributes
  - [ ] Whitelist allowed SVG elements
  - [ ] Remove external references
- [ ] Test XSS prevention with malicious SVG
- [ ] Log sanitization events for security audit

#### 2.4 Design Management Endpoints

- [ ] `GET /api/v1/designs` - List user's designs
  - [ ] Pagination (default 24)
  - [ ] Filter by tags
  - [ ] Sort by created date, usage count
  - [ ] Include thumbnail URLs
- [ ] `GET /api/v1/designs/:id` - Get single design
  - [ ] Verify ownership or public access
  - [ ] Return full metadata
  - [ ] Increment view count
- [ ] `PUT /api/v1/designs/:id` - Update design
  - [ ] Update tags
  - [ ] Toggle public/private
  - [ ] Update metadata
- [ ] `DELETE /api/v1/designs/:id` - Delete design
  - [ ] Soft delete
  - [ ] Check if used in active orders
  - [ ] Remove from Cloudinary after 30 days

---

### 3. Backend: Preview Generation API (38 items)

#### 3.1 Cloudinary Overlay Implementation

- [ ] Create `cloudinary-overlay.ts` integration
  - [ ] `generateLayeredPreview(config)` - Multi-layer overlay
  - [ ] `applyTextOverlay(text, style, position)` - Text layers
  - [ ] `applyImageOverlay(imageId, transform, position)` - Image layers
  - [ ] `compositeMultipleLayers(layers)` - Combine all layers
  - [ ] `optimizeForWeb(url)` - WebP, quality, size optimization

#### 3.2 Preview Service

- [ ] Create `preview.service.ts`
  - [ ] `generatePreview(productId, designData, area)` - Main preview generator
  - [ ] `buildCloudinaryTransformation(layers)` - Build transformation chain
  - [ ] `cachePreview(previewId, url, ttl)` - Cache in Redis
  - [ ] `getCachedPreview(previewId)` - Retrieve from cache
  - [ ] `invalidatePreviewCache(productId)` - Clear cache on product update

#### 3.3 Layer Transformation Logic

- [ ] Support image layers:

```typescript
// Cloudinary transformation for image layer
{
  overlay: designPublicId,
  width: layerWidth,
  height: layerHeight,
  x: layerX,
  y: layerY,
  angle: layerRotation,
  gravity: 'north_west',
  opacity: layerOpacity,
  effect: layerEffects // blur, shadow, etc.
}
```

- [ ] Support text layers:

```typescript
// Cloudinary transformation for text layer
{
  overlay: {
    text: layerText,
    font_family: layerFont,
    font_size: layerFontSize,
    font_weight: layerFontWeight,
    letter_spacing: layerLetterSpacing
  },
  color: layerColor,
  x: layerX,
  y: layerY,
  angle: layerRotation,
  gravity: 'north_west'
}
```

- [ ] Support layer effects:
  - [ ] Drop shadow: `e_shadow:azimuth_315,elevation_45`
  - [ ] Stroke/outline: `co_rgb:000000,e_outline:5`
  - [ ] Opacity: `o_80`
  - [ ] Blur: `e_blur:300`
  - [ ] Brightness: `e_brightness:50`
  - [ ] Contrast: `e_contrast:20`

#### 3.4 Preview Endpoints

- [ ] `POST /api/v1/previews/generate` - Generate preview
  - [ ] Accept product ID, design layers, design area
  - [ ] Validate layer data structure
  - [ ] Generate Cloudinary URL with transformations
  - [ ] Cache preview URL (5min TTL)
  - [ ] Return preview URL and metadata
  - [ ] Rate limit: 60 requests/min per user

- [ ] `GET /api/v1/previews/:id` - Get cached preview
  - [ ] Return cached preview URL
  - [ ] Refresh cache if near expiry
  - [ ] Return 404 if expired

- [ ] `POST /api/v1/previews/batch` - Batch preview generation
  - [ ] Generate multiple previews (up to 10)
  - [ ] Parallel generation
  - [ ] Return array of preview URLs

#### 3.5 Preview Optimization

- [ ] Implement debouncing for live preview
  - [ ] Debounce preview requests (1s)
  - [ ] Cancel pending requests on new input
  - [ ] Show loading state during generation
- [ ] Implement preview caching strategy
  - [ ] Cache key: `preview:${productId}:${designHash}`
  - [ ] TTL: 5 minutes for web preview
  - [ ] Invalidate on product image update
- [ ] Add preview quality tiers
  - [ ] `draft`: Low quality for live editing (q_60, w_800)
  - [ ] `web`: Medium quality for display (q_80, w_1200)
  - [ ] `production`: High quality for print (q_100, w_5000)

---

### 4. Backend: Production File Export API (28 items)

#### 4.1 High-Resolution Export

- [ ] Create `production.service.ts`
  - [ ] `generateProductionFile(orderItemId)` - Generate 300 DPI export
  - [ ] `buildProductionTransformation(layers)` - High-res transformations
  - [ ] `addPrintSpecifications(config)` - Add bleed, safe areas
  - [ ] `convertColorProfile(imageUrl, profile)` - RGB to CMYK
  - [ ] `addProductionMetadata(file)` - Embed print metadata

#### 4.2 Production File Configuration

```typescript
interface ProductionFileConfig {
  resolution: {
    dpi: 300;
    width: 5000; // Target width in pixels
    height: 5000;
  };
  format: "png";
  backgroundColor: "transparent";
  colorProfile: "CMYK";
  printMethod: "DTG" | "Screen" | "Embroidery";
  bleedArea: "5mm";
  safeArea: "10mm";
  quality: 100;
}
```

#### 4.3 Production Endpoints

- [ ] `POST /api/v1/admin/production/generate` - Generate production file (admin)
  - [ ] Verify order is paid
  - [ ] Get order item customization
  - [ ] Generate 300 DPI file
  - [ ] Add production metadata
  - [ ] Store production file URL
  - [ ] Update `productionGenerated` flag
  - [ ] Return download URL

- [ ] `GET /api/v1/admin/production/download/:id` - Download production file
  - [ ] Verify admin/staff role
  - [ ] Log download (audit trail)
  - [ ] Return pre-signed download URL
  - [ ] URL expires in 24 hours

- [ ] `GET /api/v1/admin/production/order/:orderId` - Get all production files for order
  - [ ] List all customized items
  - [ ] Return production file URLs
  - [ ] Include print specifications
  - [ ] Batch download option

#### 4.4 Production File Metadata

- [ ] Embed EXIF data:
  - [ ] Order ID
  - [ ] Order date
  - [ ] Customer name (optional)
  - [ ] Design area
  - [ ] Print specifications
  - [ ] Color profile
- [ ] Generate production manifest JSON

```json
{
  "orderId": "order_abc123",
  "orderDate": "2025-11-14",
  "customizations": [
    {
      "productName": "White T-Shirt",
      "designArea": "front",
      "productionFile": "url",
      "printMethod": "DTG",
      "resolution": "5000x5000@300dpi",
      "colorProfile": "CMYK",
      "bleed": "5mm",
      "safeArea": "10mm"
    }
  ]
}
```

---

### 5. Backend: Design Session Management (22 items)

#### 5.1 Session Persistence

- [ ] Add `DesignSession` model to Prisma schema
- [ ] Create `session.repository.ts`
  - [ ] `create(data)` - Create session
  - [ ] `findById(id)` - Get session
  - [ ] `findByUserId(userId)` - Get user sessions
  - [ ] `update(id, data)` - Update session data
  - [ ] `delete(id)` - Delete session
  - [ ] `cleanupExpired()` - Remove expired sessions

#### 5.2 Session Save/Load

- [ ] `POST /api/v1/sessions/save` - Save design session
  - [ ] Serialize canvas state to JSON
  - [ ] Store in database
  - [ ] Generate preview thumbnail
  - [ ] Return session ID
  - [ ] Auto-save every 60s

- [ ] `GET /api/v1/sessions/:id` - Load design session
  - [ ] Verify ownership or public access
  - [ ] Return full canvas state
  - [ ] Deserialize layer data
  - [ ] Return preview thumbnail

- [ ] `GET /api/v1/sessions` - List user sessions
  - [ ] Pagination
  - [ ] Filter by product
  - [ ] Sort by lastEditedAt
  - [ ] Return thumbnails

- [ ] `DELETE /api/v1/sessions/:id` - Delete session
  - [ ] Verify ownership
  - [ ] Soft delete
  - [ ] Keep for 7 days for recovery

#### 5.3 Session Sharing

- [ ] `POST /api/v1/sessions/:id/share` - Generate share link
  - [ ] Generate unique share token
  - [ ] Set isPublic = true
  - [ ] Return shareable URL: `/editor/shared/:token`
  - [ ] Set expiration (30 days)

- [ ] `GET /api/v1/sessions/shared/:token` - Load shared session
  - [ ] Verify token validity
  - [ ] Check expiration
  - [ ] Return read-only canvas state
  - [ ] Increment view count

---

### 6. Frontend: Canvas Editor Core (54 items)

#### 6.1 Fabric.js Setup

- [ ] Install Fabric.js: `pnpm add fabric @types/fabric`
- [ ] Create Fabric.js wrapper utilities
  - [ ] `initializeCanvas(containerId, options)` - Create canvas instance
  - [ ] `disposeCanvas(canvas)` - Cleanup canvas
  - [ ] `setCanvasBackground(canvas, imageUrl)` - Set product image
  - [ ] `configureCanvasDefaults(canvas)` - Default settings

#### 6.2 DesignCanvas Component

- [ ] Create `src/features/customization/components/editor/DesignCanvas.tsx`

```typescript
interface DesignCanvasProps {
  productImageUrl: string;
  designArea: DesignArea;
  initialLayers?: Layer[];
  onLayerChange: (layers: Layer[]) => void;
  onSelectionChange: (layer: Layer | null) => void;
  readOnly?: boolean;
}
```

- [ ] Initialize Fabric.js canvas
  - [ ] Create canvas element
  - [ ] Set canvas size based on design area
  - [ ] Load product image as background
  - [ ] Configure canvas interaction modes
  - [ ] Setup event listeners

- [ ] Canvas configuration
  - [ ] Enable object selection
  - [ ] Enable multi-select (with Shift)
  - [ ] Configure snap to grid (optional)
  - [ ] Set canvas bounds (design area limits)
  - [ ] Configure object controls (corner handles)

- [ ] Render loop optimization
  - [ ] Use requestAnimationFrame
  - [ ] Throttle canvas updates
  - [ ] Batch multiple operations
  - [ ] Lazy render when not interacting

#### 6.3 Layer Management System

- [ ] Create `useCanvasLayers` hook

```typescript
const useCanvasLayers = (canvas: fabric.Canvas | null) => {
  const [layers, setLayers] = useState<Layer[]>([]);

  const addLayer = (layer: Layer) => {
    /* ... */
  };
  const removeLayer = (layerId: string) => {
    /* ... */
  };
  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    /* ... */
  };
  const reorderLayers = (fromIndex: number, toIndex: number) => {
    /* ... */
  };
  const duplicateLayer = (layerId: string) => {
    /* ... */
  };
  const lockLayer = (layerId: string, locked: boolean) => {
    /* ... */
  };
  const hideLayer = (layerId: string, hidden: boolean) => {
    /* ... */
  };

  return {
    layers,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    duplicateLayer,
    lockLayer,
    hideLayer,
  };
};
```

- [ ] Layer types implementation
  - [ ] `ImageLayer` - Customer uploaded images
  - [ ] `TextLayer` - Custom text with formatting
  - [ ] `ShapeLayer` - Rectangles, circles, polygons
  - [ ] `ClipartLayer` - Pre-made clipart
  - [ ] `GroupLayer` - Grouped objects

- [ ] Layer serialization
  - [ ] `serializeLayer(fabricObject)` - Convert to JSON
  - [ ] `deserializeLayer(layerData)` - Restore from JSON
  - [ ] Handle custom properties
  - [ ] Preserve transformations

#### 6.4 Layer Panel Component

- [ ] Create `LayerPanel.tsx`
  - [ ] List all layers
  - [ ] Show layer thumbnails
  - [ ] Display layer names
  - [ ] Show layer type icons
  - [ ] Visibility toggle (eye icon)
  - [ ] Lock toggle (lock icon)
  - [ ] Drag-and-drop reordering
  - [ ] Layer selection (highlight)
  - [ ] Right-click context menu
    - [ ] Duplicate
    - [ ] Delete
    - [ ] Bring to front
    - [ ] Send to back
    - [ ] Lock/unlock
    - [ ] Show/hide

---

### 7. Frontend: Canvas Toolbar & Tools (46 items)

#### 7.1 Main Toolbar Component

- [ ] Create `CanvasToolbar.tsx`
  - [ ] Tool selection buttons
  - [ ] Undo button
  - [ ] Redo button
  - [ ] Zoom controls
  - [ ] Grid toggle
  - [ ] Snap to grid toggle
  - [ ] Alignment tools
  - [ ] Save button
  - [ ] Export button

#### 7.2 Selection Tool

- [ ] Create `SelectTool.tsx`
  - [ ] Click to select objects
  - [ ] Drag to move
  - [ ] Corner handles for resize
  - [ ] Rotation handle
  - [ ] Multi-select with Shift
  - [ ] Box selection
  - [ ] Show bounding box
  - [ ] Show transform controls

#### 7.3 Text Tool

- [ ] Create `TextTool.tsx`
  - [ ] Click to add text
  - [ ] Inline text editing
  - [ ] Font selector (dropdown)
    - [ ] Load 20+ Google Fonts
    - [ ] Font preview in dropdown
    - [ ] Recently used fonts
  - [ ] Font size slider (8-200px)
  - [ ] Font weight selector
  - [ ] Text alignment (left, center, right)
  - [ ] Letter spacing slider
  - [ ] Line height slider
  - [ ] Text color picker
  - [ ] Text effects panel
    - [ ] Stroke (outline)
      - [ ] Stroke width slider
      - [ ] Stroke color picker
    - [ ] Shadow
      - [ ] Shadow blur slider
      - [ ] Shadow offset X/Y
      - [ ] Shadow color picker
    - [ ] Text transform (uppercase, lowercase, capitalize)

#### 7.4 Image Upload Tool

- [ ] Create `ImageUploader.tsx`
  - [ ] Drag & drop zone
  - [ ] File picker button
  - [ ] File validation (5MB, jpeg/png/svg)
  - [ ] Image compression (if > 2MB)
  - [ ] Upload progress bar
  - [ ] Success animation
  - [ ] Error handling
  - [ ] Add to canvas after upload
  - [ ] Auto-center on canvas
  - [ ] Fit to design area

#### 7.5 Design Library Tool

- [ ] Create `DesignLibrary.tsx` modal
  - [ ] Tab: My Designs
    - [ ] Grid of user uploaded designs
    - [ ] Search/filter
    - [ ] Click to add to canvas
  - [ ] Tab: Clipart
    - [ ] Category selector
    - [ ] Grid of clipart assets
    - [ ] Search by keyword
    - [ ] Free/paid indicator
    - [ ] Click to add to canvas
  - [ ] Tab: Templates
    - [ ] Pre-made design templates
    - [ ] Category filter
    - [ ] Preview on hover
    - [ ] Click to load template
  - [ ] Pagination
  - [ ] Lazy loading images

---

### 8. Frontend: Advanced Canvas Features (38 items)

#### 8.1 Undo/Redo System

- [ ] Create `useCanvasHistory` hook

```typescript
const useCanvasHistory = (canvas: fabric.Canvas | null) => {
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [historyStep, setHistoryStep] = useState(0);

  const saveState = () => {
    /* ... */
  };
  const undo = () => {
    /* ... */
  };
  const redo = () => {
    /* ... */
  };
  const clearHistory = () => {
    /* ... */
  };

  return { canUndo, canRedo, undo, redo };
};
```

- [ ] Implement state snapshots
  - [ ] Snapshot on layer add/remove
  - [ ] Snapshot on layer transform
  - [ ] Snapshot on layer style change
  - [ ] Throttle snapshots (max 1 per 500ms)
  - [ ] Limit history size (50 states)

- [ ] Keyboard shortcuts
  - [ ] Ctrl+Z: Undo
  - [ ] Ctrl+Shift+Z: Redo
  - [ ] Ctrl+Y: Redo (alternative)

#### 8.2 Zoom & Pan Controls

- [ ] Create `useCanvasZoom` hook
  - [ ] `zoomIn()` - Zoom in (10% increment)
  - [ ] `zoomOut()` - Zoom out (10% decrement)
  - [ ] `zoomToFit()` - Fit canvas to viewport
  - [ ] `zoomToActualSize()` - 100% zoom
  - [ ] `zoomToSelection()` - Zoom to selected object
  - [ ] Mouse wheel zoom
  - [ ] Pinch zoom (mobile)
  - [ ] Pan with Space + drag
  - [ ] Pan with two-finger drag (mobile)

- [ ] Zoom level indicator
  - [ ] Display current zoom (25%, 50%, 100%, 200%)
  - [ ] Dropdown for preset zoom levels
  - [ ] Custom zoom input

#### 8.3 Alignment & Distribution

- [ ] Create alignment tools
  - [ ] Align left
  - [ ] Align center horizontally
  - [ ] Align right
  - [ ] Align top
  - [ ] Align center vertically
  - [ ] Align bottom
  - [ ] Distribute horizontally
  - [ ] Distribute vertically
  - [ ] Work with multiple selections

#### 8.4 Smart Guides & Snapping

- [ ] Create `alignment-guides.ts`
  - [ ] Show guides when aligning to other objects
  - [ ] Show guides when aligning to canvas center
  - [ ] Show guides when aligning to design area bounds
  - [ ] Snap to guides (with threshold)
  - [ ] Guide line colors (magenta for alignment)

- [ ] Create `snap-to-grid.ts`
  - [ ] Overlay grid on canvas
  - [ ] Configurable grid size
  - [ ] Snap object positions to grid
  - [ ] Snap object sizes to grid
  - [ ] Toggle grid visibility

#### 8.5 Keyboard Shortcuts

- [ ] Implement keyboard controls
  - [ ] Delete: Remove selected
  - [ ] Ctrl+C: Copy
  - [ ] Ctrl+V: Paste
  - [ ] Ctrl+X: Cut
  - [ ] Ctrl+D: Duplicate
  - [ ] Ctrl+A: Select all
  - [ ] Arrow keys: Move 1px
  - [ ] Shift+Arrow: Move 10px
  - [ ] Esc: Deselect
  - [ ] +/-: Zoom in/out

---

### 9. Frontend: Properties Panel (32 items)

#### 9.1 Properties Panel Component

- [ ] Create `PropertiesPanel.tsx`
  - [ ] Conditionally show based on selected layer
  - [ ] Different panels for different layer types
  - [ ] Position & size inputs
  - [ ] Rotation slider
  - [ ] Opacity slider
  - [ ] Layer name input
  - [ ] Lock toggle
  - [ ] Visibility toggle

#### 9.2 Image Layer Properties

- [ ] Position controls
  - [ ] X position input (numeric)
  - [ ] Y position input (numeric)
  - [ ] Width input (with lock aspect ratio)
  - [ ] Height input (with lock aspect ratio)
  - [ ] Rotation slider (-180 to 180)
- [ ] Image adjustments
  - [ ] Opacity slider (0-100%)
  - [ ] Brightness slider (-100 to 100)
  - [ ] Contrast slider (-100 to 100)
  - [ ] Saturation slider (-100 to 100)
  - [ ] Blur slider (0-20)
- [ ] Filters (optional)
  - [ ] Grayscale toggle
  - [ ] Sepia toggle
  - [ ] Invert toggle

#### 9.3 Text Layer Properties

- [ ] Typography controls
  - [ ] Font family dropdown
  - [ ] Font size input
  - [ ] Font weight selector
  - [ ] Text alignment buttons
  - [ ] Letter spacing slider
  - [ ] Line height slider
- [ ] Text color
  - [ ] Color picker
  - [ ] Recent colors
  - [ ] Eyedropper tool
- [ ] Text effects
  - [ ] Stroke toggle
    - [ ] Stroke width
    - [ ] Stroke color
  - [ ] Shadow toggle
    - [ ] Shadow blur
    - [ ] Shadow offset X
    - [ ] Shadow offset Y
    - [ ] Shadow color
  - [ ] Background fill toggle
    - [ ] Background color
    - [ ] Background padding

#### 9.4 Transform Controls

- [ ] Flip buttons
  - [ ] Flip horizontal
  - [ ] Flip vertical
- [ ] Rotation presets
  - [ ] Rotate 90° CW
  - [ ] Rotate 90° CCW
  - [ ] Rotate 180°
- [ ] Reset transforms button

---

### 10. Frontend: Product Preview & Real-Time Updates (26 items)

#### 10.1 Product Preview Component

- [ ] Create `ProductPreview.tsx`
  - [ ] Display product with design overlay
  - [ ] Real-time updates on canvas change
  - [ ] Loading state during preview generation
  - [ ] Error state with retry button
  - [ ] Zoom preview on hover
  - [ ] Toggle between design areas (front/back)
  - [ ] Responsive sizing

#### 10.2 Preview Generation Hook

- [ ] Create `usePreviewGeneration` hook

```typescript
const usePreviewGeneration = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePreview = useMutation({
    mutationFn: async (designData: DesignData) => {
      // Serialize canvas state
      const layers = serializeLayers(designData.canvas);

      // Call preview API
      const response = await apiClient.post("/previews/generate", {
        productId: designData.productId,
        designArea: designData.designArea,
        layers: layers,
      });

      return response.data.data.previewUrl;
    },
    onSuccess: (url) => {
      setPreviewUrl(url);
    },
  });

  // Debounced preview generation
  const debouncedGenerate = useMemo(
    () => debounce(generatePreview.mutate, 1000),
    [generatePreview],
  );

  return { previewUrl, isGenerating, generatePreview: debouncedGenerate };
};
```

- [ ] Implement debouncing (1s delay)
- [ ] Cancel pending requests on new changes
- [ ] Show loading indicator
- [ ] Cache generated previews
- [ ] Retry on failure (max 3 attempts)

#### 10.3 Canvas Change Detection

- [ ] Listen to Fabric.js events
  - [ ] `object:added`
  - [ ] `object:removed`
  - [ ] `object:modified`
  - [ ] `object:moving`
  - [ ] `object:scaling`
  - [ ] `object:rotating`
- [ ] Throttle change events (100ms)
- [ ] Trigger preview generation on change
- [ ] Show draft preview during editing (low quality)
- [ ] Generate high-quality preview on save

---

### 11. Frontend: Mobile Editor Experience (34 items)

#### 11.1 Mobile-Optimized Layout

- [ ] Create `MobileEditor.tsx`
  - [ ] Full-screen canvas
  - [ ] Bottom toolbar (fixed)
  - [ ] Collapsible panels
  - [ ] Gesture-friendly controls
  - [ ] Landscape mode support
  - [ ] Portrait mode support

#### 11.2 Touch Gestures

- [ ] Create `TouchControls.tsx`
  - [ ] Single tap: Select object
  - [ ] Double tap: Edit text
  - [ ] Pinch: Zoom in/out
  - [ ] Two-finger rotate: Rotate object
  - [ ] Two-finger pan: Pan canvas
  - [ ] Long press: Context menu
  - [ ] Swipe: Switch tools

#### 11.3 Mobile Toolbar

- [ ] Create `MobileToolbar.tsx`
  - [ ] Bottom sheet design
  - [ ] Tool icons (larger touch targets)
  - [ ] Collapsible tool groups
  - [ ] Quick actions:
    - [ ] Undo
    - [ ] Redo
    - [ ] Delete
    - [ ] Duplicate
  - [ ] Expandable panels:
    - [ ] Text properties
    - [ ] Image properties
    - [ ] Layer list

#### 11.4 Mobile Interactions

- [ ] Implement mobile-friendly controls
  - [ ] Larger resize handles (24px min)
  - [ ] Simplified rotation (snap to 15° increments)
  - [ ] One-finger object movement
  - [ ] Tap-to-select with visual feedback
  - [ ] Vibration feedback on actions
  - [ ] Toast notifications for feedback

#### 11.5 Mobile Performance

- [ ] Optimize canvas for mobile
  - [ ] Reduce canvas resolution for lower-end devices
  - [ ] Lazy load design library images
  - [ ] Compress uploaded images aggressively
  - [ ] Limit max layers (10 on mobile)
  - [ ] Disable heavy effects on mobile
  - [ ] Use hardware acceleration

---

### 12. Frontend: Save & Load Design (28 items)

#### 12.1 Save Design Modal

- [ ] Create `SaveDesignModal.tsx`
  - [ ] Design name input
  - [ ] Privacy selector (private/public)
  - [ ] Tags input (comma-separated)
  - [ ] Auto-save toggle
  - [ ] Save button
  - [ ] Cancel button

#### 12.2 Save Design Hook

- [ ] Create `useSaveDesign` hook

```typescript
const useSaveDesign = () => {
  const saveDesign = useMutation({
    mutationFn: async (designData: SaveDesignData) => {
      // Serialize canvas state
      const canvasState = canvas.toJSON([
        "id",
        "layerId",
        "layerType",
        "lockMovementX",
        "lockMovementY",
      ]);

      // Generate thumbnail
      const thumbnail = canvas.toDataURL({
        format: "png",
        quality: 0.8,
        multiplier: 0.3,
      });

      // Save to API
      const response = await apiClient.post("/sessions/save", {
        productId: designData.productId,
        designArea: designData.designArea,
        sessionData: canvasState,
        thumbnail: thumbnail,
        name: designData.name,
        isPublic: designData.isPublic,
        tags: designData.tags,
      });

      return response.data.data;
    },
    onSuccess: (session) => {
      toast.success("Design saved successfully!");
      // Update session ID in state
    },
    onError: (error) => {
      toast.error("Failed to save design. Please try again.");
    },
  });

  return { saveDesign, isSaving: saveDesign.isLoading };
};
```

- [ ] Auto-save functionality
  - [ ] Auto-save every 60 seconds
  - [ ] Save on window unload (beforeunload event)
  - [ ] Show "Saving..." indicator
  - [ ] Show "All changes saved" when done

#### 12.3 Load Design Modal

- [ ] Create `LoadDesignModal.tsx`
  - [ ] List user's saved designs
  - [ ] Show thumbnails
  - [ ] Show design names
  - [ ] Show last edited date
  - [ ] Search/filter designs
  - [ ] Sort by date/name
  - [ ] Click to load
  - [ ] Delete button per design
  - [ ] Pagination (infinite scroll)

#### 12.4 Load Design Hook

- [ ] Create `useLoadDesign` hook
  - [ ] Query saved designs
  - [ ] Load specific design by ID
  - [ ] Deserialize canvas state
  - [ ] Restore layers
  - [ ] Restore object properties
  - [ ] Handle missing fonts gracefully
  - [ ] Handle missing images gracefully
  - [ ] Show warning if design can't be fully restored

---

### 13. Frontend: Cart & Checkout Integration (32 items)

#### 13.1 Product Detail Page Integration

- [ ] Update `app/(shop)/products/[slug]/page.tsx`
  - [ ] Check if product has customization enabled
  - [ ] Show "Customize" button instead of direct "Add to Cart"
  - [ ] Button style: Primary CTA
  - [ ] Open editor modal on click

- [ ] Create `CustomizeButton.tsx`

```typescript
interface CustomizeButtonProps {
  productId: string;
  productImage: string;
  customizationConfig: ProductCustomization;
  variantId?: string;
}
```

- [ ] Fetch customization config
- [ ] Open `DesignEditorModal` with product context
- [ ] Pre-select variant if applicable

#### 13.2 Design Editor Modal

- [ ] Create `DesignEditorModal.tsx`
  - [ ] Full-screen modal (responsive)
  - [ ] Header:
    - [ ] Product name
    - [ ] Design area selector (front/back/sleeve)
    - [ ] Close button (with unsaved changes warning)
  - [ ] Main area:
    - [ ] Canvas (left/center)
    - [ ] Properties panel (right)
    - [ ] Toolbar (top)
    - [ ] Layer panel (left sidebar)
  - [ ] Footer:
    - [ ] Cancel button
    - [ ] Save design button
    - [ ] Add to cart button
  - [ ] Mobile responsive layout

#### 13.3 Add to Cart with Customization

- [ ] Update `useAddToCart` hook
  - [ ] Accept customization data
  - [ ] Serialize design layers
  - [ ] Generate preview thumbnail
  - [ ] Send to cart API

```typescript
const addToCart = useMutation({
  mutationFn: async (data: AddToCartData) => {
    const response = await apiClient.post("/cart/items", {
      variantId: data.variantId,
      quantity: data.quantity,
      customization: {
        designArea: data.designArea,
        designData: data.designData,
        previewUrl: data.previewUrl,
        thumbnailUrl: data.thumbnailUrl,
      },
    });
    return response.data;
  },
});
```

- [ ] Update backend `POST /api/v1/cart/items` endpoint
  - [ ] Accept `customization` field (optional)
  - [ ] Validate customization data structure
  - [ ] Store design data in cart item
  - [ ] Generate preview URL
  - [ ] Return cart with customization

#### 13.4 Cart Display with Customization

- [ ] Update `CartItem.tsx` component
  - [ ] Show customization preview thumbnail
  - [ ] Add "Edit Design" button
    - [ ] Reopen editor modal with existing design
    - [ ] Pre-load design state
  - [ ] Add "Remove Design" button
    - [ ] Confirm before removing
    - [ ] Remove customization, keep product in cart
  - [ ] Show customization indicator badge
  - [ ] Show layer count (e.g., "3 custom layers")

- [ ] Update `MiniCart.tsx`
  - [ ] Show customization thumbnails
  - [ ] Indicate customized items with icon
  - [ ] Show truncated design info

#### 13.5 Checkout Integration

- [ ] Update `CheckoutWizard.tsx`
  - [ ] Display customization previews in order review
  - [ ] Show warning: "Custom items are non-returnable"
  - [ ] Verify all customizations have previews
  - [ ] Block checkout if preview generation failed

- [ ] Update order creation
  - [ ] Save design data in `OrderItemCustomization`
  - [ ] Save preview URLs
  - [ ] Mark for production file generation
  - [ ] Include customization price modifier

---

### 14. Frontend: Admin Production Dashboard (28 items)

#### 14.1 Production Orders List

- [ ] Create `app/(admin)/production/page.tsx`
  - [ ] List orders with customizations
  - [ ] Filter by production status:
    - [ ] Pending production file generation
    - [ ] Production file ready
    - [ ] Downloaded
    - [ ] Printed
  - [ ] Filter by date range
  - [ ] Search by order number
  - [ ] Pagination

- [ ] Create `ProductionOrderCard.tsx`
  - [ ] Order number and date
  - [ ] Customer name
  - [ ] Order total
  - [ ] Customization count
  - [ ] Production status badge
  - [ ] View details button
  - [ ] Generate production files button (if pending)

#### 14.2 Production Order Detail

- [ ] Create `app/(admin)/production/[orderId]/page.tsx`
  - [ ] Order summary
  - [ ] Customer information
  - [ ] Shipping address
  - [ ] List of customized items
  - [ ] Production files section

- [ ] Create `ProductionItemCard.tsx`
  - [ ] Product name and variant
  - [ ] Design area
  - [ ] Preview image (web quality)
  - [ ] Layer count
  - [ ] Production file status
  - [ ] Actions:
    - [ ] Generate production file
    - [ ] Download production file
    - [ ] View design in editor (read-only)
    - [ ] Download production manifest

#### 14.3 Production File Generation

- [ ] Create `GenerateProductionButton.tsx`
  - [ ] Click to generate
  - [ ] Show progress (can take 5-10s)
  - [ ] Display generation status
  - [ ] Show success message with download button
  - [ ] Handle errors gracefully

- [ ] Create `useGenerateProduction` hook

```typescript
const useGenerateProduction = () => {
  const generate = useMutation({
    mutationFn: async (orderItemId: string) => {
      const response = await apiClient.post(`/admin/production/generate`, { orderItemId });
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success("Production file generated!");
      // Download automatically or show download button
    },
  });

  return { generate, isGenerating: generate.isLoading };
};
```

#### 14.4 Batch Operations

- [ ] Create batch production file generation
  - [ ] Select multiple orders
  - [ ] Generate all production files
  - [ ] Show batch progress
  - [ ] Download as ZIP archive
  - [ ] Include production manifest

- [ ] Create `BatchDownloadButton.tsx`
  - [ ] Select items to download
  - [ ] Prepare ZIP archive (backend)
  - [ ] Stream download to user
  - [ ] Include folder structure:

```
order-{orderId}/
  ├── manifest.json
  ├── front-tshirt-white.png
  ├── back-tshirt-white.png
  └── specifications.pdf
```

---

### 15. Admin: Product Template Configuration (32 items)

#### 15.1 Product Customization Settings Page

- [ ] Create `app/(admin)/products/[id]/customization/page.tsx`
  - [ ] Enable customization toggle
  - [ ] Design areas configuration section
  - [ ] Constraints section
  - [ ] Pricing section
  - [ ] Preview section
  - [ ] Save button

#### 15.2 Design Area Editor

- [ ] Create `ProductTemplateEditor.tsx`
  - [ ] Display product image
  - [ ] Interactive canvas overlay
  - [ ] Draw rectangles for design areas
  - [ ] Resize/move design areas
  - [ ] Name each design area
  - [ ] Set constraints per area
  - [ ] Preview mode toggle

- [ ] Create `DesignAreaDrawer.tsx`

```typescript
interface DesignAreaDrawerProps {
  productImage: string;
  existingAreas: DesignArea[];
  onAreasChange: (areas: DesignArea[]) => void;
}
```

- [ ] Click and drag to draw area
- [ ] Show area dimensions
- [ ] Show area coordinates
- [ ] Corner handles for resize
- [ ] Center handle for move
- [ ] Rotation handle (optional)
- [ ] Delete area button

#### 15.3 Area Configuration Panel

- [ ] Create `DesignAreaConfig.tsx`
  - [ ] Area name input
  - [ ] Position inputs (X, Y)
  - [ ] Size inputs (Width, Height)
  - [ ] Rotation input (degrees)
  - [ ] Min design size input
  - [ ] Max design size input
  - [ ] Enforce aspect ratio toggle
  - [ ] Allow resize toggle
  - [ ] Allow rotation toggle
  - [ ] Save configuration

#### 15.4 Customization Constraints

- [ ] Create constraints form
  - [ ] Max layers allowed (slider: 1-50)
  - [ ] Allow images toggle
  - [ ] Allow text toggle
  - [ ] Allow shapes toggle
  - [ ] Allow drawing toggle
  - [ ] Min image size (px)
  - [ ] Max image size (px)
  - [ ] Allowed fonts (multi-select)
  - [ ] Restricted words (textarea, comma-separated)

#### 15.5 Pricing Configuration

- [ ] Create pricing form
  - [ ] Base price modifier (₺)
    - [ ] Add to product price
    - [ ] E.g., +₺10 for any customization
  - [ ] Price per layer (₺)
    - [ ] Charge per additional layer
    - [ ] E.g., +₺2 per layer after first 3
  - [ ] Preview calculated price
  - [ ] Apply to all variants checkbox

---

### 16. Design Library & Templates (36 items)

#### 16.1 Design Template System

- [ ] Add `DesignTemplate` model to Prisma
- [ ] Create `template.repository.ts`
  - [ ] `findAll(filters)` - List templates
  - [ ] `findById(id)` - Get template
  - [ ] `create(data)` - Create template (admin)
  - [ ] `update(id, data)` - Update template (admin)
  - [ ] `delete(id)` - Delete template (admin)
  - [ ] `incrementUsage(id)` - Track usage

- [ ] Create template endpoints
  - [ ] `GET /api/v1/templates` - List templates
    - [ ] Filter by category
    - [ ] Filter by tags
    - [ ] Filter by free/paid
    - [ ] Sort by popularity, newest
    - [ ] Pagination
  - [ ] `GET /api/v1/templates/:id` - Get template
    - [ ] Return template data (canvas state)
    - [ ] Return preview URL
  - [ ] `POST /api/v1/admin/templates` - Create template (admin)
  - [ ] `PUT /api/v1/admin/templates/:id` - Update template (admin)
  - [ ] `DELETE /api/v1/admin/templates/:id` - Delete template (admin)

#### 16.2 Clipart Library System

- [ ] Add `ClipartAsset` model to Prisma
- [ ] Create `clipart.repository.ts`
  - [ ] Similar CRUD operations as templates
  - [ ] Category management
  - [ ] Tag management

- [ ] Create clipart endpoints
  - [ ] `GET /api/v1/clipart` - List clipart
  - [ ] `GET /api/v1/clipart/:id` - Get clipart
  - [ ] `POST /api/v1/admin/clipart` - Upload clipart (admin)
  - [ ] `DELETE /api/v1/admin/clipart/:id` - Delete clipart (admin)

#### 16.3 Admin Template Manager

- [ ] Create `app/(admin)/design-library/templates/page.tsx`
  - [ ] List all templates
  - [ ] Create new template
  - [ ] Edit template
  - [ ] Delete template
  - [ ] Preview template
  - [ ] Set featured templates

- [ ] Create template creation flow
  - [ ] Open design editor
  - [ ] Create design
  - [ ] Save as template
  - [ ] Add template metadata:
    - [ ] Name
    - [ ] Description
    - [ ] Category
    - [ ] Tags
    - [ ] Price (if paid)
    - [ ] Thumbnail
  - [ ] Publish template

#### 16.4 Admin Clipart Manager

- [ ] Create `app/(admin)/design-library/clipart/page.tsx`
  - [ ] Bulk upload clipart
  - [ ] List all clipart
  - [ ] Edit clipart metadata
  - [ ] Delete clipart
  - [ ] Organize into categories
  - [ ] Set free/paid pricing

---

### 17. Testing & Quality Assurance (44 items)

#### 17.1 Unit Tests - Canvas Logic

- [ ] Test `useCanvasLayers` hook
  - [ ] Add layer
  - [ ] Remove layer
  - [ ] Update layer
  - [ ] Reorder layers
  - [ ] Duplicate layer
  - [ ] Lock/unlock layer
  - [ ] Show/hide layer

- [ ] Test `useCanvasHistory` hook
  - [ ] Save state
  - [ ] Undo operation
  - [ ] Redo operation
  - [ ] Clear history
  - [ ] History limit enforcement

- [ ] Test layer serialization
  - [ ] Serialize image layer
  - [ ] Serialize text layer
  - [ ] Serialize group layer
  - [ ] Deserialize layers
  - [ ] Preserve transformations
  - [ ] Preserve custom properties

#### 17.2 Integration Tests - API

- [ ] Test design upload endpoint
  - [ ] Upload valid image
  - [ ] Reject oversized file (>5MB)
  - [ ] Reject invalid MIME type
  - [ ] Sanitize SVG
  - [ ] Generate thumbnail
  - [ ] Save metadata

- [ ] Test preview generation endpoint
  - [ ] Generate single layer preview
  - [ ] Generate multi-layer preview
  - [ ] Apply text overlay
  - [ ] Apply image overlay
  - [ ] Cache preview
  - [ ] Return Q2 format

- [ ] Test session save/load
  - [ ] Save canvas state
  - [ ] Load canvas state
  - [ ] Auto-save
  - [ ] Session expiry
  - [ ] Share session
  - [ ] Load shared session

- [ ] Test cart integration
  - [ ] Add customized item to cart
  - [ ] Update customized item
  - [ ] Remove customization
  - [ ] Load cart with customizations
  - [ ] Checkout with customizations

#### 17.3 E2E Tests - User Flows

- [ ] Test complete customization flow
  - [ ] Navigate to product
  - [ ] Click "Customize" button
  - [ ] Upload design image
  - [ ] Position and resize design
  - [ ] Add text layer
  - [ ] Format text (font, size, color)
  - [ ] Preview design on product
  - [ ] Save design
  - [ ] Add to cart
  - [ ] View cart with preview
  - [ ] Edit design from cart
  - [ ] Proceed to checkout
  - [ ] Place order

- [ ] Test mobile customization flow
  - [ ] Open editor on mobile
  - [ ] Use touch gestures
  - [ ] Upload image
  - [ ] Edit with touch controls
  - [ ] Add text
  - [ ] Save and add to cart

#### 17.4 Performance Tests

- [ ] Canvas rendering performance
  - [ ] 60 FPS with 10 layers
  - [ ] Smooth zoom/pan
  - [ ] No lag on layer operations
  - [ ] Memory usage under 500MB

- [ ] Preview generation performance
  - [ ] Preview generation <2s (P95)
  - [ ] Concurrent preview requests
  - [ ] Cache hit rate >70%

- [ ] Load testing
  - [ ] 100 concurrent users
  - [ ] 1000 designs uploaded per hour
  - [ ] 500 preview generations per minute

#### 17.5 Visual Regression Tests

- [ ] Capture screenshots
  - [ ] Editor UI (empty state)
  - [ ] Editor UI (with layers)
  - [ ] Preview panel
  - [ ] Mobile editor
  - [ ] Properties panel
  - [ ] Layer panel

- [ ] Compare against baseline
  - [ ] Use Chromatic or Percy
  - [ ] Run on PRs
  - [ ] Alert on visual changes

---

### 18. Documentation & Operational Readiness (32 items)

#### 18.1 API Documentation

- [ ] Document customization endpoints in OpenAPI spec
  - [ ] Product customization config CRUD
  - [ ] Design upload/management
  - [ ] Preview generation
  - [ ] Session save/load
  - [ ] Production file generation
  - [ ] Template/clipart endpoints

- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication requirements
- [ ] Add rate limiting documentation

#### 18.2 Component Documentation

- [ ] Create Storybook stories
  - [ ] `DesignCanvas` story
  - [ ] `CanvasToolbar` story
  - [ ] `LayerPanel` story
  - [ ] `PropertiesPanel` story
  - [ ] `DesignLibrary` story
  - [ ] `TextEditor` story
  - [ ] `ProductPreview` story
  - [ ] Mobile components

- [ ] Document component props
- [ ] Add usage examples
- [ ] Document customization options

#### 18.3 User Guide

- [ ] Create `docs/user/customization-guide.md`
  - [ ] How to customize a product
  - [ ] Uploading your own designs
  - [ ] Adding text
  - [ ] Using templates and clipart
  - [ ] Saving and loading designs
  - [ ] Sharing designs
  - [ ] Mobile editor tips
  - [ ] Troubleshooting

#### 18.4 Admin Guide

- [ ] Create `docs/admin/customization-admin.md`
  - [ ] Enabling customization for products
  - [ ] Configuring design areas
  - [ ] Setting constraints
  - [ ] Managing production files
  - [ ] Uploading templates
  - [ ] Uploading clipart
  - [ ] Troubleshooting production files

#### 18.5 Developer Guide

- [ ] Create `docs/dev/customization-architecture.md`
  - [ ] System architecture overview
  - [ ] Canvas implementation details
  - [ ] Preview generation pipeline
  - [ ] Production file export process
  - [ ] Database schema explanation
  - [ ] API integration guide
  - [ ] Testing strategies
  - [ ] Performance optimization tips

#### 18.6 Runbook

- [ ] Create `docs/ops/customization-runbook.md`
  - [ ] Monitoring dashboard setup
  - [ ] Metrics to track:
    - [ ] Preview generation latency
    - [ ] Canvas rendering FPS
    - [ ] Design upload success rate
    - [ ] Production file generation success rate
  - [ ] Alert thresholds
  - [ ] Incident response:
    - [ ] Preview generation failures
    - [ ] Cloudinary API errors
    - [ ] Canvas rendering issues
    - [ ] Production file corruption
  - [ ] Backup and recovery:
    - [ ] Design data backups
    - [ ] Session recovery
    - [ ] Production file backups
  - [ ] Scaling considerations

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Run all customization tests
pnpm --filter @lumi/backend test customization
pnpm --filter @lumi/backend test design
pnpm --filter @lumi/backend test preview
pnpm --filter @lumi/backend test production

# Run frontend tests
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/features/customization/**"

# Run integration tests
pnpm --filter @lumi/backend test:integration customization

# Run E2E tests
pnpm --filter @lumi/frontend exec playwright test tests/e2e/customization.spec.ts

# Check test coverage (must be ≥85%)
pnpm test:coverage
```

### Canvas Rendering Performance

```typescript
// Test canvas FPS
test("Canvas maintains 60 FPS with 10 layers", async () => {
  const canvas = initializeTestCanvas();

  // Add 10 layers
  for (let i = 0; i < 10; i++) {
    addTestLayer(canvas);
  }

  // Measure FPS over 5 seconds
  const fps = await measureFPS(canvas, 5000);

  expect(fps).toBeGreaterThanOrEqual(60);
});

// Test interaction latency
test("Layer operations complete within 100ms", async () => {
  const canvas = initializeTestCanvas();

  const start = performance.now();
  addTestLayer(canvas);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100);
});
```

### Preview Generation Performance

```typescript
// Test preview generation time (P2)
test("Preview generation completes within 2s (P95)", async () => {
  const durations: number[] = [];

  // Generate 100 previews
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    await generatePreview(testDesignData);
    const duration = Date.now() - start;
    durations.push(duration);
  }

  // Calculate P95
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)];

  expect(p95).toBeLessThan(2000);
});
```

### Security Validation (S2/S3)

```typescript
// S2: Upload security
test("Rejects oversized file upload", async () => {
  const largeFile = createTestFile(6 * 1024 * 1024); // 6MB

  const response = await request(app).post("/api/v1/designs/upload").attach("file", largeFile);

  expect(response.status).toBe(413); // Payload Too Large
});

test("Sanitizes malicious SVG", async () => {
  const maliciousSVG = `
    <svg>
      <script>alert('XSS')</script>
      <rect onclick="alert('XSS')"/>
    </svg>
  `;

  const sanitized = sanitizeSVG(maliciousSVG);

  expect(sanitized).not.toContain("<script>");
  expect(sanitized).not.toContain("onclick");
});

// S3: Design ownership
test("User cannot access other user designs", async () => {
  const otherUserDesignId = "design_other_user";

  const response = await request(app)
    .get(`/api/v1/designs/${otherUserDesignId}`)
    .set("Authorization", `Bearer ${userToken}`);

  expect(response.status).toBe(403); // Forbidden
});
```

### Production File Validation

```typescript
// Validate production file quality
test("Production file is 300 DPI PNG", async () => {
  const productionFile = await generateProductionFile(testOrderItemId);

  expect(productionFile.format).toBe("png");
  expect(productionFile.dpi).toBe(300);
  expect(productionFile.width).toBeGreaterThanOrEqual(5000);
  expect(productionFile.backgroundColor).toBe("transparent");
});
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics

- ✅ Test coverage ≥85% (customization module)
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ 100% Zod schema validation coverage
- ✅ Storybook stories for all major components

### Performance Metrics

- ✅ Canvas rendering: 60 FPS minimum
- ✅ User interactions: <100ms response time
- ✅ Preview generation: <2s (P95)
- ✅ Design save/load: <500ms
- ✅ Production file generation: <10s
- ✅ Lighthouse Performance score ≥85 for editor page

### User Experience Metrics

- ✅ Editor load time: <2s
- ✅ Zero crashes during 1-hour session
- ✅ Mobile editor fully functional with touch gestures
- ✅ Undo/redo working flawlessly
- ✅ Real-time preview updates within 1s

### Security Metrics

- ✅ 100% uploads validated (MIME + size + sanitization)
- ✅ SVG sanitization active and tested
- ✅ Design ownership enforced (S3)
- ✅ Production files protected (admin only)
- ✅ All design operations audited

### Business Metrics

- ✅ Customization available for all eligible products
- ✅ Production files downloadable within 1 hour of order
- ✅ Design templates and clipart library populated (100+ items)
- ✅ >90% of customizations result in successful orders
- ✅ <5% preview generation failures

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Canvas Memory Leaks

❌ **Wrong:**

```typescript
// Not disposing canvas properly
const canvas = new fabric.Canvas("canvas");
// ... use canvas ...
// Navigate away without cleanup
```

✅ **Correct:**

```typescript
useEffect(() => {
  const canvas = new fabric.Canvas("canvas");

  return () => {
    // Cleanup on unmount
    canvas.dispose();
  };
}, []);
```

### 2. Unoptimized Preview Generation

❌ **Wrong:**

```typescript
// Generate preview on every canvas change (too frequent)
canvas.on("object:modified", () => {
  generatePreview(); // Called 100 times per second
});
```

✅ **Correct:**

```typescript
// Debounce preview generation
const debouncedGenerate = useMemo(() => debounce(generatePreview, 1000), []);

canvas.on("object:modified", debouncedGenerate);
```

### 3. Missing Layer Serialization Properties

❌ **Wrong:**

```typescript
// Serialize without custom properties
const json = canvas.toJSON();
// Loses layer IDs, types, metadata
```

✅ **Correct:**

```typescript
// Include custom properties
const json = canvas.toJSON(["id", "layerId", "layerType", "layerName", "isLocked", "customData"]);
```

### 4. No Mobile Optimization

❌ **Wrong:**

```typescript
// Same canvas size for desktop and mobile
<canvas width={1920} height={1080} />
```

✅ **Correct:**

```typescript
// Responsive canvas size
const canvasSize = isMobile
  ? { width: 800, height: 800 }
  : { width: 1920, height: 1080 };

<canvas width={canvasSize.width} height={canvasSize.height} />
```

### 5. Insecure SVG Handling

❌ **Wrong:**

```typescript
// Accept SVG without sanitization
fabric.loadSVGFromString(userUploadedSVG, (objects) => {
  canvas.add(...objects);
});
```

✅ **Correct:**

```typescript
// Sanitize SVG first
const sanitizedSVG = sanitizeSVG(userUploadedSVG);
fabric.loadSVGFromString(sanitizedSVG, (objects) => {
  canvas.add(...objects);
});
```

### 6. No Design Ownership Validation

❌ **Wrong:**

```typescript
// Load any design by ID
const design = await prisma.customerDesign.findUnique({
  where: { id: designId },
});
```

✅ **Correct:**

```typescript
// Validate ownership (S3)
const design = await prisma.customerDesign.findFirst({
  where: {
    id: designId,
    OR: [{ userId: currentUserId }, { isPublic: true }],
  },
});

if (!design) {
  throw new UnauthorizedError("Design not found or access denied");
}
```

### 7. Missing Production File Backup

❌ **Wrong:**

```typescript
// Generate production file only once
const productionFile = await generateProductionFile(orderItemId);
// If lost, can't regenerate easily
```

✅ **Correct:**

```typescript
// Store production file URL in database
const productionFile = await generateProductionFile(orderItemId);
await prisma.orderItemCustomization.update({
  where: { id: customizationId },
  data: {
    productionFileUrl: productionFile.url,
    productionGenerated: true,
  },
});

// Also backup to separate storage
await backupProductionFile(productionFile, orderId);
```

### 8. No Layer Count Limits

❌ **Wrong:**

```typescript
// Allow unlimited layers
const addLayer = (layer: Layer) => {
  setLayers([...layers, layer]);
};
```

✅ **Correct:**

```typescript
// Enforce layer limit
const MAX_LAYERS = 10;

const addLayer = (layer: Layer) => {
  if (layers.length >= MAX_LAYERS) {
    toast.error(`Maximum ${MAX_LAYERS} layers allowed`);
    return;
  }
  setLayers([...layers, layer]);
};
```

---

## 📦 DELIVERABLES

### 1. Backend Implementation

- ✅ Product customization configuration API
- ✅ Design upload/management API
- ✅ Preview generation API with Cloudinary overlay
- ✅ Production file export API
- ✅ Session save/load API
- ✅ Template/clipart management API
- ✅ Q2 format responses on all endpoints
- ✅ RBAC protection on admin endpoints
- ✅ Input validation and sanitization (S2)

### 2. Frontend Implementation

- ✅ Interactive canvas editor (Fabric.js)
- ✅ Multi-layer support (images, text, clipart)
- ✅ Drag, resize, rotate, layer ordering
- ✅ Text editor with formatting
- ✅ Design library (templates, clipart, user designs)
- ✅ Real-time product preview
- ✅ Mobile-optimized editor with touch gestures
- ✅ Save/load/share designs
- ✅ Cart/checkout integration
- ✅ Undo/redo, keyboard shortcuts
- ✅ Zoom, pan, alignment tools

### 3. Admin Dashboard

- ✅ Product template configuration
- ✅ Design area editor
- ✅ Production orders list
- ✅ Production file download
- ✅ Batch production file generation
- ✅ Template management
- ✅ Clipart management

### 4. Database

- ✅ ProductCustomization model
- ✅ CustomerDesign model
- ✅ DesignSession model
- ✅ OrderItemCustomization model
- ✅ DesignTemplate model
- ✅ ClipartAsset model
- ✅ Indexes for performance
- ✅ Migration files

### 5. Testing

- ✅ Unit tests (≥85% coverage)
- ✅ Integration tests
- ✅ E2E tests (Playwright)
- ✅ Performance tests (canvas FPS, preview latency)
- ✅ Security tests (upload validation, SVG sanitization, ownership)
- ✅ Visual regression tests

### 6. Documentation

- ✅ OpenAPI spec for customization endpoints
- ✅ Storybook stories for all components
- ✅ User guide (how to customize products)
- ✅ Admin guide (how to configure customization)
- ✅ Developer guide (architecture, APIs, testing)
- ✅ Runbook (monitoring, alerts, incident response)

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 8.5: Product Customization Editor - Completion Report

## Implementation Summary

- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items

- [x] Total Items: 562/562 (100%)
- [x] Backend APIs: 136/136
- [x] Frontend Editor: 254/254
- [x] Admin Dashboard: 60/60
- [x] Design Library: 36/36
- [x] Testing: 44/44
- [x] Documentation: 32/32

## Metrics Achieved

- **Test Coverage**: X% (Target: ≥85%)
- **Canvas FPS**: X FPS (Target: ≥60)
- **Preview Generation**: Xms P95 (Target: <2000ms)
- **Production File Generation**: Xs (Target: <10s)
- **User Interaction Latency**: Xms (Target: <100ms)
- **Lighthouse Performance**: X (Target: ≥85)

## Design Library Statistics

- **Templates**: X (Target: ≥50)
- **Clipart Assets**: X (Target: ≥100)
- **User Designs**: X uploaded in testing

## Production Metrics

- **Orders with Customizations**: X
- **Production Files Generated**: X
- **Production File Success Rate**: X% (Target: ≥95%)

## Known Issues

- [List any known issues or technical debt]

## Next Phase Preparation

- Phase 9 (Admin Dashboard) enhanced with customization features: ✅
- Phase 10 (Payment Integration) ready: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 9: Admin Dashboard**

- Already includes customization management features
- Enhanced with production file dashboard
- Template and clipart management built-in

**Phase 10: Payment Integration**

- Customization price modifiers integrated
- Dynamic pricing based on layers and complexity

**Phase 11: Search & Filters**

- Search customized products
- Filter by design tags
- Popular designs ranking

---

## 🔗 DEPENDENCIES & INTEGRATION

### Depends On:

- **Phase 5 (Cloudinary)**: Image upload, transformations, overlay API ✅
- **Phase 8 (E-commerce)**: Product detail page, cart, checkout ✅

### Integrates With:

- **Phase 4 (Core APIs)**: Product API, Order API ✅
- **Phase 6 (Next.js)**: App Router, state management ✅
- **Phase 9 (Admin)**: Production dashboard ✅
- **Phase 10 (Payment)**: Dynamic pricing ✅

### Enables:

- Unique selling proposition (custom embroidery)
- Higher profit margins (customization premium)
- Customer engagement (design your own)
- Viral potential (share designs)

---

**END OF PHASE 8.5 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-11-14_
_Created with ❤️ for Lumi E-commerce Platform_
