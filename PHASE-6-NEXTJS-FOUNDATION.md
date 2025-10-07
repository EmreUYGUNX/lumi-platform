# 🚀 PHASE 6: NEXT.JS FOUNDATION & DESIGN SYSTEM

**Status**: 🔄 **IN PROGRESS**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3, 4, 5
**Estimated Time**: 14 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Code**: PHASE-6
**Module Focus**: Modern Frontend Architecture & Design Foundation
**Expected Lines of Code**: ~12,500 lines
**Test Coverage Target**: ≥85%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Next.js 14 App Router Setup** - Modern React architecture with TypeScript
2. **Design System Implementation** - Tailwind CSS + deneme.html brand consistency (B1)
3. **shadcn/ui Integration** - Enterprise component library with custom theming
4. **Layout System** - Route groups for public, auth, dashboard, admin
5. **State Management** - Zustand + TanStack Query for global and server state
6. **Animation System** - Framer Motion + GSAP + Lenis for smooth UX
7. **Performance Optimization** - Code splitting, lazy loading, bundle analysis
8. **Developer Experience** - TypeScript strict mode, ESLint, Prettier, path aliases

### Success Criteria

- ✅ Next.js 14 App Router configured with TypeScript
- ✅ Tailwind CSS with deneme.html brand colors (B1 compliance)
- ✅ shadcn/ui components customized and extended
- ✅ Route groups: (public), (auth), (dashboard), (admin)
- ✅ Middleware for auth guards and RBAC (S3)
- ✅ Zustand stores for session, UI, feature flags
- ✅ TanStack Query with Q2 format validation
- ✅ Responsive layouts: mobile, tablet, desktop
- ✅ Animation system with deneme.html aesthetics
- ✅ Initial bundle < 180KB, LCP < 2s
- ✅ 100% TypeScript coverage, 0 errors
- ✅ Lighthouse Performance score ≥ 90

---

## 🎯 CRITICAL REQUIREMENTS

### Design System Standards (B1)

**B1: Brand Consistency Rule**
```css
/* Only use deneme.html approved color palette */
:root {
  /* Primary Colors */
  --lumi-primary: #3B82F6;      /* Blue 500 */
  --lumi-primary-dark: #2563EB; /* Blue 600 */
  --lumi-primary-light: #60A5FA;/* Blue 400 */

  /* Secondary Colors */
  --lumi-secondary: #8B5CF6;    /* Violet 500 */
  --lumi-accent: #F59E0B;       /* Amber 500 */

  /* Neutral Colors */
  --lumi-bg: #FFFFFF;
  --lumi-bg-secondary: #F9FAFB; /* Gray 50 */
  --lumi-text: #111827;         /* Gray 900 */
  --lumi-text-secondary: #6B7280; /* Gray 500 */
  --lumi-border: #E5E7EB;       /* Gray 200 */

  /* Semantic Colors */
  --lumi-success: #10B981;      /* Green 500 */
  --lumi-warning: #F59E0B;      /* Amber 500 */
  --lumi-error: #EF4444;        /* Red 500 */
  --lumi-info: #3B82F6;         /* Blue 500 */
}

[data-theme="dark"] {
  --lumi-bg: #111827;
  --lumi-bg-secondary: #1F2937;
  --lumi-text: #F9FAFB;
  --lumi-text-secondary: #9CA3AF;
  --lumi-border: #374151;
}
```

**Enforcement:**
- No colors outside this palette
- Use Tailwind utilities only from `theme.extend.colors.lumi`
- ESLint rule to prevent hex codes in className

### Performance Standards (P1/P2)

**P1: Core Web Vitals**
- Largest Contentful Paint (LCP): < 2.0s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

**P2: Bundle & Loading**
- Initial bundle size: < 180KB gzipped
- Route-based code splitting enabled
- Critical CSS inlined
- Non-critical CSS lazy loaded
- Images: Next.js Image + Cloudinary optimization
- Fonts: next/font with display: swap

### Security Standards (S1-S4)

**S1: Auth Forms**
- No plain password storage in state
- Secure fetch only (HTTPS)
- httpOnly cookies for tokens

**S2: Input Sanitization**
- All user inputs sanitized before render
- CSP headers via Next.js headers()
- DOMPurify for rich text content

**S3: Route Protection**
- Middleware guards for /dashboard, /admin
- Server component role checks
- Client-side guards as UX enhancement

**S4: Environment Variables**
- All config from .env files
- NEXT_PUBLIC_* for client-side only
- No hardcoded secrets

### Code Quality Standards (Q1)

