# 🚀 PHASE 9.5: ENTERPRISE CMS & VISUAL WEBSITE BUILDER

**Status**: ⏸️ **PENDING**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3, 4, 5, 6, 8, 9
**Estimated Time**: 33 days
**Complexity**: Enterprise-Level (Highest)

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-11-14
**Phase Code**: PHASE-9.5
**Module Focus**: Headless CMS, Visual Page Builder, Campaign Management & Dynamic Content System
**Expected Lines of Code**: ~18,500 lines
**Test Coverage Target**: ≥85%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Visual Page Builder** - Drag-drop block-based editor with 50+ pre-built components
2. **Campaign Management System** - Seasonal campaigns, flash sales, automated scheduling
3. **Contest & Giveaway Platform** - Raffle system, winner selection, fraud detection
4. **Theme System** - Multiple themes, seasonal auto-switch, one-click customization
5. **Content Scheduler** - Time-based content activation, preview scheduled changes
6. **A/B Testing Engine** - Split testing for layouts, conversion optimization
7. **Dynamic Widget System** - Popups, floating bars, social proof notifications
8. **Component Marketplace** - Extensible block library, import/export
9. **Media Library Pro** - Advanced media management with AI tagging
10. **Real-Time Preview** - Live desktop/tablet/mobile preview with version history
11. **Multi-Language CMS** - Translate all CMS content (integrates with Phase 14)
12. **Analytics Integration** - Track block performance, conversion rates

### Success Criteria

- ✅ Visual page builder with 50+ drag-drop blocks
- ✅ Campaign manager: create, schedule, auto-activate campaigns
- ✅ Contest system: create giveaways, auto-select winners
- ✅ Theme system: 10+ themes, seasonal auto-switch
- ✅ Content scheduler: time-based publish/unpublish
- ✅ A/B testing: split test layouts, auto-select winner
- ✅ Widget system: 15+ widget types (popups, bars, notifications)
- ✅ Real-time preview: desktop/tablet/mobile with <500ms update
- ✅ Version history: undo/redo, rollback to previous versions
- ✅ Performance: page builder loads <2s, block operations <100ms
- ✅ Mobile responsive: full builder on tablet (768px+), read-only on mobile
- ✅ Test coverage ≥85%
- ✅ Zero-code required for marketing team

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Standards (P1/P2)

**P1: Editor Performance**

- Page builder load time: <2s
- Block drag-drop latency: <50ms
- Block render time: <100ms
- Preview generation: <500ms
- Save operation: <1s
- Undo/redo: <50ms

**P2: Frontend Performance**

- CMS-generated pages: LCP <1.5s
- Block lazy loading: below-fold blocks
- Image optimization: WebP/AVIF via Cloudinary
- Code splitting: per-block bundles
- Cache strategy: ISR with 60s revalidation

**Performance Targets:**

```typescript
// P1: Editor Metrics
{
  editorLoadTime: 2000,        // Initial load (ms)
  blockDragLatency: 50,        // Drag responsiveness (ms)
  blockRenderTime: 100,        // Block render (ms)
  previewUpdateTime: 500,      // Preview refresh (ms)
  saveOperationTime: 1000,     // Save to DB (ms)
  undoRedoLatency: 50          // History operations (ms)
}

// P2: Frontend Metrics
{
  pageLCP: 1500,               // Largest Contentful Paint (ms)
  blockBundleSize: 50,         // Max block bundle size (KB)
  cacheHitRate: 85,            // ISR cache hit rate (%)
  imageOptimization: true,     // Cloudinary auto-optimization
  lazyLoadBlocks: true         // Below-fold lazy load
}
```

### Security Standards (S2/S3/S4)

**S2: Input Sanitization**

- All block content sanitized (XSS prevention)
- HTML blocks: whitelist allowed tags only
- Custom CSS: sanitize dangerous properties
- JavaScript blocks: CSP enforcement
- File uploads: MIME validation, size limits
- URL inputs: validate and sanitize

**S3: RBAC Protection**

- CMS access: admin/manager/editor roles only
- Block library: role-based visibility
- Campaign management: admin/manager only
- Theme customization: admin only
- A/B testing: manager+ only
- Audit logging: all CMS changes tracked

**S4: Content Security**

- CSP headers: restrict inline scripts
- Iframe sandboxing: untrusted embeds
- API authentication: server-side only
- Version control: track all changes
- Rollback protection: prevent unauthorized rollback
- Data encryption: sensitive campaign data

### API Standards (Q2)

**Page Create/Update Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "page_cm2x1y2z3",
    "slug": "/campaigns/black-friday",
    "title": "Black Friday 2025",
    "status": "draft" | "published" | "scheduled",
    "blocks": [
      {
        "id": "block_abc123",
        "type": "hero",
        "order": 0,
        "data": {
          "heading": "Black Friday Sale",
          "subheading": "Up to 70% Off",
          "backgroundImage": "cloudinary-url",
          "cta": {
            "text": "Shop Now",
            "link": "/products",
            "style": "primary"
          }
        },
        "settings": {
          "margin": { "top": 0, "bottom": 40 },
          "padding": { "top": 80, "bottom": 80 },
          "background": "#000000",
          "animation": "fade-in"
        }
      }
    ],
    "metadata": {
      "seo": {
        "title": "Black Friday Sale 2025 | Lumi",
        "description": "...",
        "ogImage": "..."
      },
      "publishedAt": "2025-11-24T00:00:00Z",
      "scheduledUnpublishAt": "2025-11-25T23:59:59Z"
    },
    "version": 5,
    "lastEditedBy": "admin_user_id",
    "createdAt": "2025-11-14T12:00:00Z",
    "updatedAt": "2025-11-20T15:30:00Z"
  },
  "meta": {
    "timestamp": "2025-11-20T15:30:00Z",
    "requestId": "uuid-v4"
  }
}
```

**Campaign Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "campaign_xyz789",
    "name": "Ramadan Special 2025",
    "type": "seasonal",
    "status": "scheduled",
    "startDate": "2025-03-10T00:00:00Z",
    "endDate": "2025-04-10T23:59:59Z",
    "theme": {
      "id": "theme_ramadan",
      "colors": {
        "primary": "#D4AF37",
        "secondary": "#2C3E50",
        "accent": "#E74C3C"
      },
      "effects": ["stars-background", "moon-icon"]
    },
    "pages": [
      { "pageId": "page_homepage", "modifications": {...} },
      { "pageId": "page_products", "modifications": {...} }
    ],
    "widgets": [
      {
        "type": "popup",
        "triggerId": "popup_ramadan_welcome",
        "config": {
          "delay": 3000,
          "frequency": "once-per-session",
          "content": "..."
        }
      }
    ],
    "analytics": {
      "impressions": 0,
      "conversions": 0,
      "revenue": 0
    }
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
│   ├── cms/
│   │   ├── cms.controller.ts                # CMS API handlers
│   │   ├── cms.service.ts                   # CMS business logic
│   │   ├── cms.repository.ts                # Data access
│   │   ├── cms.validators.ts                # Zod schemas
│   │   ├── cms.router.ts
│   │   └── __tests__/
│   ├── page/
│   │   ├── page.controller.ts               # Page CRUD
│   │   ├── page.service.ts                  # Page operations
│   │   ├── page.repository.ts
│   │   ├── page.validators.ts
│   │   ├── page.router.ts
│   │   └── __tests__/
│   ├── block/
│   │   ├── block.controller.ts              # Block management
│   │   ├── block.service.ts                 # Block registry
│   │   ├── block.repository.ts
│   │   ├── block.validators.ts
│   │   ├── block.router.ts
│   │   └── __tests__/
│   ├── campaign/
│   │   ├── campaign.controller.ts           # Campaign CRUD
│   │   ├── campaign.service.ts              # Campaign logic
│   │   ├── campaign.repository.ts
│   │   ├── campaign.validators.ts
│   │   ├── campaign.router.ts
│   │   └── __tests__/
│   ├── contest/
│   │   ├── contest.controller.ts            # Contest/giveaway
│   │   ├── contest.service.ts               # Winner selection
│   │   ├── contest.repository.ts
│   │   ├── contest.validators.ts
│   │   ├── contest.router.ts
│   │   └── __tests__/
│   ├── theme/
│   │   ├── theme.controller.ts              # Theme management
│   │   ├── theme.service.ts                 # Theme application
│   │   ├── theme.repository.ts
│   │   ├── theme.validators.ts
│   │   ├── theme.router.ts
│   │   └── __tests__/
│   ├── scheduler/
│   │   ├── scheduler.controller.ts          # Content scheduler
│   │   ├── scheduler.service.ts             # Cron jobs
│   │   ├── scheduler.repository.ts
│   │   ├── scheduler.validators.ts
│   │   ├── scheduler.router.ts
│   │   └── __tests__/
│   ├── abtest/
│   │   ├── abtest.controller.ts             # A/B testing
│   │   ├── abtest.service.ts                # Variant management
│   │   ├── abtest.repository.ts
│   │   ├── abtest.validators.ts
│   │   ├── abtest.router.ts
│   │   └── __tests__/
│   └── widget/
│       ├── widget.controller.ts             # Dynamic widgets
│       ├── widget.service.ts                # Widget rendering
│       ├── widget.repository.ts
│       ├── widget.validators.ts
│       ├── widget.router.ts
│       └── __tests__/
├── integrations/
│   └── cms/
│       ├── block-renderer.ts                # Server-side block rendering
│       ├── theme-compiler.ts                # Theme CSS generation
│       ├── scheduler-engine.ts              # Cron job engine
│       └── __tests__/
├── jobs/
│   ├── campaign-activator.job.ts            # Auto-activate campaigns
│   ├── campaign-deactivator.job.ts          # Auto-deactivate campaigns
│   ├── contest-winner-picker.job.ts         # Auto-select winners
│   ├── scheduled-content.job.ts             # Publish/unpublish content
│   └── abtest-analyzer.job.ts               # Analyze A/B test results
└── webhooks/
    └── cms-events.webhook.ts                # CMS event notifications

apps/frontend/src/
├── features/
│   └── cms/
│       ├── components/
│       │   ├── editor/
│       │   │   ├── PageBuilder.tsx          # Main page builder
│       │   │   ├── BlockCanvas.tsx          # Drag-drop canvas
│       │   │   ├── BlockSidebar.tsx         # Block library sidebar
│       │   │   ├── BlockInspector.tsx       # Block settings panel
│       │   │   ├── BlockToolbar.tsx         # Top toolbar
│       │   │   ├── DevicePreview.tsx        # Desktop/tablet/mobile preview
│       │   │   ├── VersionHistory.tsx       # Version timeline
│       │   │   ├── UndoRedo.tsx             # History controls
│       │   │   └── SavePublish.tsx          # Save/publish buttons
│       │   ├── blocks/
│       │   │   ├── HeroBlock.tsx            # Hero section block
│       │   │   ├── ProductGridBlock.tsx     # Product grid block
│       │   │   ├── BannerSliderBlock.tsx    # Banner carousel
│       │   │   ├── TextBlock.tsx            # Text/rich text
│       │   │   ├── ImageBlock.tsx           # Single image
│       │   │   ├── ImageGalleryBlock.tsx    # Gallery
│       │   │   ├── VideoBlock.tsx           # Video embed
│       │   │   ├── CountdownBlock.tsx       # Countdown timer
│       │   │   ├── SocialProofBlock.tsx     # Recent sales
│       │   │   ├── NewsletterBlock.tsx      # Newsletter form
│       │   │   ├── TestimonialBlock.tsx     # Testimonials
│       │   │   ├── FAQBlock.tsx             # FAQ accordion
│       │   │   ├── PricingTableBlock.tsx    # Pricing table
│       │   │   ├── CustomHTMLBlock.tsx      # Custom HTML
│       │   │   ├── SpacerBlock.tsx          # Spacer
│       │   │   └── ... (40+ more blocks)
│       │   ├── block-renderers/
│       │   │   ├── HeroRenderer.tsx         # Frontend hero render
│       │   │   ├── ProductGridRenderer.tsx
│       │   │   └── ... (renderers for each block)
│       │   ├── campaign/
│       │   │   ├── CampaignManager.tsx      # Campaign list
│       │   │   ├── CampaignEditor.tsx       # Create/edit campaign
│       │   │   ├── CampaignScheduler.tsx    # Date/time picker
│       │   │   ├── CampaignThemeSelector.tsx # Theme picker
│       │   │   └── CampaignAnalytics.tsx    # Campaign stats
│       │   ├── contest/
│       │   │   ├── ContestManager.tsx       # Contest list
│       │   │   ├── ContestEditor.tsx        # Create/edit contest
│       │   │   ├── ContestRules.tsx         # Entry rules config
│       │   │   ├── WinnerPicker.tsx         # Manual/auto winner selection
│       │   │   └── ContestAnalytics.tsx     # Participation stats
│       │   ├── theme/
│       │   │   ├── ThemeManager.tsx         # Theme list
│       │   │   ├── ThemeCustomizer.tsx      # Visual theme editor
│       │   │   ├── ColorPicker.tsx          # Color palette editor
│       │   │   ├── TypographyEditor.tsx     # Font selector
│       │   │   ├── ThemePreview.tsx         # Theme preview
│       │   │   └── ThemeScheduler.tsx       # Seasonal auto-switch
│       │   ├── scheduler/
│       │   │   ├── SchedulerDashboard.tsx   # Scheduled content overview
│       │   │   ├── ScheduleEditor.tsx       # Schedule date/time
│       │   │   ├── ScheduleCalendar.tsx     # Calendar view
│       │   │   └── SchedulePreview.tsx      # Preview scheduled state
│       │   ├── abtest/
│       │   │   ├── ABTestManager.tsx        # A/B test list
│       │   │   ├── ABTestEditor.tsx         # Create variants
│       │   │   ├── VariantEditor.tsx        # Edit variant
│       │   │   ├── ABTestAnalytics.tsx      # Test results
│       │   │   └── WinnerSelector.tsx       # Auto/manual winner
│       │   └── widget/
│       │       ├── WidgetManager.tsx        # Widget list
│       │       ├── WidgetEditor.tsx         # Create/edit widget
│       │       ├── PopupEditor.tsx          # Popup config
│       │       ├── FloatingBarEditor.tsx    # Floating bar config
│       │       ├── NotificationEditor.tsx   # Notification config
│       │       └── WidgetTriggers.tsx       # Trigger conditions
│       ├── hooks/
│       │   ├── usePageBuilder.ts            # Page builder state
│       │   ├── useBlockDragDrop.ts          # Drag-drop logic
│       │   ├── useBlockRegistry.ts          # Block library
│       │   ├── useBlockSettings.ts          # Block configuration
│       │   ├── usePageHistory.ts            # Version history
│       │   ├── useCampaign.ts               # Campaign operations
│       │   ├── useContest.ts                # Contest operations
│       │   ├── useTheme.ts                  # Theme operations
│       │   ├── useScheduler.ts              # Scheduler operations
│       │   ├── useABTest.ts                 # A/B test operations
│       │   └── useWidget.ts                 # Widget operations
│       ├── utils/
│       │   ├── block-serializer.ts          # Serialize/deserialize blocks
│       │   ├── page-renderer.ts             # Server-side rendering
│       │   ├── theme-compiler.ts            # Compile theme to CSS
│       │   ├── campaign-activator.ts        # Apply campaign changes
│       │   ├── contest-validator.ts         # Validate contest rules
│       │   ├── scheduler-utils.ts           # Schedule calculations
│       │   └── abtest-splitter.ts           # Variant assignment
│       ├── store/
│       │   ├── page-builder.store.ts        # Zustand page builder state
│       │   ├── block-library.store.ts       # Block library state
│       │   ├── editor-ui.store.ts           # Editor UI state
│       │   └── preview.store.ts             # Preview state
│       ├── types/
│       │   ├── cms.types.ts                 # CMS types
│       │   ├── block.types.ts               # Block types
│       │   ├── page.types.ts                # Page types
│       │   ├── campaign.types.ts            # Campaign types
│       │   ├── contest.types.ts             # Contest types
│       │   ├── theme.types.ts               # Theme types
│       │   ├── scheduler.types.ts           # Scheduler types
│       │   ├── abtest.types.ts              # A/B test types
│       │   └── widget.types.ts              # Widget types
│       └── __tests__/
│           ├── page-builder.test.tsx
│           ├── block-drag-drop.test.tsx
│           ├── campaign.test.tsx
│           ├── contest.test.tsx
│           └── theme.test.tsx

packages/shared/src/
├── cms/
│   ├── cms.dto.ts                           # DTOs
│   ├── cms.validators.ts                    # Zod schemas
│   ├── cms.types.ts                         # Shared types
│   ├── block.dto.ts
│   ├── block.validators.ts
│   ├── block.types.ts
│   ├── page.dto.ts
│   ├── page.validators.ts
│   ├── page.types.ts
│   ├── campaign.dto.ts
│   ├── campaign.validators.ts
│   ├── campaign.types.ts
│   └── ... (similar for all modules)
└── testing/
    └── cms/
        ├── fixtures.ts                      # Test fixtures
        ├── mock-blocks.ts                   # Sample blocks
        ├── mock-pages.ts                    # Sample pages
        └── mock-campaigns.ts                # Sample campaigns

prisma/schema.prisma
# CMS models addition
```

