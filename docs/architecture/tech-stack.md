# Tech Stack Reference

This document captures the sanctioned technologies used within the Lumi monorepo and the rationale behind each selection. Any deviation requires architecture review approval.

## Core Languages and Frameworks

- **TypeScript 5.5** – Strict typing, shared across backend, frontend, and tooling.
- **Next.js 14** – Hybrid rendering, app router, and edge-readiness for the storefront.
- **Express.js** – Mature HTTP framework for the backend API gateway.
- **React 18** – UI library powering web and (future) mobile clients.

## Tooling

- **Turborepo 2.x** – Task orchestration, caching, and pipeline optimization.
- **pnpm 9** – Deterministic installs, workspace awareness, and content-addressable store.
- **Husky + lint-staged** – Pre-commit quality enforcement.
- **ESLint + Prettier** – Code quality and formatting standards.
- **Jest / Vitest** – Testing frameworks for unit, integration, and snapshot tests.

## Security & Compliance

- **Zod** – Runtime validation for environment variables and request payloads.
- **Secretlint** – Automated detection of accidental secret commits.
- **npm Audit + License Checker** – Dependency vulnerability and licensing compliance.

## Observability

- **Winston** – Structured logging with rotation strategies.
- **Prom-client** – Metrics instrumentation feeding Prometheus & Grafana stacks.
- **OpenTelemetry (planned)** – Pending integration for distributed tracing in later phases.

## Packaging & Distribution

- **Docker** – Multi-stage builds with non-root runtime images.
- **Renovate** – Automated dependency updates with enterprise policies.
- **Size Limit** – Bundle analysis for UI packages.

## Development Experience

- **VS Code Workspace Settings** (`.vscode/`) – Shared extensions and formatting defaults.
- **EditorConfig** – Line ending and whitespace consistency.
- **Storybook (planned)** – To be introduced alongside `@lumi/ui` component hardening.

## Supporting Services (Local)

- **PostgreSQL** (future phases) – Primary relational store.
- **Redis** (future phases) – Caching and session management.
- **MailHog / LocalStack** (future phases) – Email capture and cloud service emulation.

## Decision Records

All technology decisions must align with this stack. Proposals for change should be submitted via an Architecture Decision Record (ADR) stored under `docs/architecture/adr/` (directory to be introduced in Phase 1).
