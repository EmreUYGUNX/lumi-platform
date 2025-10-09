# Observability & Monitoring Foundation

This guide explains the Phase 0 observability stack for the Lumi backend. It covers logging, metrics, health probes, alerting, and telemetry so you can operate the service with production-grade visibility from day one.

## Logging

- All application logs flow through `apps/backend/src/lib/logger.ts`, powered by Winston with structured JSON output.
- Request-scoped correlation data (e.g. `requestId`, `userId`) is injected automatically via `withRequestContext`.
- Log rotation writes to `logs/<service>-YYYY-MM-DD.log`, retaining 14 days by default. Disable disk writes in CI/test via `LOG_ENABLE_CONSOLE=false` or `NODE_ENV=test`.
- External log sinks can be attached dynamically with `registerLogTransport`.

> **Environment**
>
> | Key                  | Description                   | Default |
> | -------------------- | ----------------------------- | ------- |
> | `LOG_DIRECTORY`      | Log file directory            | `logs`  |
> | `LOG_MAX_SIZE`       | Rotate when file reaches size | `20m`   |
> | `LOG_MAX_FILES`      | Retention period              | `14d`   |
> | `LOG_ENABLE_CONSOLE` | Emit console logs             | `true`  |

Use the log query utility to inspect history:

```bash
pnpm exec node tools/scripts/log-query.mjs --level error --request req-123
```

## Metrics

- Prometheus metrics are exposed through `observability/metrics.ts` using a dedicated `Registry`.
- Default process metrics are collected (CPU, memory, GC) when `METRICS_ENABLED=true`.
- Custom counters, gauges, and histograms are created with `createCounter`, `createGauge`, and `createHistogram`. Helper functions (`trackDuration`, `trackDurationAsync`) make latency instrumentation trivial.
- A service uptime gauge (`<prefix>uptime_seconds`) updates automatically.

> **Environment**
>
> | Key                        | Purpose                       | Default    |
> | -------------------------- | ----------------------------- | ---------- |
> | `METRICS_ENABLED`          | Toggle metrics pipeline       | `true`     |
> | `METRICS_ENDPOINT`         | HTTP path for scraping        | `/metrics` |
> | `METRICS_PREFIX`           | Metric name prefix            | `lumi_`    |
> | `METRICS_COLLECT_DEFAULT`  | Collect Node.js defaults      | `true`     |
> | `METRICS_DEFAULT_INTERVAL` | Default metrics interval (ms) | `5000`     |

Prometheus is pre-configured via `ops/monitoring/prometheus.yml`. Grafana dashboards are seeded in `ops/monitoring/dashboards/backend-overview.json`.

## Health Checks

- Health probes live in `observability/health.ts`. Register custom checks with `registerHealthCheck`.
- The uptime check enforces a configurable warm-up window (`HEALTH_UPTIME_GRACE_PERIOD`).
- `evaluateHealth()` returns a full snapshot including component details and severity.

## Performance Monitoring

- Event loop latency and process memory stats are sampled every 10 seconds by `observability/performance.ts`.
- Data flows into Prometheus histograms/gauges automatically once `initializeObservability()` is invoked (happens during server startup).
- Use `getPerformanceSnapshot()` for quick diagnostics without Prometheus.

## Sentry Telemetry

- Server-side error and trace reporting integrates with `@sentry/node`.
- Provide a DSN via `SENTRY_DSN` to enable. When removed, Sentry flushes queued events gracefully.
- Release info is sourced from `GIT_SHA`. Override sampling behaviour in `observability/sentry.ts` if needed.

## Alerting

- The alert manager (`observability/alerts.ts`) fan-outs notifications to registered channels.
- Severity gating uses `ALERTING_SEVERITY`. Built-in webhook delivery is enabled automatically when `ALERTING_ENABLED=true` and a `ALERTING_WEBHOOK_URL` is supplied.
- Register on-call integrations (e.g. PagerDuty, Slack) via `registerAlertChannel`.

> **Environment**
>
> | Key                    | Description                                         | Default |
> | ---------------------- | --------------------------------------------------- | ------- |
> | `ALERTING_ENABLED`     | Global alert toggle                                 | `false` |
> | `ALERTING_WEBHOOK_URL` | Default webhook target                              | _empty_ |
> | `ALERTING_SEVERITY`    | Minimum severity (`info`, `warn`, `error`, `fatal`) | `error` |

---

**Next Steps**

1. Point Prometheus to `http://backend:4000/metrics` to collect metrics.
2. Import the Grafana dashboard JSON to visualise key KPIs.
3. Configure production-grade webhooks or incident tooling for alerts.
4. Adopt request correlation IDs within Express middleware in Phase 1 to unlock end-to-end tracing.