### Database Schema

```prisma
// ==========================================
// CMS CORE MODELS
// ==========================================

// Page model (all CMS pages)
model CMSPage {
  id              String   @id @default(cuid())

  // Page info
  slug            String   @unique // URL slug
  title           String
  description     String?

  // Page type
  type            String   @default("custom") // "homepage", "campaign", "landing", "custom"

  // Page status
  status          String   @default("draft") // "draft", "published", "scheduled", "archived"

  // Publishing
  publishedAt     DateTime?
  scheduledPublishAt   DateTime?
  scheduledUnpublishAt DateTime?

  // SEO
  seoTitle        String?
  seoDescription  String?
  seoKeywords     String[]
  ogImage         String?

  // Page settings
  settings        Json?    // { layout, header, footer, etc }

  // Version control
  version         Int      @default(1)
  previousVersionId String?
  previousVersion CMSPage? @relation("PageVersions", fields: [previousVersionId], references: [id], onDelete: SetNull)
  versions        CMSPage[] @relation("PageVersions")

  // Relations
  blocks          CMSPageBlock[]
  campaign        Campaign?        @relation("CampaignPages")
  abTestVariants  ABTestVariant[]

  // Audit
  createdById     String
  createdBy       User     @relation("CMSPageCreator", fields: [createdById], references: [id])
  lastEditedById  String?
  lastEditedBy    User?    @relation("CMSPageEditor", fields: [lastEditedById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([slug])
  @@index([status])
  @@index([publishedAt])
  @@index([scheduledPublishAt])
  @@index([type])
  @@index([deletedAt])
  @@map("cms_pages")
}

// Block instance on a page
model CMSPageBlock {
  id              String   @id @default(cuid())

  pageId          String
  page            CMSPage  @relation(fields: [pageId], references: [id], onDelete: Cascade)

  // Block info
  blockType       String   // "hero", "product-grid", "banner-slider", etc
  order           Int      // Display order

  // Block data (specific to block type)
  data            Json     // Block-specific content

  // Block settings (common across all blocks)
  settings        Json?    // { margin, padding, background, animation, etc }

  // Visibility
  isVisible       Boolean  @default(true)

  // Responsive settings
  responsiveSettings Json? // { mobile, tablet, desktop }

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([pageId])
  @@index([blockType])
  @@index([order])
  @@map("cms_page_blocks")
}

// Block library (reusable blocks)
model CMSBlockTemplate {
  id              String   @id @default(cuid())

  // Template info
  name            String
  description     String?
  category        String   // "hero", "content", "product", "marketing", etc
  tags            String[]

  // Block type
  blockType       String

  // Template data
  templateData    Json     // Pre-configured block data

  // Preview
  thumbnailUrl    String?

  // Visibility
  isPublic        Boolean  @default(false)
  isFeatured      Boolean  @default(false)

  // Usage
  usageCount      Int      @default(0)

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([category])
  @@index([blockType])
  @@index([isPublic])
  @@index([isFeatured])
  @@map("cms_block_templates")
}

// ==========================================
// CAMPAIGN SYSTEM
// ==========================================

model Campaign {
  id              String   @id @default(cuid())

  // Campaign info
  name            String
  description     String?
  type            String   // "seasonal", "flash-sale", "promotion", "event"

  // Campaign status
  status          String   @default("draft") // "draft", "scheduled", "active", "ended", "archived"

  // Campaign dates
  startDate       DateTime
  endDate         DateTime

  // Theme override
  themeId         String?
  theme           CMSTheme? @relation(fields: [themeId], references: [id], onDelete: SetNull)

  // Custom styling
  customStyles    Json?    // CSS overrides

  // Pages affected
  pageModifications Json   // { pageId: modifications }
  pages           CMSPage[] @relation("CampaignPages")

  // Widgets
  widgets         CampaignWidget[]

  // Analytics
  impressions     Int      @default(0)
  clicks          Int      @default(0)
  conversions     Int      @default(0)
  revenue         Decimal  @default(0) @db.Decimal(10, 2)

  // Priority (if multiple campaigns overlap)
  priority        Int      @default(0)

  // Auto-activation
  autoActivate    Boolean  @default(true)
  autoDeactivate  Boolean  @default(true)

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@index([type])
  @@index([priority])
  @@map("campaigns")
}

// Campaign widgets (popups, bars, notifications)
model CampaignWidget {
  id              String   @id @default(cuid())

  campaignId      String
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  // Widget type
  type            String   // "popup", "floating-bar", "notification", "banner"

  // Widget config
  config          Json     // Type-specific configuration

  // Trigger conditions
  triggers        Json     // { delay, scroll, exit, etc }

  // Targeting
  targeting       Json?    // { pages, devices, user-segments }

  // Display rules
  frequency       String   @default("once-per-session") // "always", "once-per-session", "once-per-day", "once-ever"

  // Status
  isActive        Boolean  @default(true)

  // Analytics
  impressions     Int      @default(0)
  clicks          Int      @default(0)
  conversions     Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([campaignId])
  @@index([type])
  @@index([isActive])
  @@map("campaign_widgets")
}

// ==========================================
// CONTEST / GIVEAWAY SYSTEM
// ==========================================

model Contest {
  id              String   @id @default(cuid())

  // Contest info
  title           String
  description     String
  rules           String   // Markdown or HTML

  // Prize
  prize           String
  prizeValue      Decimal? @db.Decimal(10, 2)
  prizeImage      String?

  // Contest dates
  startDate       DateTime
  endDate         DateTime
  winnerAnnouncementDate DateTime?

  // Entry conditions
  entryConditions Json     // { minPurchase, socialShare, formSubmit, etc }

  // Winner selection
  winnerCount     Int      @default(1)
  selectionMethod String   @default("random") // "random", "manual", "most-entries"

  // Status
  status          String   @default("draft") // "draft", "active", "ended", "winners-selected"

  // Fraud detection
  fraudChecks     Json?    // { duplicateEmail, duplicateIP, etc }

  // Display settings
  displaySettings Json?    // { showParticipantCount, showCountdown, etc }

  // Legal
  termsAndConditions String?
  privacyPolicy   String?

  // Relations
  entries         ContestEntry[]
  winners         ContestWinner[]

  // Analytics
  totalEntries    Int      @default(0)
  uniqueEntrants  Int      @default(0)

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@map("contests")
}

model ContestEntry {
  id              String   @id @default(cuid())

  contestId       String
  contest         Contest  @relation(fields: [contestId], references: [id], onDelete: Cascade)

  // Entrant info
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Guest entry
  email           String
  name            String?
  phone           String?

  // Entry data
  entryData       Json?    // Form responses, social shares, etc

  // Metadata
  ipAddress       String?
  userAgent       String?
  referrer        String?

  // Entry source
  source          String?  // "organic", "email", "social", etc

  // Fraud detection
  isFraudulent    Boolean  @default(false)
  fraudReason     String?

  // Entry count (multiple entries allowed)
  entryCount      Int      @default(1)

  createdAt       DateTime @default(now())

  @@index([contestId])
  @@index([userId])
  @@index([email])
  @@index([isFraudulent])
  @@map("contest_entries")
}

model ContestWinner {
  id              String   @id @default(cuid())

  contestId       String
  contest         Contest  @relation(fields: [contestId], references: [id], onDelete: Cascade)

  entryId         String   @unique

  // Winner info (denormalized for historical record)
  userId          String?
  email           String
  name            String?

  // Winner notification
  notifiedAt      DateTime?
  claimedAt       DateTime?

  // Prize delivery
  prizeDelivered  Boolean  @default(false)
  deliveredAt     DateTime?
  trackingNumber  String?

  // Notes
  notes           String?

  selectedAt      DateTime @default(now())

  @@index([contestId])
  @@index([userId])
  @@map("contest_winners")
}

// ==========================================
// THEME SYSTEM
// ==========================================

model CMSTheme {
  id              String   @id @default(cuid())

  // Theme info
  name            String
  description     String?
  category        String?  // "modern", "luxury", "playful", "seasonal", etc

  // Theme type
  type            String   @default("custom") // "default", "seasonal", "custom"

  // Color palette
  colors          Json     // { primary, secondary, accent, background, text, etc }

  // Typography
  typography      Json     // { headingFont, bodyFont, sizes, weights, etc }

  // Spacing
  spacing         Json?    // { margins, paddings, gaps }

  // Borders & shadows
  borders         Json?    // { radius, width, style }
  shadows         Json?    // { elevation levels }

  // Animations
  animations      Json?    // { transitions, keyframes }

  // Custom CSS
  customCSS       String?  @db.Text

  // Preview
  thumbnailUrl    String?

  // Status
  isActive        Boolean  @default(false)
  isPublic        Boolean  @default(false)

  // Seasonal auto-switch
  seasonalConfig  Json?    // { season, autoActivateDate, autoDeactivateDate }

  // Relations
  campaigns       Campaign[]

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([type])
  @@index([isActive])
  @@index([isPublic])
  @@map("cms_themes")
}

// ==========================================
// SCHEDULER SYSTEM
// ==========================================

model ScheduledContent {
  id              String   @id @default(cuid())

  // Content type
  contentType     String   // "page", "campaign", "theme", "widget"
  contentId       String

  // Action
  action          String   // "publish", "unpublish", "activate", "deactivate", "update"

  // Schedule
  scheduledAt     DateTime

  // Status
  status          String   @default("pending") // "pending", "executed", "failed", "cancelled"

  // Execution
  executedAt      DateTime?
  executionError  String?

  // Recurring
  isRecurring     Boolean  @default(false)
  recurrenceRule  String?  // Cron expression

  // Data
  actionData      Json?    // Data for the action

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([contentType, contentId])
  @@index([scheduledAt])
  @@index([status])
  @@map("scheduled_content")
}

// ==========================================
// A/B TESTING SYSTEM
// ==========================================

model ABTest {
  id              String   @id @default(cuid())

  // Test info
  name            String
  description     String?
  hypothesis      String?

  // Test target
  targetType      String   // "page", "block", "campaign"
  targetId        String

  // Test settings
  trafficSplit    Json     // { variantA: 50, variantB: 50 }

  // Test status
  status          String   @default("draft") // "draft", "running", "paused", "completed"

  // Test dates
  startDate       DateTime?
  endDate         DateTime?

  // Winner selection
  winnerCriteria  String   @default("conversion") // "conversion", "engagement", "revenue"
  confidenceLevel Decimal  @default(0.95) @db.Decimal(3, 2)
  winnerId        String?  // Variant ID

  // Auto-select winner
  autoSelectWinner Boolean @default(true)
  minSampleSize   Int      @default(1000)

  // Relations
  variants        ABTestVariant[]
  results         ABTestResult[]

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([targetType, targetId])
  @@index([startDate])
  @@map("ab_tests")
}

model ABTestVariant {
  id              String   @id @default(cuid())

  testId          String
  test            ABTest   @relation(fields: [testId], references: [id], onDelete: Cascade)

  // Variant info
  name            String
  description     String?

  // Variant type
  isControl       Boolean  @default(false)

  // Variant content
  contentType     String   // "page", "block", "settings"
  contentData     Json     // Variant-specific modifications

  // If variant is a page
  pageId          String?
  page            CMSPage? @relation(fields: [pageId], references: [id], onDelete: SetNull)

  // Traffic allocation
  trafficPercent  Int      // 0-100

  // Relations
  results         ABTestResult[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([testId])
  @@index([pageId])
  @@map("ab_test_variants")
}

model ABTestResult {
  id              String   @id @default(cuid())

  testId          String
  test            ABTest   @relation(fields: [testId], references: [id], onDelete: Cascade)

  variantId       String
  variant         ABTestVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  // Metrics
  impressions     Int      @default(0)
  uniqueVisitors  Int      @default(0)
  clicks          Int      @default(0)
  conversions     Int      @default(0)
  revenue         Decimal  @default(0) @db.Decimal(10, 2)

  // Calculated metrics
  conversionRate  Decimal? @db.Decimal(5, 4)
  avgRevenuePerVisitor Decimal? @db.Decimal(10, 2)

  // Date aggregation
  date            DateTime @db.Date

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([testId, variantId, date])
  @@index([testId])
  @@index([variantId])
  @@index([date])
  @@map("ab_test_results")
}

// ==========================================
// DYNAMIC WIDGET SYSTEM
// ==========================================

model DynamicWidget {
  id              String   @id @default(cuid())

  // Widget info
  name            String
  description     String?

  // Widget type
  type            String   // "popup", "floating-bar", "notification", "exit-intent", "spin-wheel", etc

  // Widget config
  config          Json     // Type-specific settings

  // Content
  content         Json     // Widget content (text, images, CTA, etc)

  // Trigger conditions
  triggers        Json     // { pageLoad, scroll, exit, idle, etc }

  // Display rules
  targeting       Json?    // { pages, devices, userSegments }
  frequency       String   @default("once-per-session")

  // A/B testing
  variants        Json?    // Multiple variants for testing

  // Schedule
  startDate       DateTime?
  endDate         DateTime?

  // Status
  isActive        Boolean  @default(true)

  // Priority (if multiple widgets)
  priority        Int      @default(0)

  // Analytics
  impressions     Int      @default(0)
  clicks          Int      @default(0)
  conversions     Int      @default(0)
  dismissals      Int      @default(0)

  // Creator
  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id])

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([type])
  @@index([isActive])
  @@index([priority])
  @@index([startDate])
  @@index([endDate])
  @@map("dynamic_widgets")
}

// Widget interaction tracking
model WidgetInteraction {
  id              String   @id @default(cuid())

  widgetId        String

  // User
  userId          String?
  sessionId       String

  // Interaction type
  action          String   // "impression", "click", "conversion", "dismiss"

  // Context
  pageUrl         String
  deviceType      String   // "desktop", "tablet", "mobile"

  // Variant (if A/B testing)
  variantId       String?

  // Timestamp
  timestamp       DateTime @default(now())

  @@index([widgetId])
  @@index([action])
  @@index([timestamp])
  @@map("widget_interactions")
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: CMS Core API (68 items)

#### 1.1 Page Management API

- [ ] Add `CMSPage` model to Prisma schema
- [ ] Run migration: `pnpm prisma migrate dev --name add-cms-core`
- [ ] Create `page.repository.ts`
  - [ ] `create(data)` - Create page
  - [ ] `findById(id)` - Get page
  - [ ] `findBySlug(slug)` - Get page by slug
  - [ ] `findAll(filters)` - List pages with filters
  - [ ] `update(id, data)` - Update page
  - [ ] `publish(id)` - Publish page
  - [ ] `unpublish(id)` - Unpublish page
  - [ ] `duplicate(id)` - Duplicate page
  - [ ] `softDelete(id)` - Soft delete page
  - [ ] `createVersion(id)` - Create version snapshot
  - [ ] `getVersionHistory(id)` - Get version list
  - [ ] `restoreVersion(id, versionId)` - Rollback to version

- [ ] Create `page.service.ts`
  - [ ] `createPage(data, userId)` - Create with validation
  - [ ] `updatePage(id, data, userId)` - Update with audit
  - [ ] `publishPage(id, userId)` - Publish with checks
  - [ ] `schedulePage(id, publishDate, unpublishDate)` - Schedule
  - [ ] `duplicatePage(id, userId)` - Clone page
  - [ ] `getPageForEdit(id, userId)` - Get with auth check
  - [ ] `getPublishedPage(slug)` - Public page fetch
  - [ ] `previewScheduledPage(id, date)` - Preview future state
  - [ ] `validatePageData(data)` - Validate structure
  - [ ] `generatePageSlug(title)` - Auto-generate slug

- [ ] Create `page.controller.ts`
  - [ ] `POST /api/v1/cms/pages` - Create page (admin)
  - [ ] `GET /api/v1/cms/pages` - List pages (admin)
  - [ ] `GET /api/v1/cms/pages/:id` - Get page (admin)
  - [ ] `PUT /api/v1/cms/pages/:id` - Update page (admin)
  - [ ] `DELETE /api/v1/cms/pages/:id` - Delete page (admin)
  - [ ] `POST /api/v1/cms/pages/:id/publish` - Publish (admin)
  - [ ] `POST /api/v1/cms/pages/:id/unpublish` - Unpublish (admin)
  - [ ] `POST /api/v1/cms/pages/:id/duplicate` - Duplicate (admin)
  - [ ] `GET /api/v1/cms/pages/:id/versions` - Version history (admin)
  - [ ] `POST /api/v1/cms/pages/:id/restore/:versionId` - Restore (admin)
  - [ ] `GET /api/v1/pages/:slug` - Get published page (public)

- [ ] Create Zod validation schemas
  - [ ] `CMSPageCreateSchema` - Page creation
  - [ ] `CMSPageUpdateSchema` - Page update
  - [ ] `CMSPageBlockSchema` - Block validation
  - [ ] `CMSPageSettingsSchema` - Page settings
  - [ ] `CMSPageSEOSchema` - SEO metadata

#### 1.2 Block System API

- [ ] Add `CMSPageBlock` and `CMSBlockTemplate` models
- [ ] Create `block.repository.ts`
  - [ ] `createBlock(data)` - Create block instance
  - [ ] `updateBlock(id, data)` - Update block
  - [ ] `deleteBlock(id)` - Delete block
  - [ ] `reorderBlocks(pageId, order)` - Reorder blocks
  - [ ] `findBlocksByPage(pageId)` - Get page blocks
  - [ ] `createTemplate(data)` - Create reusable template
  - [ ] `getTemplates(filters)` - List templates
  - [ ] `useTemplate(templateId)` - Increment usage count

- [ ] Create `block.service.ts`
  - [ ] `addBlockToPage(pageId, blockType, data, order)` - Add block
  - [ ] `updateBlockData(blockId, data)` - Update block content
  - [ ] `moveBlock(blockId, newOrder)` - Reorder block
  - [ ] `duplicateBlock(blockId)` - Clone block
  - [ ] `removeBlock(blockId)` - Delete block
  - [ ] `saveAsTemplate(blockId, name)` - Save block as template
  - [ ] `importTemplate(templateId, pageId, order)` - Import template
  - [ ] `validateBlockData(blockType, data)` - Validate block structure

- [ ] Create block registry system
  - [ ] `registerBlock(type, schema, renderer)` - Register block type
  - [ ] `getBlockSchema(type)` - Get block validation schema
  - [ ] `getAllBlockTypes()` - List available block types
  - [ ] `validateBlock(type, data)` - Validate against schema

- [ ] Create `block.controller.ts`
  - [ ] `POST /api/v1/cms/blocks` - Add block to page (admin)
  - [ ] `PUT /api/v1/cms/blocks/:id` - Update block (admin)
  - [ ] `DELETE /api/v1/cms/blocks/:id` - Delete block (admin)
  - [ ] `PUT /api/v1/cms/blocks/:id/reorder` - Reorder block (admin)
  - [ ] `POST /api/v1/cms/blocks/:id/duplicate` - Duplicate (admin)
  - [ ] `POST /api/v1/cms/blocks/:id/save-template` - Save as template (admin)
  - [ ] `GET /api/v1/cms/block-templates` - List templates (admin)
  - [ ] `POST /api/v1/cms/block-templates/:id/use` - Import template (admin)

---

### 2. Backend: Campaign Management API (54 items)

#### 2.1 Campaign CRUD

- [ ] Add `Campaign` and `CampaignWidget` models
- [ ] Create `campaign.repository.ts`
  - [ ] `create(data)` - Create campaign
  - [ ] `findById(id)` - Get campaign
  - [ ] `findAll(filters)` - List campaigns
  - [ ] `update(id, data)` - Update campaign
  - [ ] `delete(id)` - Delete campaign
  - [ ] `getActiveCampaigns()` - Get active campaigns
  - [ ] `getScheduledCampaigns()` - Get scheduled campaigns
  - [ ] `findByDateRange(start, end)` - Find overlapping campaigns

- [ ] Create `campaign.service.ts`
  - [ ] `createCampaign(data, userId)` - Create with validation
  - [ ] `updateCampaign(id, data, userId)` - Update with audit
  - [ ] `scheduleCampaign(id, startDate, endDate)` - Schedule dates
  - [ ] `activateCampaign(id)` - Manually activate
  - [ ] `deactivateCampaign(id)` - Manually deactivate
  - [ ] `previewCampaign(id)` - Preview campaign changes
  - [ ] `getCampaignAnalytics(id)` - Get performance metrics
  - [ ] `duplicateCampaign(id)` - Clone campaign
  - [ ] `detectConflicts(startDate, endDate)` - Find overlapping campaigns
  - [ ] `applyThemeOverride(campaignId, themeId)` - Apply theme

#### 2.2 Campaign Auto-Activation

- [ ] Create `campaign-activator.job.ts` cron job
  - [ ] Run every minute: `0 * * * * *`
  - [ ] Find campaigns with `startDate <= now` and `status = 'scheduled'`
  - [ ] Apply theme changes
  - [ ] Apply page modifications
  - [ ] Activate widgets
  - [ ] Set `status = 'active'`
  - [ ] Send activation notification
  - [ ] Log activation event

- [ ] Create `campaign-deactivator.job.ts` cron job
  - [ ] Run every minute: `0 * * * * *`
  - [ ] Find campaigns with `endDate <= now` and `status = 'active'`
  - [ ] Revert theme changes
  - [ ] Revert page modifications
  - [ ] Deactivate widgets
  - [ ] Set `status = 'ended'`
  - [ ] Log deactivation event
  - [ ] Archive campaign analytics

#### 2.3 Campaign Widgets

- [ ] Support widget types:
  - [ ] Popup modal (entry, exit, scroll, timed)
  - [ ] Floating bar (top, bottom, side tab)
  - [ ] Notification toast (corner notifications)
  - [ ] Full-page takeover
  - [ ] Slide-in panel

- [ ] Widget trigger conditions:
  - [ ] Page load (immediate or delayed)
  - [ ] Scroll depth (percentage or pixels)
  - [ ] Exit intent (mouse movement detection)
  - [ ] Idle timeout (user inactivity)
  - [ ] Element visibility (specific element in view)
  - [ ] Combination triggers (AND/OR logic)

- [ ] Widget targeting:
  - [ ] Specific pages (URL match)
  - [ ] Page categories (all product pages)
  - [ ] Device types (desktop, tablet, mobile)
  - [ ] User segments (new, returning, cart-abandoners)
  - [ ] Geographic location (country, city)
  - [ ] Time-based (day of week, hour of day)

#### 2.4 Campaign Endpoints

- [ ] `POST /api/v1/cms/campaigns` - Create campaign (admin)
- [ ] `GET /api/v1/cms/campaigns` - List campaigns (admin)
- [ ] `GET /api/v1/cms/campaigns/:id` - Get campaign (admin)
- [ ] `PUT /api/v1/cms/campaigns/:id` - Update campaign (admin)
- [ ] `DELETE /api/v1/cms/campaigns/:id` - Delete campaign (admin)
- [ ] `POST /api/v1/cms/campaigns/:id/activate` - Manual activate (admin)
- [ ] `POST /api/v1/cms/campaigns/:id/deactivate` - Manual deactivate (admin)
- [ ] `GET /api/v1/cms/campaigns/:id/preview` - Preview campaign (admin)
- [ ] `GET /api/v1/cms/campaigns/:id/analytics` - Get analytics (admin)
- [ ] `POST /api/v1/cms/campaigns/:id/duplicate` - Duplicate campaign (admin)

---

### 3. Backend: Contest/Giveaway System (48 items)

#### 3.1 Contest Management

- [ ] Add `Contest`, `ContestEntry`, `ContestWinner` models
- [ ] Create `contest.repository.ts`
  - [ ] `create(data)` - Create contest
  - [ ] `findById(id)` - Get contest
  - [ ] `findAll(filters)` - List contests
  - [ ] `update(id, data)` - Update contest
  - [ ] `delete(id)` - Delete contest
  - [ ] `getActiveContests()` - Get active contests
  - [ ] `addEntry(contestId, entryData)` - Add entry
  - [ ] `getEntries(contestId, filters)` - Get entries
  - [ ] `selectWinners(contestId, count)` - Select winners
  - [ ] `getWinners(contestId)` - Get winner list
  - [ ] `markPrizeDelivered(winnerId)` - Update prize status

- [ ] Create `contest.service.ts`
  - [ ] `createContest(data, userId)` - Create with validation
  - [ ] `updateContest(id, data, userId)` - Update contest
  - [ ] `submitEntry(contestId, entryData)` - Submit entry
  - [ ] `validateEntry(contestId, entryData)` - Validate against rules
  - [ ] `checkDuplicateEntry(contestId, email)` - Fraud detection
  - [ ] `autoSelectWinners(contestId)` - Random winner selection
  - [ ] `manualSelectWinner(contestId, entryId)` - Manual selection
  - [ ] `notifyWinners(contestId)` - Send winner emails
  - [ ] `getContestStats(contestId)` - Get participation stats
  - [ ] `exportEntries(contestId)` - Export to CSV

#### 3.2 Entry Validation & Fraud Detection

- [ ] Validate entry conditions:
  - [ ] Minimum purchase amount (if required)
  - [ ] Social media share (verify share action)
  - [ ] Form submission (required fields)
  - [ ] Age verification (18+ check)
  - [ ] Geographic restrictions (allowed countries)
  - [ ] Existing customer check (email in database)

- [ ] Fraud detection:
  - [ ] Duplicate email detection
  - [ ] Duplicate IP address (same IP multiple entries)
  - [ ] Disposable email detection (blocklist)
  - [ ] Bot detection (CAPTCHA, honeypot)
  - [ ] Entry pattern analysis (too many entries in short time)
  - [ ] Suspicious user agent detection

#### 3.3 Winner Selection Logic

- [ ] Random selection:
  - [ ] Filter out fraudulent entries
  - [ ] Cryptographically secure random selection
  - [ ] Ensure no duplicate winners
  - [ ] Respect entry count (multiple entries = higher chance)

- [ ] Manual selection:
  - [ ] Admin selects specific entry
  - [ ] Validate entry is not fraudulent
  - [ ] Confirm winner acceptance

- [ ] Most entries:
  - [ ] Sort by entry count (highest first)
  - [ ] Select top N entries
  - [ ] Tie-breaker logic (earliest entry wins)

#### 3.4 Winner Notification & Prize Management

- [ ] Create `contest-winner-picker.job.ts` cron job
  - [ ] Run daily: `0 0 * * *`
  - [ ] Find contests with `endDate < now` and `status = 'ended'`
  - [ ] Auto-select winners if configured
  - [ ] Send winner notification emails
  - [ ] Update contest status to `winners-selected`
  - [ ] Log winner selection event

- [ ] Winner email template:
  - [ ] Congratulations message
  - [ ] Prize details
  - [ ] Claim instructions
  - [ ] Claim deadline (e.g., 7 days)
  - [ ] Contact information

- [ ] Prize delivery tracking:
  - [ ] Mark as claimed
  - [ ] Enter shipping information
  - [ ] Generate tracking number
  - [ ] Mark as delivered
  - [ ] Confirmation email

#### 3.5 Contest Endpoints

- [ ] `POST /api/v1/cms/contests` - Create contest (admin)
- [ ] `GET /api/v1/cms/contests` - List contests (admin)
- [ ] `GET /api/v1/cms/contests/:id` - Get contest (admin/public)
- [ ] `PUT /api/v1/cms/contests/:id` - Update contest (admin)
- [ ] `DELETE /api/v1/cms/contests/:id` - Delete contest (admin)
- [ ] `POST /api/v1/contests/:id/enter` - Submit entry (public)
- [ ] `GET /api/v1/contests/:id/stats` - Get stats (public)
- [ ] `POST /api/v1/cms/contests/:id/select-winners` - Select winners (admin)
- [ ] `GET /api/v1/cms/contests/:id/entries` - Get entries (admin)
- [ ] `GET /api/v1/cms/contests/:id/winners` - Get winners (admin)
- [ ] `POST /api/v1/cms/contests/:id/winners/:winnerId/deliver` - Mark delivered (admin)

---

### 4. Backend: Theme System (42 items)

#### 4.1 Theme Management

- [ ] Add `CMSTheme` model
- [ ] Create `theme.repository.ts`
  - [ ] `create(data)` - Create theme
  - [ ] `findById(id)` - Get theme
  - [ ] `findAll(filters)` - List themes
  - [ ] `update(id, data)` - Update theme
  - [ ] `delete(id)` - Delete theme
  - [ ] `getActiveTheme()` - Get currently active theme
  - [ ] `activateTheme(id)` - Set theme as active
  - [ ] `deactivateTheme(id)` - Deactivate theme

- [ ] Create `theme.service.ts`
  - [ ] `createTheme(data, userId)` - Create theme
  - [ ] `updateTheme(id, data, userId)` - Update theme
  - [ ] `activateTheme(id)` - Apply theme site-wide
  - [ ] `deactivateTheme(id)` - Revert to default theme
  - [ ] `compileThemeCSS(themeData)` - Generate CSS from theme
  - [ ] `previewTheme(id)` - Generate preview URL
  - [ ] `duplicateTheme(id)` - Clone theme
  - [ ] `importTheme(themeJSON)` - Import theme from JSON
  - [ ] `exportTheme(id)` - Export theme to JSON
  - [ ] `validateTheme(data)` - Validate theme structure

#### 4.2 Theme Compiler

- [ ] Create `theme-compiler.ts`
  - [ ] Generate CSS variables from theme colors

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-accent: #f59e0b;
  /* ... all theme colors */
}
```