**Q1: TypeScript & Linting**
- TypeScript strict mode enabled
- 0 TypeScript errors
- 0 ESLint errors
- Prettier formatting enforced
- Import order standardized

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
apps/frontend/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                # Homepage
│   │   ├── about/
│   │   ├── contact/
│   │   └── layout.tsx
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── layout.tsx              # Minimal auth layout
│   ├── (dashboard)/
│   │   ├── @sidebar/               # Parallel route
│   │   ├── @modal/                 # Parallel route
│   │   ├── layout.tsx              # Dashboard layout
│   │   ├── page.tsx                # Dashboard home
│   │   ├── (account)/
│   │   │   ├── profile/
│   │   │   ├── settings/
│   │   │   └── orders/
│   │   └── loading.tsx
│   ├── (admin)/
│   │   ├── layout.tsx              # Admin layout
│   │   ├── products/
│   │   ├── orders/
│   │   ├── users/
│   │   └── analytics/
│   ├── api/                        # API routes (if needed)
│   ├── layout.tsx                  # Root layout
│   ├── globals.css
│   ├── not-found.tsx
│   ├── error.tsx
│   └── loading.tsx
├── src/
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       ├── Sidebar.tsx
│   │       └── MobileNav.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   ├── dashboard/
│   │   ├── products/
│   │   └── admin/
│   ├── lib/
│   │   ├── api-client.ts           # TanStack Query fetcher
│   │   ├── env.ts                  # Environment validation
│   │   ├── cloudinary.ts           # Image helpers
│   │   ├── utils.ts                # Utilities
│   │   └── query-client.ts         # React Query config
│   ├── providers/
│   │   ├── QueryProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── LenisProvider.tsx
│   │   └── AnalyticsProvider.tsx
│   ├── store/
│   │   ├── session.ts              # Auth session store
│   │   ├── ui.ts                   # UI state store
│   │   └── index.ts
│   ├── styles/
│   │   ├── tokens.css              # CSS variables
│   │   └── animations.css          # Animation utilities
│   ├── animations/
│   │   ├── motion-presets.ts       # Framer Motion variants
│   │   ├── gsap.ts                 # GSAP setup
│   │   └── lenis.ts                # Smooth scroll config
│   └── types/
│       ├── api.ts                  # API types
│       └── index.ts
├── public/
│   ├── images/
│   ├── fonts/
│   └── manifest.json
├── middleware.ts                   # Route protection
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── components.json                 # shadcn/ui config
└── package.json
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Next.js 14 Setup & Configuration (22 items)

#### 1.1 Project Initialization
- [ ] Verify Next.js 14 installed: `pnpm add next@latest react@latest react-dom@latest`
- [ ] Create `next.config.mjs` with App Router config
  - [ ] Enable `appDir` experimental feature
  - [ ] Configure `typedRoutes: true`
  - [ ] Add `serverComponentsExternalPackages: ['@prisma/client']`
  - [ ] Configure `images.remotePatterns` for Cloudinary
  - [ ] Add `images.formats: ['image/webp', 'image/avif']`
  - [ ] Configure `experimental.optimizeCss: true`

#### 1.2 TypeScript Configuration
- [ ] Create `tsconfig.json` extending `tsconfig.base.json`
  - [ ] Set `strict: true`
  - [ ] Set `baseUrl: "."`
  - [ ] Configure path aliases:
    - [ ] `@/components/*` → `./src/components/*`
    - [ ] `@/lib/*` → `./src/lib/*`
    - [ ] `@/features/*` → `./src/features/*`
    - [ ] `@/store/*` → `./src/store/*`
    - [ ] `@/styles/*` → `./src/styles/*`
    - [ ] `@/types/*` → `./src/types/*`
  - [ ] Enable `incremental: true` for faster builds
  - [ ] Set `jsx: "preserve"`

