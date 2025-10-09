# Architecture Overview

The Lumi platform follows a modular, service-oriented architecture delivered through a TypeScript-first monorepo. This overview highlights system boundaries, runtime flows, and the supporting infrastructure configured during Phase 0.

## System Context

- **Frontend (Next.js 14)**: Public storefront, customer account management, and checkout flows. Communicates with the backend via REST and consumes shared design tokens from `@lumi/ui`.
- **Backend (Express + Zod)**: API gateway and orchestration layer for commerce capabilities. Provides REST endpoints, handles authentication, and enforces RBAC scaffolding.
- **Shared Packages**: `@lumi/shared`, `@lumi/types`, and `@lumi/ui` deliver reusable logic, DTOs, and UI primitives to maintain parity across surfaces.
- **Tooling and Automation**: Turborepo coordinates builds, tests, and caching; Husky + lint-staged guard quality at commit-time.

## Logical View

1. **Presentation Layer** – Next.js storefront, future mobile client.
2. **Application Layer** – Express controllers, domain services, validation pipelines.
3. **Integration Layer** – Placeholder connectors for databases, payment services, and third-party APIs (to be implemented in later phases).
4. **Cross-Cutting Concerns** – Logging, monitoring, metrics, security, and configuration management shared via `packages/shared`.

## Runtime Interactions

- Frontend requests hit the backend gateway through a load balancer (Local: direct HTTP).
- Backend validates requests using Zod schemas from `@lumi/types` before reaching domain services.
- Logging and metrics are emitted via Winston and Prometheus clients and shipped to the observability stack (Docker-compose services in development).

## Monorepo Pipelines

- **Build**: Turborepo orchestrates isolated builds per package with dependency graph pruning for deployment artifacts.
- **Test**: Jest/Vitest suites run per workspace; results aggregated by CI.
- **Lint & Typecheck**: Executed in parallel using Turborepo pipelines defined in `turbo.json`.
- **Docker**: Multi-stage Dockerfiles in `apps/backend` and `apps/frontend` ensure production-ready images.

## Security Foundations

- Zero-trust secrets (S4) via environment variables managed by sealed vault operations.
- Strict TypeScript and ESLint enforcement prevents unsafe patterns.
- Husky hooks perform pre-commit secret scanning and lint gates.

## Observability

- Structured logging (`winston` with rotating file transports).
- Metrics exposure via `prom-client` hitting Prometheus.
- Runbooks and dashboards are documented in [`docs/guides/observability.md`](../guides/observability.md).

## Future Phases

This architecture will extend with database integrations (Phase 2), authentication (Phase 3), and advanced commerce modules (Phases 4–10). Phase 0 ensures the scaffolding, tooling, and documentation baseline is complete before feature work begins.