- [ ] Generate typography CSS

```css
:root {
  --font-heading: "Poppins", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-size-h1: 3rem;
  /* ... all typography */
}
```

- [ ] Generate spacing CSS
- [ ] Generate border/shadow CSS
- [ ] Compile custom CSS (sanitize first)
- [ ] Minify CSS output
- [ ] Generate source map
- [ ] Cache compiled CSS (Redis)

#### 4.3 Seasonal Theme Auto-Switch

- [ ] Create seasonal theme scheduler
  - [ ] Define seasonal themes:
    - [ ] Spring (March 20 - June 19): Pastel colors, floral
    - [ ] Summer (June 20 - Sept 21): Bright, vibrant
    - [ ] Autumn (Sept 22 - Dec 20): Warm, earthy
    - [ ] Winter (Dec 21 - March 19): Cool, snowy

- [ ] Create cron job for theme switching
  - [ ] Run daily: `0 0 * * *`
  - [ ] Check current season
  - [ ] If season changed, activate seasonal theme
  - [ ] Log theme change event

- [ ] Support custom seasonal dates:
  - [ ] Allow admin to override season dates
  - [ ] Support regional seasons (Southern hemisphere)
  - [ ] Support holiday themes (Christmas, Ramadan, etc.)

#### 4.4 Theme Customizer Features

- [ ] Color customization:
  - [ ] Color picker (hex, rgb, hsl)
  - [ ] Color palette generator (primary → variants)
  - [ ] Contrast checker (WCAG compliance)
  - [ ] Recent colors history

- [ ] Typography customization:
  - [ ] Google Fonts integration (1000+ fonts)
  - [ ] Font pairing suggestions
  - [ ] Font size scale generator
  - [ ] Line height calculator

- [ ] Spacing customization:
  - [ ] Spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
  - [ ] Margin presets
  - [ ] Padding presets

- [ ] Visual effects:
  - [ ] Border radius presets (none, small, medium, large, full)
  - [ ] Shadow presets (none, sm, md, lg, xl)
  - [ ] Animation speed (slow, normal, fast)

#### 4.5 Theme Endpoints

- [ ] `POST /api/v1/cms/themes` - Create theme (admin)
- [ ] `GET /api/v1/cms/themes` - List themes (admin)
- [ ] `GET /api/v1/cms/themes/:id` - Get theme (admin)
- [ ] `PUT /api/v1/cms/themes/:id` - Update theme (admin)
- [ ] `DELETE /api/v1/cms/themes/:id` - Delete theme (admin)
- [ ] `POST /api/v1/cms/themes/:id/activate` - Activate theme (admin)
- [ ] `POST /api/v1/cms/themes/:id/deactivate` - Deactivate theme (admin)
- [ ] `GET /api/v1/cms/themes/:id/preview` - Preview theme (admin)
- [ ] `POST /api/v1/cms/themes/:id/duplicate` - Duplicate theme (admin)
- [ ] `POST /api/v1/cms/themes/import` - Import theme JSON (admin)
- [ ] `GET /api/v1/cms/themes/:id/export` - Export theme JSON (admin)

