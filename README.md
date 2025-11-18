# Lumi Commerce Monorepo

> Enterprise-grade foundation for the Lumi omni-channel commerce platform.

## Table of Contents

- [Overview](#overview)
- [Monorepo Layout](#monorepo-layout)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Workspace Commands](#workspace-commands)
- [Quality, Testing, and Security](#quality-testing-and-security)
- [Environment Management](#environment-management)
- [Documentation Map](#documentation-map)
- [Support and Escalation](#support-and-escalation)

## Overview

Lumi operates as a Turborepo-managed monorepo that hosts backend, frontend, mobile, and shared packages. The repository is configured for secure-by-default development, zero-trust secret handling, and production parity environments. All applications target Node.js 20+ and leverage pnpm for deterministic installs.

## Monorepo Layout

- `apps/backend` – Express-based API server with observability, validation, and security middlewares.
- `apps/frontend` – Next.js 14 application delivering the storefront experience.
- `apps/mobile` – Placeholder for the future React Native client.
- `packages/shared` – Cross-cutting utilities, helpers, and domain logic shared across apps.
- `packages/ui` – Component library and design system assets.
- `packages/types` – Shared TypeScript types and schema definitions.
- `tools/` – Automation scripts, validators, and development utilities.
- `docs/` – Source of truth for architecture, process, and operational runbooks.
- `.github/` – CI/CD workflows covering quality, security, and automation.

## Prerequisites

- Node.js >= 20.18.1 (LTS recommended).
- pnpm >= 9.0.0 (bundled with repo to enforce workspace logic).
- Docker Desktop or Docker Engine >= 24 for local container orchestration.
- Git with LFS support.

## Quick Start

1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd lumi-ticaret
   pnpm install
   ```
2. Copy the environment template and populate required secrets (see [`docs/security.md`](docs/security.md)):
   ```bash
   cp env/.env.template env/.env
   ```
3. Launch the developer stack:
   ```bash
   pnpm docker:dev
   pnpm dev
   ```
4. Verify health endpoints:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000/health

## Workspace Commands

Commonly used root-level scripts (full catalog in `package.json`):

- `pnpm dev` – Start all watch-mode processes with hot reload.
- `pnpm build` – Run production builds for every package using Turborepo.
- `pnpm test` – Execute the test matrix (Jest, Vitest) across all workspaces.
- `pnpm lint` / `pnpm lint:fix` – Enforce ESLint and Prettier gates.
- `pnpm typecheck` – Strict TypeScript compilation for every project.
- `pnpm docker:dev` / `pnpm docker:down` – Start/stop Dockerized dependencies.
- `pnpm clean` – Remove build artifacts and caches.
- `pnpm analyze:bundle` – Inspect UI bundle size budgets.

## Quality, Testing, and Security

- Linting: ESLint with Airbnb, security, and custom rulesets enforced via Husky.
- Formatting: Prettier with import sorting and Tailwind plugins.
- Testing: Jest and Vitest cover unit, integration, and snapshot suites (`docs/testing.md`).
- Security: Automated secretlint + Gitleaks scanning, dependency reviews, and environment validation (`docs/security.md`). Run `pnpm security:verify` before pushing to execute the combined checks locally.
- CI/CD: See `.github/workflows/` for pipeline definitions and guardrails.

## Environment Management

Environment variables are centrally documented in [`docs/configuration/environment.md`](docs/configuration/environment.md). Secrets must never be committed; use the sealed vault procedure defined in [`docs/security.md`](docs/security.md#secret-management-policy).

### Frontend Environment Variables

The Next.js workspace (`apps/frontend`) reads its configuration from the standard `.env*` files. Ensure the following public variables are set before running any frontend command:

- `NEXT_PUBLIC_API_URL` – Absolute base URL for the backend API (example: `http://localhost:4000/api/v1`).
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` – Cloudinary cloud identifier used when building image URLs.
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_AMPLITUDE_API_KEY`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID` – Optional analytics identifiers that default to blank but must be provided in production as needed.

Copy `.env.example` (or the templates under `env/`) into your local `.env` files and adjust the values above to match your environment before running `pnpm dev`.

## Documentation Map

- [`docs/getting-started.md`](docs/getting-started.md) – Full onboarding, validation, and developer workflows.
- [`docs/architecture/overview.md`](docs/architecture/overview.md) – Platform topology and service interactions.
- [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) – Technology selections and rationale.
- [`docs/code-style.md`](docs/code-style.md) – Language, framework, and lint standards.
- [`docs/contributing.md`](docs/contributing.md) – Contribution workflow and review expectations.
- [`docs/testing.md`](docs/testing.md) – Testing pyramid, tooling, and how to run suites.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) – Common issues and resolution steps.

A broader index lives in [`docs/README.md`](docs/README.md).

## Support and Escalation

Operational contacts, escalation paths, and emergency procedures are outlined in [`docs/guides/emergency-runbook.md`](docs/guides/emergency-runbook.md). For engineering support, use Slack `#lumi-incidents` or email `dev-team@lumi.com`.
