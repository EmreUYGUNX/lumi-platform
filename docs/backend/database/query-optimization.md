# Query Performance & Optimization Guide

The Lumi backend now exposes deep visibility into database performance and provides curated repository helpers for high-traffic workflows. This document explains how to monitor query behaviour, interpret the new metrics, and apply the cursor-ready repository APIs for efficient pagination.

## Instrumentation Overview

| Metric                      | Type      | Labels                         | Purpose                                                                                           |
| --------------------------- | --------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `db_queries_total`          | Counter   | `model`, `operation`, `status` | Tracks the total number of Prisma queries grouped by model and operation type.                    |
| `db_query_duration_seconds` | Histogram | `model`, `operation`, `status` | Captures query latency distribution to surface hotspots.                                          |
| `db_slow_queries_total`     | Counter   | `model`, `operation`           | Counts queries that exceeded the configured `DATABASE_SLOW_QUERY_THRESHOLD_MS` (default `200ms`). |

> All metrics are exported with the `lumi_` prefix when `METRICS_PREFIX` is configured (default).

Slow query detection is always active. When a query exceeds the threshold:

- A structured warning is logged with model, operation, duration, and truncated SQL statement.
- An alert is dispatched (severity `warn`) subject to global alert configuration and cooldowns.
- In non-production environments an `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` plan is captured and logged at debug level. Plans are throttled to once every five minutes per unique query signature to keep output manageable.
- If a query exceeds the Prisma timeout it is escalated with severity `error`.

> Pair this document with the [Common Query Patterns](./query-patterns.md) reference when designing new data access helpers. The pattern catalogue lists the expected indexes and repository APIs for frequent workloads.

### Prometheus / Grafana quickstart

1. Add a dashboard panel with query
   ```promql
   sum(rate(lumi_db_query_duration_seconds_bucket{model="product"}[5m])) by (le)
   ```
   to visualise latency percentiles for product-related queries.
2. Use `increase(lumi_db_slow_queries_total[15m])` to alert when a model regresses.
3. To breakdown throughput by operation type:
   ```promql
   sum(rate(lumi_db_queries_total[5m])) by (model, operation)
   ```
4. Create an alert when slow queries spike:
   ```promql
   increase(lumi_db_slow_queries_total[5m]) > 10
   ```
   Wire the alert through the existing observability webhook integration.

## Repository Enhancements

### Product listings

- `ProductRepository.listActiveProducts()` now returns a lean `ProductListingSummary` that only selects the fields required for list/grid views plus the primary variant and top media assets.
- Use `ProductRepository.searchWithCursor(filters, options)` to drive infinite-scroll catalogue pages. It returns `{ items, hasMore, nextCursor }`, where `nextCursor` is the primary key token to request the next slice.

Example usage:

```ts
const { items, nextCursor } = await productRepo.searchWithCursor(
  { term: searchTerm, status: ProductStatus.ACTIVE },
  { take: 24, cursor: cursorToken ? { id: cursorToken } : undefined },
);
```

### Order history

- Two lightweight helpers were added for customer timelines:
  - `OrderRepository.listForUserHistory(userId, options)` retains page-based pagination but only selects summary fields (totals, payment statuses, snapshots).
  - `OrderRepository.listForUserCursor(userId, options)` enables cursor-based pagination for mobile feeds.

Both methods respect optional `take`, `cursor`, and `orderBy` overrides while defaulting to `createdAt DESC` with a deterministic primary key tie-breaker.

### Cart lookups

- `CartRepository` now trims the eager-loaded payload to include only variant pricing, stock, and the essential product shell (id, title, slug, currency). User data is reduced to the identifiers and display name needed for UI badges.

These changes shrink response sizes and remove superfluous joins for common storefront operations.

## Operational Notes

- Update the `.env` or runtime configuration with `DATABASE_SLOW_QUERY_THRESHOLD_MS` if different thresholds are required per environment.
- Query plan capture is disabled in production by default. To analyse production issues, reproduce the workload in staging or manually run the logged SQL with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` via `psql`.
- Connection pooling defaults were raised to `min=5`, `max=20` in alignment with the Query Optimisation checklist. The Prisma client automatically raises alerts if connection attempts fail or the pool is exhausted.

## Suggested Dashboards

| Panel                   | PromQL                                                                                                                                        | Notes                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Query latency (p95)     | `histogram_quantile(0.95, sum(rate(lumi_db_query_duration_seconds_bucket[5m])) by (le, model))`                                               | Break down by `model` to pinpoint slow domains.      |
| Slow query counter      | `increase(lumi_db_slow_queries_total[10m])`                                                                                                   | Ideal for a single-stat panel with per-model repeat. |
| Throughput by operation | `sum(rate(lumi_db_queries_total[1m])) by (operation)`                                                                                         | Highlights read/write balance.                       |
| Connection health       | Already exposed by the existing `/internal/health` and Prometheus gauges; combine with the database TCP health probe for holistic visibility. |

With these guardrails, performance regressions should surface in minutes and engineers can iterate quickly using the cursor-friendly repository APIs.