---

### 5. Backend: Content Scheduler (36 items)

#### 5.1 Scheduler Core

- [ ] Add `ScheduledContent` model
- [ ] Create `scheduler.repository.ts`
  - [ ] `create(data)` - Create scheduled action
  - [ ] `findById(id)` - Get scheduled action
  - [ ] `findAll(filters)` - List scheduled actions
  - [ ] `update(id, data)` - Update schedule
  - [ ] `cancel(id)` - Cancel scheduled action
  - [ ] `getPendingActions(date)` - Get actions due for execution
  - [ ] `markExecuted(id, result)` - Mark as executed
  - [ ] `markFailed(id, error)` - Mark as failed

- [ ] Create `scheduler.service.ts`
  - [ ] `schedulePublish(pageId, date)` - Schedule page publish
  - [ ] `scheduleUnpublish(pageId, date)` - Schedule page unpublish
  - [ ] `scheduleCampaign(campaignId, startDate, endDate)` - Schedule campaign
  - [ ] `scheduleThemeSwitch(themeId, date)` - Schedule theme change
  - [ ] `scheduleWidgetActivation(widgetId, startDate, endDate)` - Schedule widget
  - [ ] `cancelScheduledAction(id)` - Cancel action
  - [ ] `previewScheduledState(date)` - Preview how site looks at future date
  - [ ] `getUpcomingChanges()` - Get timeline of upcoming changes
  - [ ] `detectConflicts(date)` - Find conflicting schedules

#### 5.2 Scheduler Engine

- [ ] Create `scheduled-content.job.ts` cron job
  - [ ] Run every minute: `0 * * * * *`
  - [ ] Fetch pending actions (now <= scheduledAt <= now+1min)
  - [ ] Execute actions:
    - [ ] Publish page: Set status to published, update publishedAt
    - [ ] Unpublish page: Set status to draft, clear publishedAt
    - [ ] Activate campaign: Call campaign activator
    - [ ] Deactivate campaign: Call campaign deactivator
    - [ ] Switch theme: Activate new theme, compile CSS
    - [ ] Activate widget: Set isActive = true
    - [ ] Deactivate widget: Set isActive = false
  - [ ] Mark actions as executed
  - [ ] Handle errors gracefully (retry logic)
  - [ ] Send notification on execution (email/webhook)
  - [ ] Log all actions

#### 5.3 Recurring Schedules

- [ ] Support recurring actions:
  - [ ] Daily (every day at specific time)
  - [ ] Weekly (specific days of week)
  - [ ] Monthly (specific day of month)
  - [ ] Custom cron expression

- [ ] Implement cron parser:
  - [ ] Parse cron expression
  - [ ] Calculate next execution time
  - [ ] Create next scheduled action after execution
  - [ ] Handle timezone conversions

#### 5.4 Scheduler Preview

- [ ] Time machine feature:
  - [ ] Accept future date as input
  - [ ] Apply all scheduled changes up to that date
  - [ ] Generate preview of pages/campaigns/theme
  - [ ] Return preview URLs
  - [ ] Don't persist changes (read-only preview)

#### 5.5 Scheduler Endpoints

- [ ] `POST /api/v1/cms/scheduler/schedule` - Create scheduled action (admin)
- [ ] `GET /api/v1/cms/scheduler` - List scheduled actions (admin)
- [ ] `GET /api/v1/cms/scheduler/:id` - Get scheduled action (admin)
- [ ] `PUT /api/v1/cms/scheduler/:id` - Update schedule (admin)
- [ ] `DELETE /api/v1/cms/scheduler/:id` - Cancel schedule (admin)
- [ ] `GET /api/v1/cms/scheduler/upcoming` - Get upcoming changes (admin)
- [ ] `POST /api/v1/cms/scheduler/preview` - Preview future state (admin)
- [ ] `GET /api/v1/cms/scheduler/conflicts` - Detect conflicts (admin)

---

### 6. Backend: A/B Testing Engine (44 items)

#### 6.1 A/B Test Management

- [ ] Add `ABTest`, `ABTestVariant`, `ABTestResult` models
- [ ] Create `abtest.repository.ts`
  - [ ] `create(data)` - Create A/B test
  - [ ] `findById(id)` - Get test
  - [ ] `findAll(filters)` - List tests
  - [ ] `update(id, data)` - Update test
  - [ ] `delete(id)` - Delete test
  - [ ] `addVariant(testId, variantData)` - Add variant
  - [ ] `updateVariant(variantId, data)` - Update variant
  - [ ] `removeVariant(variantId)` - Remove variant
  - [ ] `recordResult(testId, variantId, metrics)` - Record metrics
  - [ ] `getResults(testId)` - Get aggregated results
  - [ ] `selectWinner(testId, variantId)` - Mark winner

- [ ] Create `abtest.service.ts`
  - [ ] `createTest(data, userId)` - Create test with variants
  - [ ] `updateTest(id, data, userId)` - Update test
  - [ ] `startTest(id)` - Start running test
  - [ ] `pauseTest(id)` - Pause test
  - [ ] `endTest(id)` - End test
  - [ ] `getVariantForUser(testId, userId/sessionId)` - Assign variant
  - [ ] `trackImpression(testId, variantId, userId)` - Track view
  - [ ] `trackClick(testId, variantId, userId)` - Track click
  - [ ] `trackConversion(testId, variantId, userId, revenue)` - Track conversion
  - [ ] `analyzeResults(testId)` - Statistical analysis
  - [ ] `autoSelectWinner(testId)` - Auto-select based on confidence
  - [ ] `applyWinnerVariant(testId)` - Apply winning variant permanently

#### 6.2 Variant Assignment Logic

- [ ] Implement traffic splitting:
  - [ ] Hash-based assignment (user ID/session ID → variant)
  - [ ] Consistent assignment (same user always sees same variant)
  - [ ] Traffic percentage enforcement (50/50, 70/30, etc.)
  - [ ] Support for multi-variant tests (A/B/C/D)

- [ ] User bucketing:
  - [ ] Generate bucket ID from user/session
  - [ ] Map bucket to variant based on traffic split
  - [ ] Store assignment in cookie/database
  - [ ] Respect previous assignment (sticky sessions)

#### 6.3 Statistical Analysis

- [ ] Calculate metrics per variant:
  - [ ] Impressions (views)
  - [ ] Unique visitors
  - [ ] Click-through rate (CTR)
  - [ ] Conversion rate
  - [ ] Average order value (AOV)
  - [ ] Revenue per visitor (RPV)

- [ ] Statistical significance testing:
  - [ ] Chi-square test for conversion rate difference
  - [ ] Calculate confidence level (95%, 99%)
  - [ ] Calculate p-value
  - [ ] Determine if result is statistically significant
  - [ ] Calculate required sample size

- [ ] Winner selection criteria:
  - [ ] Highest conversion rate (with statistical significance)
  - [ ] Highest revenue per visitor
  - [ ] Lowest bounce rate
  - [ ] Custom metric (admin-defined)

#### 6.4 A/B Test Auto-Analyzer Job

- [ ] Create `abtest-analyzer.job.ts` cron job
  - [ ] Run daily: `0 0 * * *`
  - [ ] Find running tests with `autoSelectWinner = true`
  - [ ] Check if min sample size reached
  - [ ] Perform statistical analysis
  - [ ] If significance threshold met:
    - [ ] Select winner variant
    - [ ] End test
    - [ ] Apply winner variant (if configured)
    - [ ] Send notification
  - [ ] Log analysis results

#### 6.5 A/B Test Endpoints

- [ ] `POST /api/v1/cms/abtests` - Create A/B test (admin)
- [ ] `GET /api/v1/cms/abtests` - List tests (admin)
- [ ] `GET /api/v1/cms/abtests/:id` - Get test (admin)
- [ ] `PUT /api/v1/cms/abtests/:id` - Update test (admin)
- [ ] `DELETE /api/v1/cms/abtests/:id` - Delete test (admin)
- [ ] `POST /api/v1/cms/abtests/:id/start` - Start test (admin)
- [ ] `POST /api/v1/cms/abtests/:id/pause` - Pause test (admin)
- [ ] `POST /api/v1/cms/abtests/:id/end` - End test (admin)
- [ ] `GET /api/v1/cms/abtests/:id/results` - Get results (admin)
- [ ] `POST /api/v1/cms/abtests/:id/select-winner` - Manual winner selection (admin)
- [ ] `POST /api/v1/cms/abtests/:id/apply-winner` - Apply winner (admin)
- [ ] `GET /api/v1/abtests/:id/variant` - Get variant for user (public)
- [ ] `POST /api/v1/abtests/:id/track` - Track event (public)

---

### 7. Backend: Dynamic Widget System (38 items)

#### 7.1 Widget Management

- [ ] Add `DynamicWidget` and `WidgetInteraction` models
- [ ] Create `widget.repository.ts`
  - [ ] `create(data)` - Create widget
  - [ ] `findById(id)` - Get widget
  - [ ] `findAll(filters)` - List widgets
  - [ ] `update(id, data)` - Update widget
  - [ ] `delete(id)` - Delete widget
  - [ ] `getActiveWidgets(pageUrl, deviceType)` - Get widgets for page
  - [ ] `trackInteraction(widgetId, action, metadata)` - Track interaction
  - [ ] `getWidgetAnalytics(widgetId)` - Get widget stats

- [ ] Create `widget.service.ts`
  - [ ] `createWidget(data, userId)` - Create with validation
  - [ ] `updateWidget(id, data, userId)` - Update widget
  - [ ] `activateWidget(id)` - Activate widget
  - [ ] `deactivateWidget(id)` - Deactivate widget
  - [ ] `getWidgetsForPage(url, device, userContext)` - Smart widget selection
  - [ ] `checkTriggerConditions(widget, context)` - Evaluate triggers
  - [ ] `checkFrequencyLimit(widgetId, userId)` - Check if should display
  - [ ] `recordImpression(widgetId, userId)` - Track impression
  - [ ] `recordClick(widgetId, userId)` - Track click
  - [ ] `recordConversion(widgetId, userId)` - Track conversion
  - [ ] `recordDismissal(widgetId, userId)` - Track dismissal

#### 7.2 Widget Types Implementation

- [ ] **Popup Modal** widget:
  - [ ] Center modal with overlay
  - [ ] Configurable size (small, medium, large, full)
  - [ ] Close button (show/hide)
  - [ ] Overlay dismissal (allow/block)
  - [ ] Content: headline, body, image, CTA
  - [ ] Form fields (email, name, phone)
  - [ ] Multi-step popups

- [ ] **Floating Bar** widget:
  - [ ] Position: top, bottom, side tab
  - [ ] Sticky positioning
  - [ ] Collapsible/expandable
  - [ ] Content: short text, CTA button
  - [ ] Close button
  - [ ] Auto-hide after X seconds

- [ ] **Notification Toast** widget:
  - [ ] Position: top-left, top-right, bottom-left, bottom-right
  - [ ] Auto-dismiss after X seconds
  - [ ] Stack multiple notifications
  - [ ] Content: icon, text, CTA
  - [ ] Social proof: "John just purchased X"

- [ ] **Exit Intent** popup:
  - [ ] Mouse tracking
  - [ ] Trigger on mouse leave (toward browser close)
  - [ ] One-time display (per session/ever)
  - [ ] Special offer content

- [ ] **Spin-to-Win Wheel** widget:
  - [ ] Gamification wheel
  - [ ] Prize configuration (% chance per prize)
  - [ ] Entry requirements (email, social share)
  - [ ] Coupon code generation
  - [ ] Duplicate entry prevention

#### 7.3 Widget Trigger System

- [ ] Page load triggers:
  - [ ] Immediate (0ms delay)
  - [ ] Delayed (X seconds after load)
  - [ ] DOM ready (after page fully loaded)

- [ ] Scroll triggers:
  - [ ] Scroll depth (25%, 50%, 75%, 100%)
  - [ ] Scroll to element (specific DOM element in view)
  - [ ] Scroll direction (up/down)

- [ ] User interaction triggers:
  - [ ] Click on element (specific selector)
  - [ ] Form abandon (start typing, then leave)
  - [ ] Add to cart (product added)
  - [ ] Idle timeout (no activity for X seconds)

- [ ] Exit intent triggers:
  - [ ] Mouse leave (cursor to browser close button)
  - [ ] Browser blur (switch to different tab)
  - [ ] Back button intent

#### 7.4 Widget Targeting

- [ ] Page targeting:
  - [ ] Specific URLs (exact match, contains, regex)
  - [ ] URL parameters (utm_source=facebook)
  - [ ] Page types (homepage, product, category, cart)
  - [ ] Exclude URLs

- [ ] Device targeting:
  - [ ] Desktop only
  - [ ] Mobile only
  - [ ] Tablet only
  - [ ] Specific screen sizes

- [ ] User segment targeting:
  - [ ] New visitors (first visit)
  - [ ] Returning visitors
  - [ ] Logged in users
  - [ ] Guest users
  - [ ] Cart abandoners (items in cart)
  - [ ] Previous purchasers

#### 7.5 Widget Endpoints

- [ ] `POST /api/v1/cms/widgets` - Create widget (admin)
- [ ] `GET /api/v1/cms/widgets` - List widgets (admin)
- [ ] `GET /api/v1/cms/widgets/:id` - Get widget (admin)
- [ ] `PUT /api/v1/cms/widgets/:id` - Update widget (admin)
- [ ] `DELETE /api/v1/cms/widgets/:id` - Delete widget (admin)
- [ ] `POST /api/v1/cms/widgets/:id/activate` - Activate widget (admin)
- [ ] `POST /api/v1/cms/widgets/:id/deactivate` - Deactivate widget (admin)
- [ ] `GET /api/v1/cms/widgets/:id/analytics` - Get widget analytics (admin)
- [ ] `GET /api/v1/widgets/active` - Get active widgets for page (public)
- [ ] `POST /api/v1/widgets/:id/track` - Track widget interaction (public)

---

### 8. Frontend: Visual Page Builder Core (82 items)

#### 8.1 Page Builder Shell

- [ ] Create `app/(admin)/cms/pages/[id]/edit/page.tsx`
- [ ] Create `PageBuilder.tsx` main component
  - [ ] Full-screen layout
  - [ ] Top toolbar
  - [ ] Left sidebar (block library)
  - [ ] Center canvas (drag-drop area)
  - [ ] Right sidebar (block inspector)
  - [ ] Bottom panel (device preview, history)

#### 8.2 Block Library Sidebar

- [ ] Create `BlockSidebar.tsx`
  - [ ] Search blocks
  - [ ] Category tabs (Layout, Content, Product, Marketing, Media)
  - [ ] Block grid with thumbnails
  - [ ] Drag to canvas
  - [ ] Block info tooltip on hover
  - [ ] Favorites/recent blocks

#### 8.3 Drag-Drop Canvas

- [ ] Create `BlockCanvas.tsx`
  - [ ] Install `@dnd-kit/core`: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
  - [ ] DnD context provider
  - [ ] Droppable zones
  - [ ] Draggable blocks
  - [ ] Visual drop indicator (blue line)
  - [ ] Block hover state (highlight)
  - [ ] Block selection state (border)
  - [ ] Empty state (when no blocks)

- [ ] Implement drag-drop logic with @dnd-kit:

```typescript
const { sensors, handleDragStart, handleDragOver, handleDragEnd } = useDndKitBlockSorting({
  blocks,
  onBlocksReorder: (newBlocks) => {
    updatePageBlocks(newBlocks);
  },
});
```

- [ ] Block controls overlay:
  - [ ] Edit button (opens inspector)
  - [ ] Duplicate button
  - [ ] Delete button
  - [ ] Drag handle
  - [ ] Move up/down buttons

#### 8.4 Block Inspector Panel

- [ ] Create `BlockInspector.tsx`
  - [ ] Show when block selected
  - [ ] Block type display
  - [ ] Content settings (block-specific)
  - [ ] Style settings (common: margin, padding, background)
  - [ ] Advanced settings (custom CSS, animations)
  - [ ] Responsive settings (per-device overrides)

- [ ] Common settings for all blocks:
  - [ ] Margin (top, right, bottom, left)
  - [ ] Padding (top, right, bottom, left)
  - [ ] Background (color, image, gradient)
  - [ ] Border (width, style, color, radius)
  - [ ] Shadow (none, sm, md, lg, xl)
  - [ ] Animation (fade-in, slide-up, zoom, etc.)
  - [ ] Custom CSS class
  - [ ] Custom ID

#### 8.5 Device Preview

