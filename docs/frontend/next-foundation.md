# Next.js Foundation (Phase 6)

## Architecture Overview

- Next.js 15 App Router with route groups `(public)`, `(auth)`, `(dashboard)/dashboard`, `(admin)/admin` and parallel routes for sidebar/modal.
- Shared providers live under `src/providers` (ThemeProvider, QueryProvider, AnalyticsProvider) and are composed in `src/app/layout.tsx` with MotionConfig + Tooltip + Toaster.
- UI kit is Shadcn-based in `src/components/ui`, while layout components live in `src/components/layout` and experience components in `src/components/marketing`, `src/components/dashboard`, and `src/components/admin`.
- State: React Query handles server data, Zustand stores (`src/store`) manage session/UI flags, and `src/lib/api-client.ts` enforces Q2 schema validation + retries.
- Animations: `src/animations/motion-presets.ts` for Framer variants, `src/animations/gsap.ts` for ScrollTrigger/Smoother helpers, applied through `PageTransition` and hero hotspots.

## Route Structure

- `(public)` → marketing homepage, about, contact with shared layout & footer. Loading/error boundaries per group.
- `(auth)` → login, register, forgot/reset password. Minimal layout, background animation, redirects controlled by `NEXT_PUBLIC_REQUIRE_AUTH_GUARDS`.
- `(dashboard)/dashboard` → authenticated shell with parallel `@sidebar` and `@modal` routes, mobile nav, command palette trigger, `RequireAuth` guard placeholder.
- `(admin)/admin` → RBAC-protected admin shell with analytics/products/users/orders sections and audit logging hooks.
- Global boundaries: `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx`.

## State Management Guide

- **Zustand (`src/store`)**: `sessionStore` manages auth/session tokens, preview users, preferences persistence; `uiStore` manages toast queue, modal stack, and loading flags. Safe for SSR because storage layer shims session/localStorage in Node.
- **TanStack Query (`src/providers/QueryProvider.tsx`)**: hydrated client with defaults (staleTime 60s, retry 3x, no refetch on focus) and Devtools in dev. Keys live in `src/features/products/hooks/product.keys.ts`.
- **API Client (`src/lib/api-client.ts`)**: Q2 responses validated via Zod, automatic retries for network/5xx, auth header from `sessionStore`, typed helpers `isSuccessResponse`/`isErrorResponse`.
- **Environment (`src/lib/env.ts`)**: validates `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, analytics keys. Toggle guards via `NEXT_PUBLIC_REQUIRE_AUTH_GUARDS` + `NEXT_PUBLIC_ENABLE_MOCK_USER`.

## Animation System

- Global MotionConfig in `src/app/layout.tsx` (user-respected reduced motion, 0.45s cubic-bezier transitions).
- Reusable variants in `src/animations/motion-presets.ts` (fade/slide/scale/stagger/page).
- GSAP helpers in `src/animations/gsap.ts` wrap ScrollTrigger/Smoother with SSR-safe initialization and custom hooks for hero/hotspot effects.
- `PageTransition` component wraps route groups to fade between pages while preserving scroll when requested.

## Testing Strategy

- **Unit/Component (Vitest + RTL)**: Button variants, Form validation wiring, Theme toggle, Navigation menu interactions, Dialog open/close, Toast queue + dismissal, Zustand store actions, API client error paths, product query hook normalization.
- **Integration**: Auth flows (login/register UI), protected route redirects when guards enforced, Q2 API client retry logic, TanStack Query + mocked API bridge.
- **E2E Prep (Playwright)**: `playwright.config.ts` with desktop + mobile projects, smoke `login → dashboard` path, mobile hero/CTA assertions. Run via `pnpm --filter @lumi/frontend test:e2e`.
- **Coverage**: `pnpm --filter @lumi/frontend test:coverage` targets ≥85% lines/functions/branches for frontend; coverage output to `coverage/apps/frontend`.

## Design Tokens (B1 Palette)

| Token           | Light                                                                 | Dark                             |
| --------------- | --------------------------------------------------------------------- | -------------------------------- |
| Primary         | `--lumi-primary: #3b82f6`                                             | `--lumi-primary` (same)          |
| Primary (Dark)  | `--lumi-primary-dark: #2563eb`                                        | `--lumi-primary-dark`            |
| Primary (Light) | `--lumi-primary-light: #60a5fa`                                       | `--lumi-primary-light`           |
| Secondary       | `--lumi-secondary: #8b5cf6`                                           | `--lumi-secondary`               |
| Accent          | `--lumi-accent: #f59e0b`                                              | `--lumi-accent`                  |
| Background      | `--lumi-bg: #ffffff`                                                  | `--lumi-bg: #111827`             |
| Surface         | `--lumi-bg-secondary: #f9fafb`                                        | `--lumi-bg-secondary: #1f2937`   |
| Text            | `--lumi-text: #111827`                                                | `--lumi-text: #f9fafb`           |
| Text Muted      | `--lumi-text-secondary: #6b7280`                                      | `--lumi-text-secondary: #9ca3af` |
| Border          | `--lumi-border: #e5e7eb`                                              | `--lumi-border: #374151`         |
| Semantic        | success `#10b981`, warning `#f59e0b`, error `#ef4444`, info `#3b82f6` | same                             |

Spacing uses 8px grid variables `--lumi-space-*`, typography uses `--lumi-font-sans`/`--lumi-font-heading`, radii `--lumi-radius-*`, shadows `--lumi-shadow-*`, transitions `--lumi-transition-*`.

## Component Usage Examples

- **Button**: `<Button variant="secondary" size="lg">Save changes</Button>` or `<Button asChild><a href="/dashboard">Dashboard</a></Button>`.
- **Form**: wrap with `<Form {...form}>` and `<FormField>`; `<FormMessage>` auto-renders React Hook Form validation messages and toggles `aria-invalid`.
- **Theme Toggle**: place `<ThemeToggle className="fixed bottom-6 right-6" />` inside `ThemeProvider` to flip `data-theme` between light/dark.
- **Navigation Menu**: compose `NavigationMenu > NavigationMenuList > NavigationMenuItem` with `NavigationMenuTrigger` and `NavigationMenuContent` for accessible, animated flyouts.
- **Dialog**: `<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent>…</DialogContent></Dialog>`; close button provided by default.
- **Toast**: call `toast({ title, description })` and render `<Toaster />` once at the app root; queue capped to keep UX calm.

## Troubleshooting

- **Env validation fails**: ensure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` are set or rely on defaults (`http://localhost:4000/api/v1`, `demo`).
- **Auth guard redirecting locally**: unset `NEXT_PUBLIC_REQUIRE_AUTH_GUARDS` or enable mock user (`NEXT_PUBLIC_ENABLE_MOCK_USER=true`) while backend auth is not wired.
- **Tests failing on Next modules**: Vitest mocks for `next/image`, `next/link`, `next/navigation`, and `next/font/google` live in `vitest.setup.ts`; verify custom components import from aliases (`@/...`) to use them.
- **Flaky API client tests**: mock `global.fetch` and use fake timers to control retry backoff; do not hit live endpoints in unit tests.
- **Playwright base URL**: override with `E2E_BASE_URL` when running against a preview deployment; default is `http://localhost:3000`.
