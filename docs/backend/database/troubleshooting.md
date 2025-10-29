# Database Troubleshooting Guide

Use this checklist when diagnosing database issues in development, staging, or production. It complements the [Emergency Recovery Playbook](./emergency-recovery.md) for crisis-level incidents.

## 1. Migration Failures

| Symptom                                                          | Likely Cause                                         | Resolution                                                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P3006 Migration failed to apply cleanly to the shadow database` | Schema drift (manual changes, missing migrations)    | Run `pnpm prisma:migrate:status` to identify divergence. Reset the local database with `pnpm prisma:migrate:reset --skip-seed`, then re-apply migrations. |
| `relation already exists`                                        | Migration attempting to recreate dropped table/index | Inspect `migration.sql`, remove redundant DDL, or drop the conflicting object manually before deployment.                                                 |
| `column ... contains null values`                                | Backfilling non-null column without defaults         | Split the migration: add nullable column, backfill via script, alter to `NOT NULL`. Document the manual step in the rollout ticket.                       |

## 2. Slow Queries (>200 ms)

1. Check the slow query log emitted by Prisma (`WARN prisma:query` entries).
2. Run the captured SQL in staging with `EXPLAIN (ANALYZE, BUFFERS)` to inspect plan regressions.
3. Verify supporting indexes exist (see [Schema Reference](./schema.md#index-strategy-summary)).
4. If the query is relation-heavy, confirm repositories request eager-loading (`include`) instead of manual loops.
5. Set a temporary feature flag or partial rollout to reduce traffic while optimising.

## 3. Connection Pool Exhaustion

- Inspect `/internal/metrics` for `lumi_db_connection_pool_in_use`.
- Increase pool size via `DATABASE_POOL_MAX` **only after** confirming queries are not leaking connections (see logs for long-running transactions).
- Validate application instances are not exceeding the Postgres connection limit; scale horizontally if necessary.

## 4. Deadlocks

1. Review Postgres logs (`ERROR: deadlock detected`) and capture the involved statements.
2. Ensure transactional operations follow a consistent locking order (e.g. `Order` → `Payment` → `Inventory`).
3. If batching updates, prefer `SELECT ... FOR UPDATE` on the target rows before mutation.
4. Document the deadlock signature in this guide once resolved to prevent recurrence.

## 5. Seed Script Issues

- Failure on second run indicates missing `upsert` logic—verify every create call uses `upsert` or `createMany` with `skipDuplicates`.
- For locale-specific data, guard seeding with feature flags or environment checks to avoid polluting production.

## 6. Data Integrity Violations

- Prisma `P2003` (foreign key) errors usually map to `ValidationError`. Confirm the upstream service is validating DTOs with the shared schemas.
- For `P2002` (unique constraint) collisions, inspect audit logs to determine whether a previous soft-delete occurred; repositories should automatically exclude `deletedAt` rows.

## 7. Observability Alarms

- **Metric Spike**: Use Grafana dashboard “DB Latency” and correlate with deploy timestamps.
- **Error Rate Increase**: Check Sentry tags `db.operation` and `db.model` to pinpoint failing repositories.
- **Disk Growth**: Run the table size query from [Schema Reference](./schema.md#monitoring-queries) and archive historic data (e.g. old audit logs) per retention policy.

> Keep this guide version-controlled. When a novel issue is solved, add a new entry covering symptom, root cause, and resolution.