- [ ] Create `DevicePreview.tsx`
  - [ ] Desktop view (1920px)
  - [ ] Tablet view (768px)
  - [ ] Mobile view (375px)
  - [ ] Toggle buttons for each device
  - [ ] Scale content to fit (zoom factor)
  - [ ] Device frame (optional)

#### 8.6 Version History

- [ ] Create `VersionHistory.tsx`
  - [ ] Timeline view
  - [ ] Version thumbnails (screenshot)
  - [ ] Version metadata (date, user, changes)
  - [ ] Restore version button
  - [ ] Compare versions (diff view)
  - [ ] Auto-save indicator

- [ ] Implement undo/redo:
  - [ ] Create `usePageHistory` hook
  - [ ] State history array (max 50 states)
  - [ ] Current history index
  - [ ] `undo()` - Go back one step
  - [ ] `redo()` - Go forward one step
  - [ ] `saveState()` - Snapshot current state
  - [ ] Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)

#### 8.7 Save & Publish

- [ ] Create `SavePublish.tsx`
  - [ ] Save draft button
  - [ ] Publish button
  - [ ] Publish dropdown:
    - [ ] Publish now
    - [ ] Schedule publish
    - [ ] Unpublish
  - [ ] Save status indicator ("Saving...", "All changes saved", "Error")
  - [ ] Auto-save every 30 seconds
  - [ ] Unsaved changes warning (beforeunload)

---

### 9. Frontend: Block Library (50+ Blocks) (150+ items total)

_Note: Due to character limit, only showing structure. Each block has ~3-5 items._

#### 9.1 Layout Blocks

- [ ] **Container Block** (3 items)
  - [ ] Implement `ContainerBlock.tsx`
  - [ ] Settings: max-width, padding, background
  - [ ] Responsive: stack on mobile

- [ ] **Columns Block** (5 items)
  - [ ] Implement `ColumnsBlock.tsx`
  - [ ] Settings: column count (2-6), gap, alignment
  - [ ] Responsive: stack columns on mobile
  - [ ] Drag-drop content into columns
  - [ ] Unequal column widths (30/70, 40/60, etc.)

- [ ] **Grid Block** (4 items)
  - [ ] Implement `GridBlock.tsx`
  - [ ] Settings: columns, rows, gap
  - [ ] Responsive: auto-fit/auto-fill
  - [ ] Drag-drop items into grid

#### 9.2 Hero Blocks

- [ ] **Hero - Centered** (5 items)
- [ ] **Hero - Left Aligned** (5 items)
- [ ] **Hero - Split (Image + Text)** (5 items)
- [ ] **Hero - Video Background** (6 items)
- [ ] **Hero - Animated** (6 items)

#### 9.3 Content Blocks

- [ ] **Text Block** (4 items)
- [ ] **Rich Text Block** (with WYSIWYG editor) (6 items)
- [ ] **Heading Block** (3 items)
- [ ] **Button Block** (5 items)
- [ ] **Button Group Block** (4 items)

#### 9.4 Media Blocks

- [ ] **Image Block** (5 items)
- [ ] **Image Gallery Block** (7 items)
- [ ] **Video Block** (YouTube/Vimeo embed) (5 items)
- [ ] **Carousel/Slider Block** (8 items)

#### 9.5 Product Blocks

- [ ] **Product Grid Block** (8 items)
- [ ] **Product Slider Block** (7 items)
- [ ] **Featured Product Block** (6 items)
- [ ] **Product Categories Block** (5 items)

#### 9.6 Marketing Blocks

- [ ] **Countdown Timer Block** (6 items)
- [ ] **Testimonial Block** (5 items)
- [ ] **Testimonial Slider Block** (6 items)
- [ ] **Social Proof Block** ("X people viewing") (5 items)
- [ ] **Newsletter Form Block** (6 items)
- [ ] **Call-to-Action Block** (5 items)

#### 9.7 Interactive Blocks

- [ ] **FAQ Accordion Block** (6 items)
- [ ] **Tabs Block** (6 items)
- [ ] **Toggle Block** (4 items)
- [ ] **Pricing Table Block** (7 items)

#### 9.8 Social Blocks

- [ ] **Social Share Buttons Block** (4 items)
- [ ] **Social Media Feed Block** (Instagram/Twitter) (6 items)
- [ ] **Social Icons Block** (4 items)

#### 9.9 Form Blocks

- [ ] **Contact Form Block** (7 items)
- [ ] **Custom Form Block** (8 items)
- [ ] **Survey/Poll Block** (6 items)

#### 9.10 Advanced Blocks

- [ ] **Custom HTML Block** (4 items)
- [ ] **Embed Block** (iframe) (4 items)
- [ ] **Spacer Block** (3 items)
- [ ] **Divider Block** (4 items)
- [ ] **Map Block** (Google Maps embed) (5 items)

---

_(Continuing with remaining sections...)_

### 10. Frontend: Campaign Manager (32 items)

_(Campaign creation UI, scheduler, theme selector, analytics)_

### 11. Frontend: Contest Manager (28 items)

_(Contest creation UI, entry rules, winner picker)_

### 12. Frontend: Theme Customizer (38 items)

_(Visual theme editor, color picker, typography, live preview)_

### 13. Frontend: Scheduler Dashboard (24 items)

_(Calendar view, schedule editor, preview future state)_

### 14. Frontend: A/B Test Manager (30 items)

_(Variant editor, analytics dashboard, winner selection)_

### 15. Frontend: Widget Manager (34 items)

_(Widget editor, trigger configuration, targeting)_

### 16. Frontend: Block Renderers (Frontend Display) (50+ items)

_(Server-side rendering for each block type)_

### 17. Testing & QA (56 items)

_(Unit tests, integration tests, E2E tests, performance tests)_

### 18. Documentation & Operational Readiness (38 items)

_(API docs, user guide, admin guide, runbook)_

---

## 🧪 VALIDATION CRITERIA

```bash
# Run all CMS tests
pnpm --filter @lumi/backend test cms
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/features/cms/**"

# Run integration tests
pnpm --filter @lumi/backend test:integration cms

# Run E2E tests
pnpm --filter @lumi/frontend exec playwright test tests/e2e/cms.spec.ts

# Check test coverage (must be ≥85%)
pnpm test:coverage
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics

- ✅ Test coverage ≥85% (CMS module)
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors
- ✅ 100% Zod validation coverage

### Performance Metrics

- ✅ Page builder load: <2s
- ✅ Block operations: <100ms
- ✅ Preview update: <500ms
- ✅ CMS pages LCP: <1.5s
- ✅ Lighthouse Performance ≥90

### Business Metrics

- ✅ Zero-code page creation by marketing team
- ✅ Campaign creation: <10 minutes
- ✅ >10 seasonal campaigns per year
- ✅ >50 custom pages created
- ✅ A/B testing ROI: +20% conversion

---

## 📦 DELIVERABLES

### 1. Backend (850 items total)

- ✅ Complete CMS API
- ✅ Campaign management
- ✅ Contest system
- ✅ Theme engine
- ✅ Content scheduler
- ✅ A/B testing engine
- ✅ Widget system

### 2. Frontend (Full visual builder)

- ✅ Page builder with 50+ blocks
- ✅ Campaign manager
- ✅ Contest manager
- ✅ Theme customizer
- ✅ Scheduler dashboard
- ✅ A/B test dashboard
- ✅ Widget manager

### 3. Documentation

- ✅ API documentation (OpenAPI)
- ✅ User guide (marketing team)
- ✅ Admin guide (technical team)
- ✅ Block development guide
- ✅ Runbook (operations)

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. XSS Vulnerabilities in Custom HTML Blocks

❌ **Wrong:**

```typescript
// Render user-provided HTML without sanitization
function CustomHTMLBlock({ data }) {
  return <div dangerouslySetInnerHTML={{ __html: data.html }} />;
}
```

✅ **Correct:**

```typescript
// Sanitize HTML content (S2)
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'a', 'strong', 'em', 'ul', 'li', 'h1', 'h2', 'h3'];
const ALLOWED_ATTRS = ['href', 'title', 'target'];

