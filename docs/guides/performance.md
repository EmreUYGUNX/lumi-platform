# Performance Optimization Guide

This guide captures the levers available to keep Lumi within Phase 0 performance budgets (build < 60s, Docker startup < 45s, hot reload < 2s).

## Turborepo Optimisations

- Ensure `turbo daemon` is running (`pnpm turbo:daemon`) for cache reuse.
- Scope commands with `pnpm --filter` when working on a single package.
- Use `turbo run build --filter=@lumi/backend` for targeted builds.

## pnpm Tips

- Leverage the global store cache by enabling `PNPM_HOME` on local machines.
- Run `pnpm dedupe` periodically to consolidate duplicate packages (report findings in PRs).
- Avoid mixing package managers; pnpm is mandatory.

## Frontend Performance

- Use dynamic imports for non-critical components.
- Optimise assets via the image pipeline (WebP conversion) once implemented in Phase 2.
- Monitor bundle sizes with `pnpm analyze:bundle` and address budget overruns immediately.

## Backend Performance

- Cache expensive computations in-memory using the shared caching utilities (coming in Phase 3).
- Instrument routes with `prom-client` timers to identify latency hotspots.
- Avoid synchronous blocking operations inside request handlers.

## Docker & Infrastructure

- Keep Docker Desktop resources aligned (4 CPU, 8 GB RAM recommended).
- Prune unused images and containers weekly: `docker system prune -af`.
- Use BuildKit caching (`DOCKER_BUILDKIT=1`) to speed up image builds.

## Monitoring & Alerts

- Track build times in CI dashboards; flag deviations >20% to DevOps.
- Log performance regressions in the engineering retro and assign remediation.

## Continuous Improvement

- Adopt profiling tools and record findings in the knowledge base.
- For major optimisations, create an ADR capturing before/after metrics.