#### 1.3 Environment Configuration
- [ ] Create `lib/env.ts` for environment variable validation
  - [ ] Use Zod schema for validation
  - [ ] Validate `NEXT_PUBLIC_API_URL`
  - [ ] Validate `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - [ ] Validate optional analytics keys
  - [ ] Export typed `env` object
- [ ] Create `.env.example` with all required variables
- [ ] Document environment setup in README

#### 1.4 Package Scripts
- [ ] Add script: `"dev": "next dev"`
- [ ] Add script: `"build": "next build"`
- [ ] Add script: `"start": "next start"`
- [ ] Add script: `"lint": "next lint"`
- [ ] Add script: `"typecheck": "tsc --noEmit"`
- [ ] Add script: `"analyze": "ANALYZE=true next build"`

---

### 2. Tailwind CSS & Design System (28 items)

#### 2.1 Tailwind Installation
- [ ] Install: `pnpm add -D tailwindcss postcss autoprefixer`
- [ ] Initialize: `pnpm dlx tailwindcss init -p`
- [ ] Configure `tailwind.config.ts` with TypeScript
  - [ ] Set content paths: `./app/**/*.{js,ts,jsx,tsx}`, `./src/**/*.{js,ts,jsx,tsx}`
  - [ ] Configure darkMode: `class`

#### 2.2 Design Tokens (B1 Compliance)
- [ ] Create `src/styles/tokens.css`
  - [ ] Define CSS variables for light theme (`:root`)
  - [ ] Define CSS variables for dark theme (`[data-theme="dark"]`)
  - [ ] Primary colors (blue palette)
  - [ ] Secondary colors (violet palette)
  - [ ] Accent colors (amber palette)
  - [ ] Neutral colors (gray palette)
  - [ ] Semantic colors (success, warning, error, info)
  - [ ] Spacing scale (based on deneme.html)
  - [ ] Typography scale (font sizes, line heights)
  - [ ] Border radius values
  - [ ] Shadow definitions
  - [ ] Transition timings

#### 2.3 Tailwind Theme Extension
- [ ] Extend `theme.colors` in `tailwind.config.ts`
  - [ ] Map `lumi.primary` to CSS var `--lumi-primary`
  - [ ] Map all lumi color tokens
  - [ ] Remove default Tailwind colors (enforce B1)
- [ ] Extend `theme.spacing` for deneme.html grid
- [ ] Extend `theme.fontFamily` with custom fonts
- [ ] Extend `theme.screens` for responsive breakpoints
  - [ ] `xs: '360px'`
  - [ ] `sm: '640px'` (default)
  - [ ] `md: '768px'` (default)
  - [ ] `lg: '1024px'` (default)
  - [ ] `xl: '1280px'` (default)
  - [ ] `2xl: '1536px'` (default)

#### 2.4 Tailwind Plugins
- [ ] Install `@tailwindcss/typography`: `pnpm add -D @tailwindcss/typography`
- [ ] Install `@tailwindcss/forms`: `pnpm add -D @tailwindcss/forms`
- [ ] Install `@tailwindcss/aspect-ratio`: `pnpm add -D @tailwindcss/aspect-ratio`
- [ ] Install `@tailwindcss/container-queries`: `pnpm add -D @tailwindcss/container-queries`
- [ ] Add plugins to `tailwind.config.ts`

#### 2.5 Global Styles
- [ ] Create `app/globals.css`
  - [ ] Import Tailwind directives (`@tailwind base/components/utilities`)
  - [ ] Import tokens.css
  - [ ] Add `@layer base` for global resets
  - [ ] Add `@layer components` for custom components
  - [ ] Add glassmorphism utilities (deneme.html style)
  - [ ] Add gradient utilities
  - [ ] Add animation utilities

#### 2.6 Theme Provider
- [ ] Install `next-themes`: `pnpm add next-themes`
- [ ] Create `src/providers/ThemeProvider.tsx`
  - [ ] Wrap with `ThemeProvider` from next-themes
  - [ ] Set `attribute: "data-theme"`
  - [ ] Set `defaultTheme: "system"`
  - [ ] Enable `enableSystem: true`
  - [ ] Enable `storageKey: "lumi-theme"`
- [ ] Create theme toggle component

---

### 3. shadcn/ui Integration (32 items)

#### 3.1 shadcn/ui Setup
- [ ] Initialize: `pnpm dlx shadcn-ui@latest init`
  - [ ] Set style: `default`
  - [ ] Set base color: `blue` (customize to lumi palette)
  - [ ] Set CSS variables: `yes`
  - [ ] Configure components path: `src/components/ui`
- [ ] Update `components.json` with custom config
  - [ ] Set tailwind config path
  - [ ] Set CSS variables path
  - [ ] Enable RSC: `true`

#### 3.2 Core Components Installation
- [ ] Add button: `pnpm dlx shadcn-ui@latest add button`
- [ ] Add input: `pnpm dlx shadcn-ui@latest add input`
- [ ] Add textarea: `pnpm dlx shadcn-ui@latest add textarea`
- [ ] Add select: `pnpm dlx shadcn-ui@latest add select`
- [ ] Add checkbox: `pnpm dlx shadcn-ui@latest add checkbox`
- [ ] Add radio-group: `pnpm dlx shadcn-ui@latest add radio-group`
- [ ] Add switch: `pnpm dlx shadcn-ui@latest add switch`
- [ ] Add label: `pnpm dlx shadcn-ui@latest add label`

#### 3.3 Layout Components
- [ ] Add dialog: `pnpm dlx shadcn-ui@latest add dialog`
- [ ] Add sheet: `pnpm dlx shadcn-ui@latest add sheet`
- [ ] Add dropdown-menu: `pnpm dlx shadcn-ui@latest add dropdown-menu`
- [ ] Add navigation-menu: `pnpm dlx shadcn-ui@latest add navigation-menu`
- [ ] Add tabs: `pnpm dlx shadcn-ui@latest add tabs`
- [ ] Add accordion: `pnpm dlx shadcn-ui@latest add accordion`
- [ ] Add separator: `pnpm dlx shadcn-ui@latest add separator`

#### 3.4 Feedback Components
- [ ] Add toast: `pnpm dlx shadcn-ui@latest add toast`
- [ ] Add alert: `pnpm dlx shadcn-ui@latest add alert`
- [ ] Add badge: `pnpm dlx shadcn-ui@latest add badge`
- [ ] Add tooltip: `pnpm dlx shadcn-ui@latest add tooltip`
- [ ] Add progress: `pnpm dlx shadcn-ui@latest add progress`
- [ ] Add skeleton: `pnpm dlx shadcn-ui@latest add skeleton`

#### 3.5 Data Display Components
- [ ] Add card: `pnpm dlx shadcn-ui@latest add card`
- [ ] Add table: `pnpm dlx shadcn-ui@latest add table`
- [ ] Add avatar: `pnpm dlx shadcn-ui@latest add avatar`

#### 3.6 Form Integration
- [ ] Add form: `pnpm dlx shadcn-ui@latest add form`
- [ ] Install React Hook Form: `pnpm add react-hook-form`
- [ ] Install Zod: `pnpm add zod @hookform/resolvers`
- [ ] Create form examples with validation
- [ ] Add error message styling (B1 compliance)

---

### 4. Route Groups & Layouts (36 items)

#### 4.1 Root Layout
- [ ] Create `app/layout.tsx`
  - [ ] Import Inter font with `next/font/google`
  - [ ] Configure font with `variable` option
  - [ ] Add metadata (title, description, viewport)
  - [ ] Add ThemeProvider
  - [ ] Add QueryProvider
  - [ ] Add LenisProvider (smooth scroll)
  - [ ] Add global MotionConfig
  - [ ] Add Toaster for notifications
  - [ ] Apply font className to `<body>`

#### 4.2 Public Routes (public)
- [ ] Create `app/(public)/layout.tsx`
  - [ ] Header component (desktop + mobile)
  - [ ] Footer component
  - [ ] Newsletter signup (optional)
  - [ ] Marketing tracking wrapper
- [ ] Create `app/(public)/page.tsx` (homepage)
  - [ ] Hero section (deneme.html style)
  - [ ] Featured products
  - [ ] Category highlights
  - [ ] Call-to-action sections
- [ ] Create `app/(public)/about/page.tsx`
- [ ] Create `app/(public)/contact/page.tsx`
- [ ] Create `app/(public)/loading.tsx` (skeleton)
- [ ] Create `app/(public)/error.tsx`

#### 4.3 Auth Routes (auth)
- [ ] Create `app/(auth)/layout.tsx`
  - [ ] Minimal layout (centered form)
  - [ ] Logo/branding
  - [ ] Background animation (deneme.html aesthetic)
  - [ ] Footer with links
  - [ ] Disable layout for authenticated users (redirect)
- [ ] Create `app/(auth)/login/page.tsx`
  - [ ] Login form with validation
  - [ ] Remember me checkbox
  - [ ] Forgot password link
  - [ ] Social login buttons (placeholder)
- [ ] Create `app/(auth)/register/page.tsx`
  - [ ] Registration form with validation
  - [ ] Terms & conditions checkbox
  - [ ] Redirect to login after success
- [ ] Create `app/(auth)/forgot-password/page.tsx`
- [ ] Create `app/(auth)/reset-password/page.tsx`
- [ ] Create auth loading states
- [ ] Create auth error boundaries

#### 4.4 Dashboard Routes (dashboard)
- [ ] Create `app/(dashboard)/layout.tsx`
  - [ ] Sidebar navigation (collapsible)
  - [ ] Top bar (breadcrumbs, user menu)
  - [ ] Mobile bottom navigation
  - [ ] Command palette trigger
  - [ ] Require authentication (redirect to login)
- [ ] Create `app/(dashboard)/@sidebar/default.tsx` (parallel route)
  - [ ] Navigation menu
  - [ ] User profile summary
  - [ ] Quick actions
- [ ] Create `app/(dashboard)/@modal/default.tsx` (parallel route)
- [ ] Create `app/(dashboard)/page.tsx` (dashboard home)
  - [ ] Welcome message
  - [ ] Quick stats
  - [ ] Recent activity
  - [ ] Action cards
- [ ] Create `app/(dashboard)/loading.tsx`
- [ ] Create `app/(dashboard)/error.tsx`

#### 4.5 Admin Routes (admin)
- [ ] Create `app/(admin)/layout.tsx`
  - [ ] Admin sidebar with sections
  - [ ] Admin top bar
  - [ ] Require admin role (S3)
  - [ ] Audit logging trigger
- [ ] Create `app/(admin)/page.tsx` (admin dashboard)
  - [ ] Analytics overview
  - [ ] System health
  - [ ] Recent admin actions
- [ ] Create admin loading/error states

#### 4.6 Global Error Pages
- [ ] Create `app/not-found.tsx`
  - [ ] 404 message
  - [ ] Search functionality
  - [ ] Popular links
- [ ] Create `app/error.tsx` (error boundary)
  - [ ] Error message display
  - [ ] Reset button
  - [ ] Report error button
- [ ] Create `app/global-error.tsx` (catches root errors)

---

### 5. State Management (24 items)

#### 5.1 Zustand Setup
- [ ] Install Zustand: `pnpm add zustand immer`
- [ ] Create `src/store/session.ts`
  - [ ] Define session state type
  - [ ] User information
  - [ ] Auth token (if client-side)
  - [ ] User roles and permissions
  - [ ] Feature flags
  - [ ] Session actions (login, logout, update)
  - [ ] Persist to sessionStorage (token) + localStorage (preferences)
- [ ] Create `src/store/ui.ts`
  - [ ] Sidebar open/closed state
  - [ ] Modal stack
  - [ ] Command palette open state
  - [ ] Toast notifications state
  - [ ] Loading states
  - [ ] Actions to toggle UI elements

#### 5.2 TanStack Query Setup
- [ ] Install: `pnpm add @tanstack/react-query @tanstack/react-query-devtools`
- [ ] Create `src/lib/query-client.ts`
  - [ ] Configure QueryClient with defaults
  - [ ] Set `staleTime: 60000` (1 minute)
  - [ ] Set `retry: 3` with exponential backoff
  - [ ] Set `refetchOnWindowFocus: false` (mobile optimization)
  - [ ] Add default error handler
- [ ] Create `src/providers/QueryProvider.tsx`
  - [ ] Wrap with QueryClientProvider
  - [ ] Add React Query Devtools (development only)
  - [ ] Support SSR hydration with `HydrationBoundary`

#### 5.3 API Client Integration
- [ ] Create `src/lib/api-client.ts`
  - [ ] Axios or fetch wrapper
  - [ ] Add base URL from environment
  - [ ] Add auth token interceptor
  - [ ] Add request/response logging
  - [ ] Parse responses with Zod (Q2 format)
  - [ ] Handle Q2 error format
  - [ ] Add retry logic
  - [ ] Export typed API functions
- [ ] Create Q2 format type guards
  - [ ] `isSuccessResponse<T>()`
  - [ ] `isErrorResponse()`
  - [ ] Extract data safely

#### 5.4 Custom Hooks
- [ ] Create example query hook: `src/features/products/hooks/useProducts.ts`
  - [ ] useQuery for product list
  - [ ] Filter, sort, pagination params
  - [ ] Cache key strategy
  - [ ] Error handling
- [ ] Create example mutation hook: `src/features/cart/hooks/useAddToCart.ts`
  - [ ] useMutation for add to cart
  - [ ] Optimistic updates
  - [ ] Cache invalidation
  - [ ] Success/error toasts

---

### 6. Animation System (26 items)

#### 6.1 Framer Motion Setup
- [ ] Install: `pnpm add framer-motion`
- [ ] Create `src/animations/motion-presets.ts`
  - [ ] Define fade variants
  - [ ] Define slide variants (up, down, left, right)
  - [ ] Define scale variants
  - [ ] Define stagger container variants
  - [ ] Define page transition variants
- [ ] Create global MotionConfig in root layout
  - [ ] Set default transition timing
  - [ ] Respect `prefers-reduced-motion`

#### 6.2 GSAP Integration
- [ ] Install: `pnpm add gsap`
- [ ] Create `src/animations/gsap.ts`
  - [ ] Register GSAP plugins (ScrollTrigger, ScrollSmoother)
  - [ ] Create `useGSAP` hook wrapper
  - [ ] Handle SSR (client-only initialization)
- [ ] Create hero animation (deneme.html style)
  - [ ] Parallax scroll effect
  - [ ] Image reveal on scroll
  - [ ] Text stagger animation
- [ ] Create hotspot animation
  - [ ] Pulse effect
  - [ ] Tooltip reveal on hover
  - [ ] Click expansion

#### 6.3 Lenis Smooth Scroll
- [ ] Install: `pnpm add @studio-freight/lenis`
- [ ] Create `src/providers/LenisProvider.tsx`
  - [ ] Initialize Lenis on mount
  - [ ] Configure smooth scroll options
  - [ ] Destroy on unmount
  - [ ] Sync with Next.js route changes
  - [ ] Integrate with GSAP ScrollTrigger
- [ ] Test smooth scrolling on all routes
- [ ] Disable on mobile if performance issue

#### 6.4 Page Transitions
- [ ] Create `src/components/layout/PageTransition.tsx`
  - [ ] Use Framer Motion `AnimatePresence`
  - [ ] Create `useTransitionRouter` hook
  - [ ] Fade out → Route change → Fade in
  - [ ] Maintain scroll position option
- [ ] Apply to route groups
- [ ] Ensure loading states show during transition

---

### 7. Middleware & Route Protection (16 items)

#### 7.1 Middleware Setup
- [ ] Create `middleware.ts` at project root
  - [ ] Import `NextRequest`, `NextResponse`
  - [ ] Define protected route patterns
  - [ ] Check for auth cookie/token
  - [ ] Parse and validate JWT (if stored in cookie)
  - [ ] Extract user role from token
- [ ] RBAC Guards (S3)
  - [ ] Redirect unauthenticated users to `/login`
  - [ ] Redirect unauthorized users to `/403`
  - [ ] Allow public routes
  - [ ] Allow auth routes only for unauthenticated
  - [ ] Protect `/dashboard/*` routes (authenticated only)
  - [ ] Protect `/admin/*` routes (admin role only)
- [ ] CSRF Protection
  - [ ] Generate CSRF token on auth
  - [ ] Validate token on state-changing requests
- [ ] Add logging for security events
- [ ] Export middleware config with matcher

#### 7.2 Client-Side Guards
- [ ] Create `src/lib/guards.ts`
  - [ ] `requireAuth()` wrapper component
  - [ ] `requireRole(role)` wrapper component
  - [ ] Redirect logic if unauthorized
- [ ] Apply guards to sensitive pages
- [ ] Show loading state during auth check

---

### 8. Performance Optimization (20 items)

#### 8.1 Code Splitting
- [ ] Use Next.js `dynamic()` for heavy components
  - [ ] Admin dashboard charts
  - [ ] Rich text editor
  - [ ] Image gallery
  - [ ] Map components
- [ ] Enable route-based code splitting (automatic with App Router)
- [ ] Analyze bundle with `ANALYZE=true pnpm build`
- [ ] Optimize bundle size (target: < 180KB initial)

#### 8.2 Image Optimization
- [ ] Use `next/image` for all images
- [ ] Configure Cloudinary loader
  - [ ] Create `src/lib/image-loader.ts`
  - [ ] Generate optimized URLs with transformations
- [ ] Add `priority` to above-fold images
- [ ] Use `loading="lazy"` for below-fold images
- [ ] Implement blur placeholders (LQIP)
- [ ] Test responsive images on all devices

#### 8.3 Font Optimization
- [ ] Use `next/font/google` for web fonts
- [ ] Configure `display: 'swap'` to prevent FOIT
- [ ] Subset fonts (Latin only if applicable)
- [ ] Preload critical fonts

#### 8.4 CSS Optimization
- [ ] Enable CSS modules for component styles
- [ ] Use Tailwind JIT mode (enabled by default)
- [ ] Purge unused CSS in production
- [ ] Extract critical CSS (automatic with Next.js)
- [ ] Lazy load non-critical CSS

#### 8.5 Runtime Performance
- [ ] Implement React.memo for expensive components
- [ ] Use useMemo for expensive calculations
- [ ] Use useCallback for event handlers
- [ ] Optimize re-renders with proper key props
- [ ] Profile with React DevTools Profiler

---

### 9. Developer Experience (18 items)

#### 9.1 ESLint Configuration
- [ ] Install: `pnpm add -D eslint eslint-config-next`
- [ ] Create `eslint.config.mjs`
  - [ ] Extend `next/core-web-vitals`
  - [ ] Add Tailwind plugin
  - [ ] Add import order plugin
  - [ ] Enforce no `any` types
  - [ ] Warn on `console` statements
- [ ] Add pre-commit hook with lint-staged

#### 9.2 Prettier Configuration
- [ ] Install: `pnpm add -D prettier prettier-plugin-tailwindcss`
- [ ] Create `.prettierrc.json`
  - [ ] Set print width: 100
  - [ ] Single quotes: true
  - [ ] Trailing comma: es5
  - [ ] Tab width: 2
  - [ ] Tailwind plugin for class sorting

#### 9.3 VS Code Configuration
- [ ] Create `.vscode/settings.json`
  - [ ] Enable format on save
  - [ ] Tailwind IntelliSense
  - [ ] ESLint auto-fix
  - [ ] TypeScript import suggestions
- [ ] Create `.vscode/extensions.json`
  - [ ] Recommend Tailwind CSS IntelliSense
  - [ ] Recommend ESLint
  - [ ] Recommend Prettier

#### 9.4 Git Hooks
- [ ] Install husky: `pnpm add -D husky`
- [ ] Install lint-staged: `pnpm add -D lint-staged`
- [ ] Create pre-commit hook
  - [ ] Run `lint-staged`
  - [ ] Format with Prettier
  - [ ] Lint with ESLint
  - [ ] Type check with TypeScript

---

### 10. Testing & Documentation (22 items)

#### 10.1 Testing Setup
- [ ] Install: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom`
- [ ] Create `vitest.config.ts`
- [ ] Create test setup file
- [ ] Add test script: `"test": "vitest"`
- [ ] Add coverage script: `"test:coverage": "vitest --coverage"`

#### 10.2 Component Tests
- [ ] Test Button component variants
- [ ] Test Form component validation
- [ ] Test Theme toggle
- [ ] Test Navigation menu
- [ ] Test Modal/Dialog
- [ ] Test Toast notifications
- [ ] Achieve ≥85% coverage for components

#### 10.3 Integration Tests
- [ ] Test login flow
- [ ] Test registration flow
- [ ] Test protected route access
- [ ] Test API client error handling
- [ ] Test Zustand store actions
- [ ] Test TanStack Query hooks

#### 10.4 E2E Tests (Preparation)
- [ ] Install Playwright: `pnpm add -D @playwright/test`
- [ ] Create `playwright.config.ts`
- [ ] Create smoke test: login → dashboard navigation
- [ ] Create mobile viewport test
- [ ] Add E2E script: `"test:e2e": "playwright test"`

#### 10.5 Documentation
- [ ] Create `docs/frontend/next-foundation.md`
  - [ ] Architecture overview
  - [ ] Route structure explanation
  - [ ] State management guide
  - [ ] Animation system guide
  - [ ] Testing strategy
- [ ] Document design tokens in table format
- [ ] Create component usage examples
- [ ] Add troubleshooting section

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Type checking
pnpm --filter @lumi/frontend typecheck
# Must have 0 errors

# Linting
pnpm --filter @lumi/frontend lint
# Must have 0 errors

# Build
pnpm --filter @lumi/frontend build
# Must complete successfully

# Tests
pnpm --filter @lumi/frontend test
# Must pass with ≥85% coverage
```

### Performance Validation

```bash
# Bundle analysis
ANALYZE=true pnpm --filter @lumi/frontend build

# Verify:
# - Initial bundle < 180KB
# - Route chunks appropriately split
# - No duplicate dependencies
```

```typescript
// Lighthouse test (run on deployed preview)
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runLighthouse(url: string) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = { logLevel: 'info', output: 'json', port: chrome.port };
  const runnerResult = await lighthouse(url, options);

  const { performance, accessibility, bestPractices, seo } = runnerResult.lhr.categories;

  expect(performance.score).toBeGreaterThan(0.9); // > 90
  expect(accessibility.score).toBeGreaterThan(0.9);
  expect(bestPractices.score).toBeGreaterThan(0.9);
  expect(seo.score).toBeGreaterThan(0.9);

  await chrome.kill();
}

// Run on homepage and dashboard
runLighthouse('http://localhost:3000');
runLighthouse('http://localhost:3000/dashboard');
```

### Design System Validation (B1)

```typescript
// ESLint rule to prevent colors outside palette
// eslint-plugin-local/no-hardcoded-colors.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded color values outside design system',
    },
  },
  create(context) {
    return {
      Literal(node) {
        const value = node.value;
        // Check for hex colors
        if (typeof value === 'string' && /#[0-9A-Fa-f]{3,6}/.test(value)) {
          context.report({
            node,
            message: 'Hardcoded color detected. Use design tokens from tokens.css or Tailwind palette.',
          });
        }
      },
    };
  },
};

// Add to .eslintrc.js rules
'local/no-hardcoded-colors': 'error'
```

### Security Validation (S1-S4)

```typescript
// S1: No password in client state
const sessionStore = useSessionStore();
expect(sessionStore.password).toBeUndefined();

// S2: CSP headers
const response = await fetch('/');
const csp = response.headers.get('Content-Security-Policy');
expect(csp).toContain("default-src 'self'");

// S3: Protected routes
const dashboardResponse = await fetch('/dashboard', {
  headers: { Cookie: '' } // No auth
});
expect(dashboardResponse.status).toBe(302); // Redirect to login

// S4: No hardcoded secrets
const envFile = fs.readFileSync('.env.local', 'utf-8');
expect(envFile).not.toContain('hardcoded_secret_key');
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics
- ✅ TypeScript strict mode: 0 errors
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Prettier: All files formatted
- ✅ Test coverage: ≥85%
- ✅ Bundle size: < 180KB (initial)

### Performance Metrics
- ✅ Lighthouse Performance: ≥90
- ✅ LCP: < 2.0s
- ✅ FID: < 100ms
- ✅ CLS: < 0.1
- ✅ Build time: < 60s

### Design System Metrics (B1)
- ✅ 100% colors from approved palette
- ✅ Consistent spacing (8px grid)
- ✅ Typography scale followed
- ✅ Dark mode functional
- ✅ Responsive on all breakpoints

### Security Metrics (S1-S4)
- ✅ No client-side password storage
- ✅ CSP headers configured
- ✅ All protected routes guarded
- ✅ No hardcoded secrets in code
- ✅ HTTPS enforced in production

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Colors Outside Palette (B1 Violation)
❌ **Wrong:**
```tsx
<div className="bg-[#3B82F6]"> // Hardcoded hex
```

✅ **Correct:**
```tsx
<div className="bg-lumi-primary"> // From design tokens
```

### 2. Client-Side Password Storage (S1 Violation)
❌ **Wrong:**
```typescript
const sessionStore = create<SessionState>((set) => ({
  password: '',
  setPassword: (password) => set({ password })
}));
```

✅ **Correct:**
```typescript
// Never store password in client state
// Only use httpOnly cookies for tokens
```

### 3. Missing Type Safety
❌ **Wrong:**
```typescript
const data: any = await fetch('/api/products');
```

✅ **Correct:**
```typescript
const response = await apiClient.get<ProductListResponse>('/products');
if (isSuccessResponse(response)) {
  const products = response.data; // Fully typed
}
```

### 4. No Loading States
❌ **Wrong:**
```tsx
const { data } = useProducts();
return <div>{data.products.map(...)}</div>; // Crashes on undefined
```

✅ **Correct:**
```tsx
const { data, isLoading, error } = useProducts();
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <div>{data?.products.map(...)}</div>;
```

### 5. Unoptimized Images
❌ **Wrong:**
```tsx
<img src="/hero.jpg" alt="Hero" /> // No optimization
```

✅ **Correct:**
```tsx
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1920}
  height={1080}
  priority
  placeholder="blur"
  blurDataURL={blurPlaceholder}
/>
```

### 6. No Error Boundaries
❌ **Wrong:**
```tsx
// No error boundary, entire app crashes on error
```

✅ **Correct:**
```tsx
// app/error.tsx and route-specific error.tsx files
'use client';
export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 7. Missing Responsive Design
❌ **Wrong:**
```tsx
<div className="w-[1200px]"> // Fixed width
```

✅ **Correct:**
```tsx
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  // Responsive container
</div>
```

### 8. Accessibility Ignored
❌ **Wrong:**
```tsx
<div onClick={handleClick}>Click me</div> // Not accessible
```

✅ **Correct:**
```tsx
<button onClick={handleClick} aria-label="Submit form">
  Click me
</button>
```

---

## 📦 DELIVERABLES

### 1. Next.js Application
- ✅ Next.js 14 with App Router
- ✅ TypeScript strict mode configured
- ✅ Path aliases setup
- ✅ Environment validation

### 2. Design System
- ✅ Tailwind CSS configured
- ✅ Design tokens (tokens.css)
- ✅ B1 color palette enforced
- ✅ Dark mode support
- ✅ Responsive breakpoints

### 3. Component Library
- ✅ shadcn/ui installed and customized
- ✅ 25+ UI components
- ✅ Form components with validation
- ✅ Layout components (Header, Footer, Sidebar)

### 4. Layouts & Routes
- ✅ Root layout with providers
- ✅ Public layout and pages
- ✅ Auth layout and pages
- ✅ Dashboard layout and pages
- ✅ Admin layout and pages
- ✅ Error boundaries and loading states

### 5. State Management
- ✅ Zustand stores (session, UI)
- ✅ TanStack Query configured
- ✅ API client with Q2 format
- ✅ Custom hooks for data fetching

### 6. Animation System
- ✅ Framer Motion presets
- ✅ GSAP integration
- ✅ Lenis smooth scroll
- ✅ Page transitions

### 7. Middleware & Security
- ✅ Auth middleware (S3)
- ✅ Route protection
- ✅ RBAC guards
- ✅ CSRF protection

### 8. Developer Tools
- ✅ ESLint + Prettier configured
- ✅ Husky + lint-staged
- ✅ VS Code settings
- ✅ TypeScript strict mode

### 9. Testing
- ✅ Vitest setup
- ✅ Component tests (≥85% coverage)
- ✅ Integration tests
- ✅ Playwright E2E (preparation)

### 10. Documentation
- ✅ Architecture documentation
- ✅ Design token reference
- ✅ Component usage guide
- ✅ Testing strategy

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 6: Next.js Foundation - Completion Report

## Implementation Summary
- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items
- [x] Total Items: 264/264 (100%)
- [x] Next.js Setup: 22/22
- [x] Tailwind & Design System: 28/28
- [x] shadcn/ui Integration: 32/32
- [x] Layouts & Routes: 36/36
- [x] State Management: 24/24
- [x] Animation System: 26/26
- [x] Middleware & Security: 16/16
- [x] Performance: 20/20
- [x] Developer Experience: 18/18
- [x] Testing: 22/22

## Metrics Achieved
- **TypeScript Errors**: 0
- **ESLint Errors**: 0
- **Test Coverage**: X% (Target: ≥85%)
- **Bundle Size**: XKB (Target: <180KB)
- **Lighthouse Performance**: X (Target: ≥90)
- **LCP**: Xms (Target: <2000ms)
- **B1 Compliance**: ✅ 100%

## Known Issues
- [List any known issues or technical debt]

## Next Phase Preparation
- Phase 7 dependencies ready: ✅
- Auth integration points ready: ✅
- Documentation complete: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 7: Auth Orchestration (Enterprise)**
- Full auth flow integration (login, register, forgot password)
- Session lifecycle management
- Device trust and fingerprinting
- Account workspace (profile, settings, security)
- RBAC UX implementation
- Audit trail and compliance

**Dependencies from Phase 6:**
- Layout system ✅
- State management (Zustand + TanStack Query) ✅
- Route protection middleware ✅
- Form components with validation ✅
- Theme system ✅
- Animation presets ✅

---

**END OF PHASE 6 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-10-01_