function CustomHTMLBlock({ data }) {
  const sanitized = DOMPurify.sanitize(data.html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### 2. Missing RBAC Protection on CMS Endpoints

❌ **Wrong:**

```typescript
// No authentication or authorization
app.post("/api/cms/pages", async (req, res) => {
  const page = await pageService.create(req.body);
  res.json({ success: true, data: page });
});
```

✅ **Correct:**

```typescript
// RBAC protection (S3)
import { requireAuth, requireRole } from "@/middleware/auth";

app.post(
  "/api/cms/pages",
  requireAuth(),
  requireRole(["admin", "manager", "editor"]),
  validateRequest(createPageSchema),
  async (req, res) => {
    const page = await pageService.create(req.body, req.user.id);
    await auditLog.log("page_created", { pageId: page.id, userId: req.user.id });
    res.json(formatSuccess(page));
  },
);
```

### 3. Campaign Auto-Activation Without Validation

❌ **Wrong:**

```typescript
// Activate campaign without checking conflicts
async function activateCampaign(campaignId: string) {
  const campaign = await db.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });
  await applyTheme(campaign.themeId);
}
```

✅ **Correct:**

```typescript
// Validate before activation, check conflicts
async function activateCampaign(campaignId: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });

  // Check for conflicts
  const conflicts = await db.campaign.findMany({
    where: {
      status: "active",
      endDate: { gte: campaign.startDate },
      startDate: { lte: campaign.endDate },
    },
  });

  if (conflicts.length > 0) {
    throw new Error(`Campaign conflicts with: ${conflicts.map((c) => c.name).join(", ")}`);
  }

  // Validate theme exists
  if (campaign.themeId) {
    const theme = await db.cmsTheme.findUnique({ where: { id: campaign.themeId } });
    if (!theme) throw new Error("Theme not found");
  }

  // Activate with transaction
  await db.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: "active", activatedAt: new Date() },
    });

    if (campaign.themeId) {
      await applyTheme(campaign.themeId, tx);
    }
  });

  logger.info("Campaign activated", { campaignId, name: campaign.name });
}
```

### 4. Contest Winner Selection Without Fraud Detection

❌ **Wrong:**

```typescript
// Pick winners randomly without checking for fraud
async function pickWinners(contestId: string) {
  const entries = await db.contestEntry.findMany({ where: { contestId } });
  const winners = shuffle(entries).slice(0, winnerCount);

  await db.contestWinner.createMany({
    data: winners.map((e) => ({ contestId, userId: e.userId })),
  });
}
```

✅ **Correct:**

```typescript
// Fraud detection before winner selection
async function pickWinners(contestId: string) {
  const contest = await db.contest.findUnique({ where: { id: contestId } });

  // Get all entries
  let entries = await db.contestEntry.findMany({
    where: { contestId },
    include: { user: true },
  });

  // Fraud detection
  const suspiciousEntries = entries.filter((entry) => {
    const user = entry.user;

    // Check multiple entries from same IP (if tracked)
    // Check accounts created just before contest
    const accountAge = Date.now() - user.createdAt.getTime();
    if (accountAge < 24 * 60 * 60 * 1000) return true; // <24 hours

    // Check if email is disposable
    if (isDisposableEmail(user.email)) return true;

    return false;
  });

  // Filter out suspicious entries
  const validEntries = entries.filter((e) => !suspiciousEntries.includes(e));

  logger.warn("Filtered suspicious entries", {
    total: entries.length,
    suspicious: suspiciousEntries.length,
    valid: validEntries.length,
  });

  // Pick winners from valid entries
  const winners = shuffle(validEntries).slice(0, contest.winnerCount);

  await db.$transaction(async (tx) => {
    await tx.contestWinner.createMany({
      data: winners.map((e) => ({
        contestId,
        userId: e.userId,
        selectedAt: new Date(),
        method: "random",
      })),
    });

    await tx.contest.update({
      where: { id: contestId },
      data: { status: "completed", winnersSelectedAt: new Date() },
    });
  });

  // Send notifications to winners
  await notificationService.notifyWinners(winners);
}
```

### 5. No Performance Optimization for Block Rendering

❌ **Wrong:**

```typescript
// Render all blocks without lazy loading
function PageRenderer({ blocks }) {
  return (
    <div>
      {blocks.map(block => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
```

✅ **Correct:**

```typescript
// Lazy load below-fold blocks (P1/P2)
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic imports for block types
const HeroBlock = dynamic(() => import('./blocks/HeroBlock'));
const ProductGridBlock = dynamic(() => import('./blocks/ProductGridBlock'));
// ... other blocks

function PageRenderer({ blocks }) {
  return (
    <div>
      {blocks.map((block, index) => {
        const BlockComponent = getBlockComponent(block.type);
        const isAboveFold = index < 2; // First 2 blocks

        if (isAboveFold) {
          // Render immediately for LCP
          return <BlockComponent key={block.id} {...block.data} />;
        }

        // Lazy load with intersection observer
        return (
          <Suspense key={block.id} fallback={<BlockSkeleton />}>
            <LazyBlock>
              <BlockComponent {...block.data} />
            </LazyBlock>
          </Suspense>
        );
      })}
    </div>
  );
}

// Intersection observer for lazy loading
function LazyBlock({ children }) {
  const ref = useRef();
  const isInView = useInView(ref, { once: true, margin: '200px' });

  return <div ref={ref}>{isInView ? children : <BlockSkeleton />}</div>;
}
```

### 6. Theme CSS Not Cached

❌ **Wrong:**

```typescript
// Generate theme CSS on every request
app.get("/api/theme/current", async (req, res) => {
  const theme = await db.cmsTheme.findFirst({ where: { isActive: true } });
  const css = compileThemeToCSS(theme);
  res.setHeader("Content-Type", "text/css");
  res.send(css);
});
```

✅ **Correct:**

```typescript
// Cache compiled theme CSS (P2)
import NodeCache from "node-cache";

const themeCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

app.get("/api/theme/current", async (req, res) => {
  const activeTheme = await db.cmsTheme.findFirst({ where: { isActive: true } });

  const cacheKey = `theme_css_${activeTheme.id}_v${activeTheme.version}`;
  let css = themeCache.get(cacheKey);

  if (!css) {
    css = compileThemeToCSS(activeTheme);
    themeCache.set(cacheKey, css);
    logger.info("Theme CSS compiled and cached", { themeId: activeTheme.id });
  }

  res.setHeader("Content-Type", "text/css");
  res.setHeader("Cache-Control", "public, max-age=3600, immutable");
  res.setHeader("ETag", `"${activeTheme.id}-v${activeTheme.version}"`);
  res.send(css);
});

// Invalidate cache on theme update
async function updateTheme(themeId: string, data: any) {
  const theme = await db.cmsTheme.update({
    where: { id: themeId },
    data: { ...data, version: { increment: 1 } },
  });

  themeCache.del(`theme_css_${themeId}_v${theme.version - 1}`);
  logger.info("Theme cache invalidated", { themeId });

  return theme;
}
```

### 7. A/B Test Winner Selection Without Statistical Significance

❌ **Wrong:**

```typescript
// Pick winner based on raw conversion numbers
async function selectWinner(testId: string) {
  const variants = await db.abTestVariant.findMany({ where: { testId } });
  const winner = variants.reduce((max, v) => (v.conversions > max.conversions ? v : max));

  await db.abTest.update({
    where: { id: testId },
    data: { winnerId: winner.id, status: "completed" },
  });
}
```

✅ **Correct:**

```typescript
// Calculate statistical significance before selecting winner
import { chiSquareTest } from "@/utils/statistics";

async function selectWinner(testId: string) {
  const test = await db.abTest.findUnique({
    where: { id: testId },
    include: { variants: true },
  });

  // Calculate conversion rates
  const variantStats = test.variants.map((v) => ({
    id: v.id,
    name: v.name,
    visitors: v.visitors,
    conversions: v.conversions,
    conversionRate: v.conversions / v.visitors,
  }));

  // Sort by conversion rate
  variantStats.sort((a, b) => b.conversionRate - a.conversionRate);
  const [best, ...others] = variantStats;

  // Check statistical significance (95% confidence)
  const isSignificant = chiSquareTest(
    [best.conversions, best.visitors - best.conversions],
    [others[0].conversions, others[0].visitors - others[0].conversions],
    0.05, // p-value threshold
  );

  if (!isSignificant) {
    logger.warn("A/B test results not statistically significant", {
      testId,
      bestVariant: best.name,
      pValue: isSignificant.pValue,
    });

    throw new Error("Cannot select winner: results not statistically significant");
  }

  // Select winner
  await db.$transaction(async (tx) => {
    await tx.abTest.update({
      where: { id: testId },
      data: {
        winnerId: best.id,
        status: "completed",
        completedAt: new Date(),
        significanceLevel: isSignificant.pValue,
      },
    });

    // Apply winning variant to production
    await applyVariant(best.id, tx);
  });

  logger.info("A/B test winner selected", {
    testId,
    winner: best.name,
    conversionRate: best.conversionRate,
    pValue: isSignificant.pValue,
  });
}
```

### 8. No Version History for Pages

❌ **Wrong:**

```typescript
// Overwrite page without keeping history
async function updatePage(pageId: string, data: any) {
  const page = await db.cmsPage.update({
    where: { id: pageId },
    data,
  });
  return page;
}
```

✅ **Correct:**

```typescript
// Create version snapshot before updating
async function updatePage(pageId: string, data: any, userId: string) {
  const currentPage = await db.cmsPage.findUnique({
    where: { id: pageId },
    include: { blocks: true },
  });

  await db.$transaction(async (tx) => {
    // Create version snapshot
    const snapshot = await tx.cmsPageVersion.create({
      data: {
        pageId,
        version: currentPage.version,
        title: currentPage.title,
        blocks: currentPage.blocks,
        settings: currentPage.settings,
        createdBy: userId,
        createdAt: new Date(),
      },
    });

    // Update page with new version
    const updatedPage = await tx.cmsPage.update({
      where: { id: pageId },
      data: {
        ...data,
        version: { increment: 1 },
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });

    logger.info("Page updated with version history", {
      pageId,
      oldVersion: currentPage.version,
      newVersion: updatedPage.version,
      snapshotId: snapshot.id,
    });
  });

  return currentPage;
}

// Rollback to previous version
async function rollbackPage(pageId: string, versionId: string) {
  const snapshot = await db.cmsPageVersion.findUnique({
    where: { id: versionId },
  });

  if (snapshot.pageId !== pageId) {
    throw new Error("Version does not belong to this page");
  }

  await db.cmsPage.update({
    where: { id: pageId },
    data: {
      title: snapshot.title,
      blocks: snapshot.blocks,
      settings: snapshot.settings,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  logger.info("Page rolled back", { pageId, versionId, targetVersion: snapshot.version });
}
```

### 9. Widget Trigger Spam

❌ **Wrong:**

```typescript
// Show popup on every page load
function PopupWidget({ config }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      {config.content}
    </Modal>
  );
}
```

✅ **Correct:**

```typescript
// Respect frequency settings to avoid spam
function PopupWidget({ config }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const storageKey = `widget_${config.id}_shown`;
    const lastShown = localStorage.getItem(storageKey);

    // Check frequency
    const shouldShow = () => {
      if (config.frequency === 'once-per-session') {
        return !sessionStorage.getItem(storageKey);
      }

      if (config.frequency === 'once-per-day') {
        if (!lastShown) return true;
        const daysSince = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
        return daysSince >= 1;
      }

      if (config.frequency === 'always') {
        return true;
      }

      return false;
    };

    if (!shouldShow()) return;

    // Apply delay
    const timer = setTimeout(() => {
      setIsOpen(true);

      // Mark as shown
      const now = Date.now().toString();
      localStorage.setItem(storageKey, now);
      sessionStorage.setItem(storageKey, now);
    }, config.delay || 3000);

    return () => clearTimeout(timer);
  }, [config]);

  const handleClose = () => {
    setIsOpen(false);

    // Track dismissal
    analytics.track('widget_dismissed', {
      widgetId: config.id,
      type: 'popup'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {config.content}
    </Modal>
  );
}
```

### 10. Scheduler Not Handling Timezone Properly

❌ **Wrong:**

```typescript
// Use local server time for scheduling
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const scheduled = await db.scheduledContent.findMany({
    where: {
      publishAt: { lte: now },
      status: "scheduled",
    },
  });

  for (const item of scheduled) {
    await publishContent(item.id);
  }
});
```

✅ **Correct:**

```typescript
// Use UTC for all scheduling, convert for display
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";

cron.schedule("* * * * *", async () => {
  const nowUTC = new Date(); // Already UTC on server

  const scheduled = await db.scheduledContent.findMany({
    where: {
      publishAtUTC: { lte: nowUTC }, // Store all dates in UTC
      status: "scheduled",
    },
  });

  for (const item of scheduled) {
    try {
      await publishContent(item.id);

      logger.info("Scheduled content published", {
        contentId: item.id,
        scheduledFor: item.publishAtUTC,
        publishedAt: nowUTC,
      });
    } catch (error) {
      logger.error("Failed to publish scheduled content", {
        contentId: item.id,
        error,
      });
    }
  }
});

// Convert user timezone to UTC when creating schedule
async function scheduleContent(
  contentId: string,
  publishAt: Date,
  userTimezone: string = "Europe/Istanbul",
) {
  // Convert from user's timezone to UTC
  const publishAtUTC = zonedTimeToUtc(publishAt, userTimezone);

  await db.scheduledContent.create({
    data: {
      contentId,
      publishAtUTC, // Store in UTC
      userTimezone, // Store user's timezone for reference
      status: "scheduled",
    },
  });

  logger.info("Content scheduled", {
    contentId,
    userTimezone,
    localTime: publishAt.toISOString(),
    utcTime: publishAtUTC.toISOString(),
  });
}

// Convert UTC to user timezone for display
function displayScheduledTime(publishAtUTC: Date, userTimezone: string) {
  return utcToZonedTime(publishAtUTC, userTimezone);
}
```

---

## 📦 DELIVERABLES

### 1. Backend (850 items total)

- ✅ Complete CMS API
- ✅ Campaign management
- ✅ Contest system
- ✅ Theme engine
- ✅ Content scheduler
- ✅ A/B testing engine
- ✅ Widget system

### 2. Frontend (Full visual builder)

- ✅ Page builder with 50+ blocks
- ✅ Campaign manager
- ✅ Contest manager
- ✅ Theme customizer
- ✅ Scheduler dashboard
- ✅ A/B test dashboard
- ✅ Widget manager

### 3. Documentation

- ✅ API documentation (OpenAPI)
- ✅ User guide (marketing team)
- ✅ Admin guide (technical team)
- ✅ Block development guide
- ✅ Runbook (operations)

### 4. Database

- ✅ 15 new Prisma models (CMSPage, Campaign, Contest, etc.)
- ✅ Relations and indexes
- ✅ Migration files

### 5. Testing

- ✅ Unit tests (≥85% coverage)
- ✅ Integration tests
- ✅ E2E tests (Playwright)
- ✅ Performance tests (P1/P2)
- ✅ Security tests (S2/S3/S4)

### 6. Infrastructure

- ✅ Cron jobs configured
- ✅ Cache strategy (Redis)
- ✅ CDN setup for static assets
- ✅ Monitoring and alerts

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 9.5: Enterprise CMS & Visual Builder - Completion Report

## Implementation Summary

- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days] (Estimated: 33 days)
- **Team Members**: [Names]

## Completed Items

- [x] Total Items: X/850+ (X%)
- [x] Backend CMS Core API: X/68
- [x] Backend Campaign Management: X/54
- [x] Backend Contest System: X/48
- [x] Backend Theme System: X/42
- [x] Backend Content Scheduler: X/36
- [x] Backend A/B Testing: X/44
- [x] Backend Widget System: X/38
- [x] Frontend Page Builder: X/82
- [x] Frontend Block Library: X/150+
- [x] Frontend Campaign Manager: X/32
- [x] Frontend Contest Manager: X/28
- [x] Frontend Theme Customizer: X/38
- [x] Frontend Scheduler Dashboard: X/24
- [x] Frontend A/B Test Manager: X/30
- [x] Frontend Widget Manager: X/34
- [x] Block Renderers: X/50+
- [x] Testing & QA: X/56
- [x] Documentation: X/38

## Metrics Achieved

- **Test Coverage**: X% (Target: ≥85%)
- **Page Builder Load Time**: Xms (Target: <2s)
- **Block Operations**: Xms (Target: <100ms)
- **Preview Update Time**: Xms (Target: <500ms)
- **CMS Pages LCP**: Xms (Target: <1.5s)
- **P1/P2 Compliance**: ✅ All standards met
- **S2/S3/S4 Compliance**: ✅ All security standards met

## CMS Statistics

- **Total Pages Created**: X
- **Active Campaigns**: X
- **Completed Contests**: X
- **Active Themes**: X
- **Scheduled Content Items**: X
- **Active A/B Tests**: X
- **Widget Impressions**: X
- **Block Types Available**: 50+

## Business Impact

- **Marketing Team Productivity**: +X% (zero-code page creation)
- **Campaign Launch Time**: Reduced from X days to <10 minutes
- **Seasonal Campaigns**: X campaigns per year
- **A/B Testing ROI**: +X% conversion improvement
- **Custom Pages**: X pages created by marketing team

## Known Issues

- [List any known issues or technical debt]

## Next Phase Preparation

- Phase 10 dependencies ready: ✅
- Documentation complete: ✅
- Production deployment checklist: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 10: Payment Integration**

- Stripe integration for secure payments
- iyzico integration (Turkish market)
- Multi-currency support
- Payment method management
- Refund and dispute handling
- Subscription billing (if needed)

**Dependencies from Phase 9.5:**

- Campaign pricing integration (special offer prices)
- Contest prize fulfillment tracking
- Promotional pricing from CMS campaigns
- Campaign-specific payment flows

**CMS Integration Points:**

- Campaign-based discount codes
- Special occasion pricing (Ramadan, Black Friday)
- Checkout page customization via CMS
- Payment success/failure page templates

---

**Total: 850+ Implementation Items**
**Estimated Time: 33 days**
**Enterprise-Level CMS System** 🚀

---

---

## 📚 APPENDIX: FULL SPECIFICATIONS FOR VIBE CODING

### A. Complete Type Definitions

```typescript
// ==========================================
// CMS TYPE DEFINITIONS
// ==========================================

// Page Types
export interface CMSPage {
  id: string;
  slug: string;
  title: string;
  description?: string;
  type: "homepage" | "campaign" | "landing" | "custom";
  status: "draft" | "published" | "scheduled" | "archived";
  publishedAt?: Date;
  scheduledPublishAt?: Date;
  scheduledUnpublishAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  ogImage?: string;
  settings?: PageSettings;
  blocks: CMSPageBlock[];
  version: number;
  createdById: string;
  lastEditedById?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageSettings {
  layout?: "full-width" | "boxed" | "custom";
  headerVisible?: boolean;
  footerVisible?: boolean;
  sidebarPosition?: "left" | "right" | "none";
  backgroundColor?: string;
  backgroundImage?: string;
  customCSS?: string;
}

// Block Types
export interface CMSPageBlock {
  id: string;
  pageId: string;
  blockType: BlockType;
  order: number;
  data: BlockData;
  settings: BlockSettings;
  isVisible: boolean;
  responsiveSettings?: ResponsiveSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type BlockType =
  // Layout
  | "container"
  | "columns"
  | "grid"
  // Hero
  | "hero-centered"
  | "hero-left"
  | "hero-split"
  | "hero-video"
  | "hero-animated"
  // Content
  | "text"
  | "rich-text"
  | "heading"
  | "button"
  | "button-group"
  // Media
  | "image"
  | "image-gallery"
  | "video"
  | "carousel"
  // Product
  | "product-grid"
  | "product-slider"
  | "featured-product"
  | "product-categories"
  // Marketing
  | "countdown-timer"
  | "testimonial"
  | "testimonial-slider"
  | "social-proof"
  | "newsletter-form"
  | "cta"
  // Interactive
  | "faq-accordion"
  | "tabs"
  | "toggle"
  | "pricing-table"
  // Social
  | "social-share"
  | "social-feed"
  | "social-icons"
  // Forms
  | "contact-form"
  | "custom-form"
  | "survey-poll"
  // Advanced
  | "custom-html"
  | "embed"
  | "spacer"
  | "divider"
  | "map";

export type BlockData =
  | HeroBlockData
  | ProductGridBlockData
  | CountdownBlockData
  | NewsletterBlockData
  | TestimonialBlockData
  | FAQBlockData
  | PricingTableBlockData
  | CustomHTMLBlockData
  | GenericBlockData;

export interface BlockSettings {
  margin?: Spacing;
  padding?: Spacing;
  background?: Background;
  border?: Border;
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  animation?: Animation;
  customClass?: string;
  customId?: string;
}

export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Background {
  type: "color" | "image" | "gradient";
  color?: string;
  image?: string;
  gradient?: {
    type: "linear" | "radial";
    colors: string[];
    angle?: number; // for linear
  };
}

export interface Border {
  width: number;
  style: "solid" | "dashed" | "dotted" | "none";
  color: string;
  radius: number;
}

export interface Animation {
  type:
    | "none"
    | "fade-in"
    | "slide-up"
    | "slide-down"
    | "slide-left"
    | "slide-right"
    | "zoom"
    | "bounce";
  duration: number; // ms
  delay: number; // ms
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ResponsiveSettings {
  mobile?: Partial<BlockSettings>;
  tablet?: Partial<BlockSettings>;
  desktop?: Partial<BlockSettings>;
}

// Campaign Types
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: "seasonal" | "flash-sale" | "promotion" | "event";
  status: "draft" | "scheduled" | "active" | "ended" | "archived";
  startDate: Date;
  endDate: Date;
  themeId?: string;
  customStyles?: Record<string, any>;
  pageModifications: Record<string, PageModification>;
  widgets: CampaignWidget[];
  analytics: CampaignAnalytics;
  priority: number;
  autoActivate: boolean;
  autoDeactivate: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageModification {
  pageId: string;
  blockChanges: BlockChange[];
  styleOverrides?: Record<string, any>;
}

export interface BlockChange {
  blockId: string;
  action: "show" | "hide" | "modify";
  modifications?: Partial<CMSPageBlock>;
}

export interface CampaignWidget {
  id: string;
  campaignId: string;
  type: "popup" | "floating-bar" | "notification" | "banner";
  config: WidgetConfig;
  triggers: WidgetTriggers;
  targeting?: WidgetTargeting;
  frequency: "always" | "once-per-session" | "once-per-day" | "once-ever";
  isActive: boolean;
  analytics: WidgetAnalytics;
}

export interface CampaignAnalytics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface WidgetAnalytics {
  impressions: number;
  clicks: number;
  conversions: number;
}

// Contest Types
export interface Contest {
  id: string;
  title: string;
  description: string;
  type: "raffle" | "quiz" | "photo-contest" | "referral";
  status: "draft" | "active" | "ended" | "completed";
  startDate: Date;
  endDate: Date;
  entryRules: EntryRules;
  prizes: Prize[];
  winnerCount: number;
  selectionMethod: "random" | "points" | "judges";
  entries: ContestEntry[];
  winners: ContestWinner[];
  analytics: ContestAnalytics;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryRules {
  requirePurchase: boolean;
  minPurchaseAmount?: number;
  requireRegistration: boolean;
  requireEmailConfirmation: boolean;
  maxEntriesPerUser: number;
  allowedCountries?: string[];
  ageRestriction?: number;
}

export interface Prize {
  id: string;
  name: string;
  description: string;
  value: number;
  imageUrl?: string;
  quantity: number;
  rank: number; // 1st, 2nd, 3rd, etc.
}

export interface ContestEntry {
  id: string;
  contestId: string;
  userId: string;
  entryData: Record<string, any>;
  points?: number;
  submittedAt: Date;
  isFlagged: boolean; // fraud detection
}

export interface ContestWinner {
  id: string;
  contestId: string;
  userId: string;
  prizeId: string;
  selectedAt: Date;
  notifiedAt?: Date;
  claimedAt?: Date;
}

export interface ContestAnalytics {
  totalEntries: number;
  uniqueParticipants: number;
  conversionRate: number;
  topReferrers: Array<{ userId: string; referrals: number }>;
}

// Theme Types
export interface CMSTheme {
  id: string;
  name: string;
  description?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  customCSS?: string;
  seasonalConfig?: SeasonalConfig;
  isActive: boolean;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface ThemeTypography {
  fontFamily: {
    heading: string;
    body: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeSpacing {
  baseUnit: number; // 4px, 8px, etc.
  scale: number[]; // [0, 4, 8, 12, 16, 24, 32, 48, 64]
}

export interface SeasonalConfig {
  occasions: Array<{
    name: string; // "Ramadan", "Black Friday", etc.
    startDate: string; // MM-DD format
    endDate: string;
    autoApply: boolean;
  }>;
}

// A/B Test Types
export interface ABTest {
  id: string;
  name: string;
  description?: string;
  targetType: "page" | "block" | "campaign";
  targetId: string;
  status: "draft" | "running" | "completed" | "stopped";
  trafficSplit: TrafficSplit;
  variants: ABTestVariant[];
  winnerCriteria: "conversion" | "engagement" | "revenue";
  autoSelectWinner: boolean;
  minimumSampleSize: number;
  confidenceLevel: number; // 0.95 for 95%
  startDate?: Date;
  endDate?: Date;
  winnerId?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrafficSplit {
  [variantId: string]: number; // percentage
}

export interface ABTestVariant {
  id: string;
  testId: string;
  name: string;
  description?: string;
  pageId?: string;
  blockModifications?: BlockChange[];
  isControl: boolean;
  analytics: VariantAnalytics;
}

export interface VariantAnalytics {
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
  bounceRate: number;
  timeOnPage: number;
}
```

---

### B. Detailed Block Specifications

#### B.1 Hero Block (Centered)

```typescript
export interface HeroBlockData {
  // Content
  heading: string;
  subheading?: string;
  description?: string;
  cta?: CTAButton[];

  // Background
  backgroundType: "color" | "image" | "video" | "gradient";
  backgroundColor?: string;
  backgroundImage?: CloudinaryImage;
  backgroundVideo?: {
    videoUrl: string;
    posterImage?: string;
    muted: boolean;
    loop: boolean;
  };
  backgroundGradient?: {
    type: "linear" | "radial";
    colors: string[];
    angle?: number;
  };

  // Overlay
  overlay?: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-100
  };

  // Layout
  alignment: "left" | "center" | "right";
  contentMaxWidth?: number; // px
  minHeight: number; // px

  // Typography
  headingSize: "sm" | "md" | "lg" | "xl" | "2xl";
  headingColor?: string;
  subheadingSize: "xs" | "sm" | "md" | "lg";
  subheadingColor?: string;
  descriptionColor?: string;
}

export interface CTAButton {
  text: string;
  link: string;
  style: "primary" | "secondary" | "outline" | "ghost";
  size: "sm" | "md" | "lg";
  icon?: string;
  iconPosition?: "left" | "right";
  openInNewTab?: boolean;
}

export interface CloudinaryImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt?: string;
  focalPoint?: { x: number; y: number }; // 0-1 range
}

// Zod Schema
export const HeroBlockDataSchema = z.object({
  heading: z.string().min(1).max(200),
  subheading: z.string().max(300).optional(),
  description: z.string().max(500).optional(),
  cta: z
    .array(
      z.object({
        text: z.string().min(1).max(50),
        link: z.string().url(),
        style: z.enum(["primary", "secondary", "outline", "ghost"]),
        size: z.enum(["sm", "md", "lg"]),
        icon: z.string().optional(),
        iconPosition: z.enum(["left", "right"]).optional(),
        openInNewTab: z.boolean().optional(),
      }),
    )
    .max(3)
    .optional(),
  backgroundType: z.enum(["color", "image", "video", "gradient"]),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  backgroundImage: z
    .object({
      publicId: z.string(),
      url: z.string().url(),
      width: z.number().positive(),
      height: z.number().positive(),
      alt: z.string().optional(),
      focalPoint: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        })
        .optional(),
    })
    .optional(),
  backgroundVideo: z
    .object({
      videoUrl: z.string().url(),
      posterImage: z.string().url().optional(),
      muted: z.boolean(),
      loop: z.boolean(),
    })
    .optional(),
  backgroundGradient: z
    .object({
      type: z.enum(["linear", "radial"]),
      colors: z
        .array(z.string().regex(/^#[0-9A-F]{6}$/i))
        .min(2)
        .max(5),
      angle: z.number().min(0).max(360).optional(),
    })
    .optional(),
  overlay: z
    .object({
      enabled: z.boolean(),
      color: z.string().regex(/^#[0-9A-F]{6}$/i),
      opacity: z.number().min(0).max(100),
    })
    .optional(),
  alignment: z.enum(["left", "center", "right"]),
  contentMaxWidth: z.number().positive().optional(),
  minHeight: z.number().min(300).max(1200),
  headingSize: z.enum(["sm", "md", "lg", "xl", "2xl"]),
  headingColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  subheadingSize: z.enum(["xs", "sm", "md", "lg"]),
  subheadingColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  descriptionColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
});
```

#### B.2 Product Grid Block

```typescript
export interface ProductGridBlockData {
  // Product Source
  sourceType: "all" | "category" | "collection" | "manual" | "dynamic";
  categoryId?: string;
  collectionId?: string;
  productIds?: string[]; // for manual selection
  dynamicFilter?: ProductFilter;

  // Layout
  columns: {
    desktop: 2 | 3 | 4 | 5 | 6;
    tablet: 2 | 3 | 4;
    mobile: 1 | 2;
  };
  gap: number; // px
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "auto";

  // Display Options
  limit: number;
  sortBy: "newest" | "price-asc" | "price-desc" | "popular" | "rating";
  showQuickView: boolean;
  showAddToCart: boolean;
  showWishlist: boolean;
  showCompare: boolean;
  showRating: boolean;
  showPrice: boolean;
  showBadges: boolean; // sale, new, etc.

  // Pagination
  pagination: {
    enabled: boolean;
    type: "numbers" | "load-more" | "infinite-scroll";
    itemsPerPage: number;
  };

  // Heading
  heading?: {
    text: string;
    alignment: "left" | "center" | "right";
    showViewAll: boolean;
    viewAllLink?: string;
  };
}

export interface ProductFilter {
  tags?: string[];
  priceRange?: { min: number; max: number };
  inStock?: boolean;
  onSale?: boolean;
  rating?: number; // minimum rating
}

// Zod Schema
export const ProductGridBlockDataSchema = z.object({
  sourceType: z.enum(["all", "category", "collection", "manual", "dynamic"]),
  categoryId: z.string().cuid().optional(),
  collectionId: z.string().cuid().optional(),
  productIds: z.array(z.string().cuid()).max(50).optional(),
  dynamicFilter: z
    .object({
      tags: z.array(z.string()).optional(),
      priceRange: z
        .object({
          min: z.number().nonnegative(),
          max: z.number().positive(),
        })
        .refine((data) => data.max > data.min)
        .optional(),
      inStock: z.boolean().optional(),
      onSale: z.boolean().optional(),
      rating: z.number().min(1).max(5).optional(),
    })
    .optional(),
  columns: z.object({
    desktop: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    tablet: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    mobile: z.union([z.literal(1), z.literal(2)]),
  }),
  gap: z.number().min(0).max(64),
  aspectRatio: z.enum(["1:1", "4:3", "3:4", "16:9", "auto"]),
  limit: z.number().min(1).max(100),
  sortBy: z.enum(["newest", "price-asc", "price-desc", "popular", "rating"]),
  showQuickView: z.boolean(),
  showAddToCart: z.boolean(),
  showWishlist: z.boolean(),
  showCompare: z.boolean(),
  showRating: z.boolean(),
  showPrice: z.boolean(),
  showBadges: z.boolean(),
  pagination: z.object({
    enabled: z.boolean(),
    type: z.enum(["numbers", "load-more", "infinite-scroll"]),
    itemsPerPage: z.number().min(6).max(48),
  }),
  heading: z
    .object({
      text: z.string().max(100),
      alignment: z.enum(["left", "center", "right"]),
      showViewAll: z.boolean(),
      viewAllLink: z.string().url().optional(),
    })
    .optional(),
});
```

#### B.3 Countdown Timer Block

```typescript
export interface CountdownBlockData {
  // Timer Config
  targetDate: Date;
  timezone: string; // IANA timezone
  displayFormat: "full" | "compact" | "minimal";

  // Labels
  labels: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
  showLabels: boolean;

  // Display Units
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;

  // Style
  size: "sm" | "md" | "lg" | "xl";
  digitBackground: string;
  digitColor: string;
  labelColor: string;
  separatorType: "colon" | "dash" | "none";

  // Behavior
  onExpire: "hide" | "show-message" | "redirect";
  expireMessage?: string;
  redirectUrl?: string;

  // Additional Elements
  heading?: string;
  description?: string;
  cta?: CTAButton;
}

// Zod Schema
export const CountdownBlockDataSchema = z.object({
  targetDate: z.string().datetime(),
  timezone: z.string(),
  displayFormat: z.enum(["full", "compact", "minimal"]),
  labels: z.object({
    days: z.string().max(20),
    hours: z.string().max(20),
    minutes: z.string().max(20),
    seconds: z.string().max(20),
  }),
  showLabels: z.boolean(),
  showDays: z.boolean(),
  showHours: z.boolean(),
  showMinutes: z.boolean(),
  showSeconds: z.boolean(),
  size: z.enum(["sm", "md", "lg", "xl"]),
  digitBackground: z.string().regex(/^#[0-9A-F]{6}$/i),
  digitColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  labelColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  separatorType: z.enum(["colon", "dash", "none"]),
  onExpire: z.enum(["hide", "show-message", "redirect"]),
  expireMessage: z.string().max(200).optional(),
  redirectUrl: z.string().url().optional(),
  heading: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  cta: z
    .object({
      text: z.string().min(1).max(50),
      link: z.string().url(),
      style: z.enum(["primary", "secondary", "outline", "ghost"]),
      size: z.enum(["sm", "md", "lg"]),
    })
    .optional(),
});
```

#### B.4 Newsletter Form Block

```typescript
export interface NewsletterBlockData {
  // Form Configuration
  formId?: string; // Link to existing form
  submitEndpoint: string;

  // Content
  heading?: string;
  description?: string;
  successMessage: string;
  errorMessage: string;

  // Fields
  fields: FormField[];

  // Privacy
  showPrivacyConsent: boolean;
  privacyText?: string;
  privacyLink?: string;

  // Style
  layout: "inline" | "stacked";
  buttonText: string;
  buttonPosition?: "right" | "below"; // for inline layout
  placeholder: string;

  // Integration
  integrations: {
    mailchimp?: { listId: string; apiKey: string };
    sendgrid?: { listId: string; apiKey: string };
    custom?: { endpoint: string; method: "POST" | "GET" };
  };

  // Behavior
  showSocialProof?: {
    enabled: boolean;
    text: string; // e.g., "Join 10,000+ subscribers"
  };
  redirectAfterSubmit?: string;
}

export interface FormField {
  id: string;
  name: string;
  type: "email" | "text" | "checkbox";
  label?: string;
  placeholder?: string;
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
}

// Zod Schema
export const NewsletterBlockDataSchema = z.object({
  formId: z.string().cuid().optional(),
  submitEndpoint: z.string().url(),
  heading: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  successMessage: z.string().max(200),
  errorMessage: z.string().max(200),
  fields: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        type: z.enum(["email", "text", "checkbox"]),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        required: z.boolean(),
        validation: z
          .object({
            pattern: z.string().optional(),
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
            message: z.string().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  showPrivacyConsent: z.boolean(),
  privacyText: z.string().optional(),
  privacyLink: z.string().url().optional(),
  layout: z.enum(["inline", "stacked"]),
  buttonText: z.string().min(1).max(50),
  buttonPosition: z.enum(["right", "below"]).optional(),
  placeholder: z.string().max(100),
  integrations: z.object({
    mailchimp: z
      .object({
        listId: z.string(),
        apiKey: z.string(),
      })
      .optional(),
    sendgrid: z
      .object({
        listId: z.string(),
        apiKey: z.string(),
      })
      .optional(),
    custom: z
      .object({
        endpoint: z.string().url(),
        method: z.enum(["POST", "GET"]),
      })
      .optional(),
  }),
  showSocialProof: z
    .object({
      enabled: z.boolean(),
      text: z.string().max(100),
    })
    .optional(),
  redirectAfterSubmit: z.string().url().optional(),
});
```

---

### C. Complete API Examples

#### C.1 Create Page with Blocks

**Request:**

```typescript
POST /api/v1/cms/pages
Content-Type: application/json
Authorization: Bearer {token}

{
  "slug": "/campaigns/black-friday-2025",
  "title": "Black Friday 2025",
  "description": "Biggest sale of the year!",
  "type": "campaign",
  "seoTitle": "Black Friday Sale 2025 - Up to 70% Off",
  "seoDescription": "Shop the biggest Black Friday deals on embroidery products. Save up to 70% on all items.",
  "seoKeywords": ["black friday", "sale", "embroidery", "discount"],
  "ogImage": "https://res.cloudinary.com/lumi/image/upload/v1/campaigns/black-friday-og.jpg",
  "settings": {
    "layout": "full-width",
    "headerVisible": true,
    "footerVisible": true,
    "backgroundColor": "#000000"
  },
  "blocks": [
    {
      "blockType": "hero-centered",
      "order": 0,
      "data": {
        "heading": "Black Friday Sale",
        "subheading": "Up to 70% Off Everything",
        "description": "The biggest sale of the year is here!",
        "cta": [
          {
            "text": "Shop Now",
            "link": "/products",
            "style": "primary",
            "size": "lg"
          }
        ],
        "backgroundType": "image",
        "backgroundImage": {
          "publicId": "lumi/campaigns/black-friday-hero",
          "url": "https://res.cloudinary.com/lumi/image/upload/v1/lumi/campaigns/black-friday-hero.jpg",
          "width": 1920,
          "height": 1080,
          "alt": "Black Friday Sale Banner"
        },
        "overlay": {
          "enabled": true,
          "color": "#000000",
          "opacity": 40
        },
        "alignment": "center",
        "minHeight": 600,
        "headingSize": "2xl",
        "headingColor": "#FFFFFF",
        "subheadingSize": "lg",
        "subheadingColor": "#F59E0B"
      },
      "settings": {
        "margin": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
        "padding": { "top": 80, "right": 24, "bottom": 80, "left": 24 },
        "animation": {
          "type": "fade-in",
          "duration": 800,
          "delay": 0,
          "easing": "ease-out"
        }
      }
    },
    {
      "blockType": "countdown-timer",
      "order": 1,
      "data": {
        "targetDate": "2025-11-25T23:59:59Z",
        "timezone": "Europe/Istanbul",
        "displayFormat": "full",
        "labels": {
          "days": "Gün",
          "hours": "Saat",
          "minutes": "Dakika",
          "seconds": "Saniye"
        },
        "showLabels": true,
        "showDays": true,
        "showHours": true,
        "showMinutes": true,
        "showSeconds": true,
        "size": "xl",
        "digitBackground": "#1F2937",
        "digitColor": "#F59E0B",
        "labelColor": "#9CA3AF",
        "separatorType": "colon",
        "onExpire": "show-message",
        "expireMessage": "Sale has ended. Stay tuned for next one!",
        "heading": "Sale Ends In"
      },
      "settings": {
        "margin": { "top": 48, "right": 0, "bottom": 48, "left": 0 },
        "padding": { "top": 32, "right": 24, "bottom": 32, "left": 24 },
        "background": {
          "type": "color",
          "color": "#111827"
        }
      }
    },
    {
      "blockType": "product-grid",
      "order": 2,
      "data": {
        "sourceType": "dynamic",
        "dynamicFilter": {
          "onSale": true,
          "inStock": true
        },
        "columns": {
          "desktop": 4,
          "tablet": 3,
          "mobile": 2
        },
        "gap": 24,
        "aspectRatio": "1:1",
        "limit": 12,
        "sortBy": "price-desc",
        "showQuickView": true,
        "showAddToCart": true,
        "showWishlist": true,
        "showCompare": false,
        "showRating": true,
        "showPrice": true,
        "showBadges": true,
        "pagination": {
          "enabled": true,
          "type": "load-more",
          "itemsPerPage": 12
        },
        "heading": {
          "text": "Hot Deals",
          "alignment": "center",
          "showViewAll": true,
          "viewAllLink": "/products?sale=true"
        }
      },
      "settings": {
        "margin": { "top": 64, "right": 0, "bottom": 64, "left": 0 },
        "padding": { "top": 0, "right": 24, "bottom": 0, "left": 24 }
      }
    }
  ]
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "page_cm2x1y2z3",
    "slug": "/campaigns/black-friday-2025",
    "title": "Black Friday 2025",
    "status": "draft",
    "blocks": [
      {
        "id": "block_abc123",
        "blockType": "hero-centered",
        "order": 0,
        // ... (full block data)
      },
      {
        "id": "block_def456",
        "blockType": "countdown-timer",
        "order": 1,
        // ... (full block data)
      },
      {
        "id": "block_ghi789",
        "blockType": "product-grid",
        "order": 2,
        // ... (full block data)
      }
    ],
    "version": 1,
    "createdById": "user_xyz",
    "createdAt": "2025-11-14T12:00:00Z",
    "updatedAt": "2025-11-14T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
    "requestId": "req_uuid"
  }
}
```

#### C.2 Create Campaign with Auto-Activation

**Request:**

```typescript
POST /api/v1/cms/campaigns
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Ramadan Special 2025",
  "description": "Special Ramadan campaign with custom theme and widgets",
  "type": "seasonal",
  "startDate": "2025-03-10T00:00:00Z",
  "endDate": "2025-04-10T23:59:59Z",
  "themeId": "theme_ramadan_2025",
  "autoActivate": true,
  "autoDeactivate": true,
  "priority": 100,
  "pageModifications": {
    "page_homepage": {
      "pageId": "page_homepage",
      "blockChanges": [
        {
          "blockId": "block_hero_main",
          "action": "modify",
          "modifications": {
            "data": {
              "heading": "Ramazan Kampanyası",
              "backgroundImage": {
                "publicId": "lumi/campaigns/ramadan-hero",
                "url": "https://res.cloudinary.com/lumi/image/upload/v1/lumi/campaigns/ramadan-hero.jpg",
                "width": 1920,
                "height": 1080
              }
            }
          }
        }
      ]
    }
  },
  "widgets": [
    {
      "type": "popup",
      "config": {
        "title": "Ramazan Kampanyası",
        "content": "<p>%20 indirim için RAMAZAN2025 kodunu kullanın!</p>",
        "imageUrl": "https://res.cloudinary.com/lumi/image/upload/v1/lumi/campaigns/ramadan-popup.jpg",
        "ctaText": "Alışverişe Başla",
        "ctaLink": "/products",
        "width": 600,
        "height": 400
      },
      "triggers": {
        "delay": 3000,
        "scrollPercentage": null,
        "exitIntent": false
      },
      "targeting": {
        "pages": ["/", "/products"],
        "devices": ["desktop", "mobile"],
        "userSegments": ["all"]
      },
      "frequency": "once-per-day"
    },
    {
      "type": "floating-bar",
      "config": {
        "text": "🌙 Ramazan'a özel %20 indirim! Kod: RAMAZAN2025",
        "backgroundColor": "#D4AF37",
        "textColor": "#2C3E50",
        "position": "top",
        "height": 50,
        "ctaText": "Hemen Al",
        "ctaLink": "/products"
      },
      "triggers": {
        "delay": 0,
        "scrollPercentage": null
      },
      "targeting": {
        "pages": ["*"],
        "devices": ["desktop", "tablet", "mobile"]
      },
      "frequency": "always"
    }
  ]
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "campaign_xyz789",
    "name": "Ramadan Special 2025",
    "status": "scheduled",
    "startDate": "2025-03-10T00:00:00Z",
    "endDate": "2025-04-10T23:59:59Z",
    "theme": {
      "id": "theme_ramadan_2025",
      "name": "Ramadan Theme",
      "colors": {
        "primary": "#D4AF37",
        "secondary": "#2C3E50",
        "accent": "#E74C3C"
      }
    },
    "widgets": [
      {
        "id": "widget_popup_123",
        "type": "popup",
        "isActive": false,
        // ... (full widget config)
      },
      {
        "id": "widget_bar_456",
        "type": "floating-bar",
        "isActive": false,
        // ... (full widget config)
      }
    ],
    "analytics": {
      "impressions": 0,
      "clicks": 0,
      "conversions": 0,
      "revenue": 0
    },
    "createdById": "user_xyz",
    "createdAt": "2025-11-14T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
    "requestId": "req_uuid",
    "message": "Campaign will be automatically activated on 2025-03-10 at 00:00:00 UTC"
  }
}
```

#### C.3 Create Contest with Fraud Detection

**Request:**

```typescript
POST /api/v1/cms/contests
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "Win a Premium Embroidery Machine",
  "description": "Enter to win our top-of-the-line embroidery machine worth $2,000!",
  "type": "raffle",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-25T23:59:59Z",
  "entryRules": {
    "requirePurchase": false,
    "requireRegistration": true,
    "requireEmailConfirmation": true,
    "maxEntriesPerUser": 1,
    "allowedCountries": ["TR", "US", "DE", "FR"],
    "ageRestriction": 18
  },
  "prizes": [
    {
      "name": "Embroidery Machine Pro 3000",
      "description": "Professional-grade embroidery machine with 500+ built-in designs",
      "value": 2000,
      "imageUrl": "https://res.cloudinary.com/lumi/image/upload/v1/prizes/machine-pro-3000.jpg",
      "quantity": 1,
      "rank": 1
    },
    {
      "name": "$100 Store Credit",
      "description": "Use on any purchase at Lumi",
      "value": 100,
      "quantity": 5,
      "rank": 2
    }
  ],
  "winnerCount": 6,
  "selectionMethod": "random"
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "id": "contest_abc123",
    "title": "Win a Premium Embroidery Machine",
    "status": "active",
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-25T23:59:59Z",
    "prizes": [
      {
        "id": "prize_xyz789",
        "name": "Embroidery Machine Pro 3000",
        "value": 2000,
        "quantity": 1,
        "rank": 1
      },
      {
        "id": "prize_def456",
        "name": "$100 Store Credit",
        "value": 100,
        "quantity": 5,
        "rank": 2
      }
    ],
    "analytics": {
      "totalEntries": 0,
      "uniqueParticipants": 0,
      "conversionRate": 0
    },
    "createdById": "user_xyz",
    "createdAt": "2025-11-14T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-11-14T12:00:00Z",
    "requestId": "req_uuid",
    "message": "Contest created successfully. Winners will be auto-selected on 2025-12-26."
  }
}
```

---

### D. Complete Integration Examples

#### D.1 Implementing a Custom Block Component

```typescript
// apps/frontend/src/features/cms/components/blocks/HeroBlock.tsx

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HeroBlockData, BlockSettings } from '@/types/cms';

interface HeroBlockProps {
  data: HeroBlockData;
  settings?: BlockSettings;
  isEditing?: boolean;
}

export function HeroBlock({ data, settings, isEditing = false }: HeroBlockProps) {
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Generate background styles
  const backgroundStyles = (() => {
    if (data.backgroundType === 'color') {
      return { backgroundColor: data.backgroundColor };
    }

    if (data.backgroundType === 'gradient' && data.backgroundGradient) {
      const { type, colors, angle } = data.backgroundGradient;
      if (type === 'linear') {
        return {
          backgroundImage: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
        };
      }
      return {
        backgroundImage: `radial-gradient(circle, ${colors.join(', ')})`,
      };
    }

    return {};
  })();

  // Generate overlay styles
  const overlayStyles = data.overlay?.enabled
    ? {
        backgroundColor: data.overlay.color,
        opacity: data.overlay.opacity / 100,
      }
    : null;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: (settings?.animation?.duration || 800) / 1000,
        delay: (settings?.animation?.delay || 0) / 1000,
        ease: settings?.animation?.easing || 'easeOut',
      },
    },
  };

  return (
    <motion.section
      className={cn('relative overflow-hidden', settings?.customClass)}
      id={settings?.customId}
      style={{
        minHeight: data.minHeight,
        ...backgroundStyles,
        margin: settings?.margin
          ? `${settings.margin.top}px ${settings.margin.right}px ${settings.margin.bottom}px ${settings.margin.left}px`
          : undefined,
        padding: settings?.padding
          ? `${settings.padding.top}px ${settings.padding.right}px ${settings.padding.bottom}px ${settings.padding.left}px`
          : undefined,
      }}
      variants={!isEditing && settings?.animation?.type !== 'none' ? containerVariants : undefined}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      {/* Background Image */}
      {data.backgroundType === 'image' && data.backgroundImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={data.backgroundImage.url}
            alt={data.backgroundImage.alt || ''}
            className="h-full w-full object-cover"
            style={{
              objectPosition: data.backgroundImage.focalPoint
                ? `${data.backgroundImage.focalPoint.x * 100}% ${data.backgroundImage.focalPoint.y * 100}%`
                : 'center',
            }}
          />
        </div>
      )}

      {/* Background Video */}
      {data.backgroundType === 'video' && data.backgroundVideo && (
        <div className="absolute inset-0 z-0">
          <video
            src={data.backgroundVideo.videoUrl}
            poster={data.backgroundVideo.posterImage}
            autoPlay
            muted={data.backgroundVideo.muted}
            loop={data.backgroundVideo.loop}
            playsInline
            className="h-full w-full object-cover"
            onLoadedData={() => setVideoLoaded(true)}
          />
          {!videoLoaded && data.backgroundVideo.posterImage && (
            <img
              src={data.backgroundVideo.posterImage}
              alt="Video poster"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
      )}

      {/* Overlay */}
      {overlayStyles && <div className="absolute inset-0 z-10" style={overlayStyles} />}

      {/* Content */}
      <div className="relative z-20 mx-auto" style={{ maxWidth: data.contentMaxWidth || 1200 }}>
        <div
          className={cn('flex flex-col gap-6', {
            'items-start text-left': data.alignment === 'left',
            'items-center text-center': data.alignment === 'center',
            'items-end text-right': data.alignment === 'right',
          })}
        >
          {/* Heading */}
          <h1
            className={cn('font-bold leading-tight', {
              'text-3xl md:text-4xl': data.headingSize === 'sm',
              'text-4xl md:text-5xl': data.headingSize === 'md',
              'text-5xl md:text-6xl': data.headingSize === 'lg',
              'text-6xl md:text-7xl': data.headingSize === 'xl',
              'text-7xl md:text-8xl': data.headingSize === '2xl',
            })}
            style={{ color: data.headingColor }}
          >
            {data.heading}
          </h1>

          {/* Subheading */}
          {data.subheading && (
            <h2
              className={cn('font-medium', {
                'text-lg md:text-xl': data.subheadingSize === 'xs',
                'text-xl md:text-2xl': data.subheadingSize === 'sm',
                'text-2xl md:text-3xl': data.subheadingSize === 'md',
                'text-3xl md:text-4xl': data.subheadingSize === 'lg',
              })}
              style={{ color: data.subheadingColor }}
            >
              {data.subheading}
            </h2>
          )}

          {/* Description */}
          {data.description && (
            <p className="text-base md:text-lg" style={{ color: data.descriptionColor }}>
              {data.description}
            </p>
          )}

          {/* CTA Buttons */}
          {data.cta && data.cta.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {data.cta.map((button, index) => (
                <Button
                  key={index}
                  variant={button.style as any}
                  size={button.size}
                  asChild
                >
                  <a
                    href={button.link}
                    target={button.openInNewTab ? '_blank' : undefined}
                    rel={button.openInNewTab ? 'noopener noreferrer' : undefined}
                  >
                    {button.iconPosition === 'left' && button.icon && (
                      <span className="mr-2">{button.icon}</span>
                    )}
                    {button.text}
                    {button.iconPosition === 'right' && button.icon && (
                      <span className="ml-2">{button.icon}</span>
                    )}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
```

#### D.2 Campaign Auto-Activation Cron Job

```typescript
// apps/backend/src/jobs/campaign-activator.job.ts
import { PrismaClient } from "@prisma/client";

import { CampaignService } from "@/modules/campaign/campaign.service";
import { ThemeService } from "@/modules/theme/theme.service";
import { WidgetService } from "@/modules/widget/widget.service";
import { logger } from "@/utils/logger";

const prisma = new PrismaClient();
const campaignService = new CampaignService();
const themeService = new ThemeService();
const widgetService = new WidgetService();

/**
 * Campaign Auto-Activator Job
 * Runs every minute: 0 * * * * *
 *
 * Finds campaigns that should be activated:
 * - status = 'scheduled'
 * - startDate <= now
 * - autoActivate = true
 *
 * Then activates them by:
 * 1. Checking for conflicts
 * 2. Applying theme
 * 3. Modifying pages
 * 4. Activating widgets
 * 5. Updating campaign status to 'active'
 */
export async function activateCampaigns() {
  const startTime = Date.now();
  logger.info("Campaign activator job started");

  try {
    const now = new Date();

    // Find campaigns to activate
    const campaignsToActivate = await prisma.campaign.findMany({
      where: {
        status: "scheduled",
        startDate: {
          lte: now,
        },
        autoActivate: true,
        deletedAt: null,
      },
      include: {
        theme: true,
        widgets: true,
      },
      orderBy: {
        priority: "desc", // Higher priority campaigns first
      },
    });

    if (campaignsToActivate.length === 0) {
      logger.info("No campaigns to activate");
      return;
    }

    logger.info(`Found ${campaignsToActivate.length} campaigns to activate`, {
      campaignIds: campaignsToActivate.map((c) => c.id),
    });

    // Activate each campaign
    for (const campaign of campaignsToActivate) {
      try {
        await activateCampaign(campaign);

        logger.info("Campaign activated successfully", {
          campaignId: campaign.id,
          campaignName: campaign.name,
        });
      } catch (error) {
        logger.error("Failed to activate campaign", {
          campaignId: campaign.id,
          campaignName: campaign.name,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark campaign as failed
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "draft",
            // Add error message to custom field (would need to add to schema)
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info("Campaign activator job completed", {
      duration: `${duration}ms`,
      activated: campaignsToActivate.length,
    });
  } catch (error) {
    logger.error("Campaign activator job failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function activateCampaign(campaign: any) {
  // 1. Check for conflicts with other active campaigns
  const conflicts = await prisma.campaign.findMany({
    where: {
      status: "active",
      id: { not: campaign.id },
      OR: [
        {
          // Campaign ends after this one starts
          endDate: { gte: campaign.startDate },
        },
        {
          // Campaign starts before this one ends
          startDate: { lte: campaign.endDate },
        },
      ],
    },
  });

  if (conflicts.length > 0) {
    // Check priority
    const higherPriorityConflicts = conflicts.filter((c) => c.priority >= campaign.priority);

    if (higherPriorityConflicts.length > 0) {
      throw new Error(
        `Campaign conflicts with higher priority campaigns: ${higherPriorityConflicts.map((c) => c.name).join(", ")}`,
      );
    }

    // Deactivate lower priority campaigns
    logger.warn("Deactivating lower priority conflicting campaigns", {
      campaignId: campaign.id,
      conflicts: conflicts.map((c) => ({ id: c.id, name: c.name, priority: c.priority })),
    });

    for (const conflict of conflicts) {
      await deactivateCampaign(conflict.id);
    }
  }

  // 2. Apply theme (if specified)
  if (campaign.themeId) {
    await themeService.applyTheme(campaign.themeId);
    logger.info("Theme applied", { themeId: campaign.themeId });
  }

  // 3. Modify pages
  const pageModifications = campaign.pageModifications as Record<string, any>;
  if (pageModifications && Object.keys(pageModifications).length > 0) {
    for (const [pageKey, modifications] of Object.entries(pageModifications)) {
      const pageId = modifications.pageId;

      // Create backup of current page state
      const currentPage = await prisma.cMSPage.findUnique({
        where: { id: pageId },
        include: { blocks: true },
      });

      if (!currentPage) {
        logger.warn("Page not found, skipping modification", { pageId });
        continue;
      }

      // Store original state for rollback
      await prisma.campaignPageBackup.create({
        data: {
          campaignId: campaign.id,
          pageId,
          originalBlocks: currentPage.blocks as any,
          originalSettings: currentPage.settings as any,
        },
      });

      // Apply block changes
      for (const blockChange of modifications.blockChanges || []) {
        if (blockChange.action === "modify") {
          await prisma.cMSPageBlock.update({
            where: { id: blockChange.blockId },
            data: blockChange.modifications,
          });
        } else if (blockChange.action === "hide") {
          await prisma.cMSPageBlock.update({
            where: { id: blockChange.blockId },
            data: { isVisible: false },
          });
        } else if (blockChange.action === "show") {
          await prisma.cMSPageBlock.update({
            where: { id: blockChange.blockId },
            data: { isVisible: true },
          });
        }
      }

      logger.info("Page modified", { pageId, blockChanges: modifications.blockChanges.length });
    }
  }

  // 4. Activate widgets
  if (campaign.widgets && campaign.widgets.length > 0) {
    for (const widget of campaign.widgets) {
      await prisma.campaignWidget.update({
        where: { id: widget.id },
        data: { isActive: true },
      });
    }
    logger.info("Widgets activated", { count: campaign.widgets.length });
  }

  // 5. Update campaign status
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "active",
      // Would add activatedAt field to schema
    },
  });

  // 6. Trigger analytics event
  // await analyticsService.trackEvent('campaign_activated', { campaignId: campaign.id });
}

async function deactivateCampaign(campaignId: string) {
  // Implementation in campaign-deactivator.job.ts
  // This would reverse all changes made by activation
}
```

---

**END OF PHASE 9.5 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-11-14_
_Created with ❤️ for Lumi E-commerce Platform_
