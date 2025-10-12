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
- Use `beginHttpRequestObservation` and `observeHttpRequest` for consistent HTTP metrics in bespoke handlers (e.g. background jobs calling internal APIs).

```ts
import { beginHttpRequestObservation, observeHttpRequest } from "../observability/index";

const stop = beginHttpRequestObservation("POST", "/api/internal/sync");
try {
  await syncJob();
  stop("200");
} catch (error) {
  stop("500");
  throw error;
}

// Manual timings (e.g. third-party calls)
observeHttpRequest({ method: "GET", route: "/vendor/search", status: "200" }, durationSeconds);
```

> **Environment**
>
> | Key                           | Purpose                          | Default       |
> | ----------------------------- | -------------------------------- | ------------- |
> | `METRICS_ENABLED`             | Toggle metrics pipeline          | `true`        |
> | `METRICS_ENDPOINT`            | HTTP path for scraping           | `/metrics`    |
> | `METRICS_PREFIX`              | Metric name prefix               | `lumi_`       |
> | `METRICS_COLLECT_DEFAULT`     | Collect Node.js defaults         | `true`        |
> | `METRICS_DEFAULT_INTERVAL`    | Default metrics interval (ms)    | `5000`        |
> | `METRICS_BASIC_AUTH_USERNAME` | Basic auth username for scraping | `metrics`     |
> | `METRICS_BASIC_AUTH_PASSWORD` | Basic auth password for scraping | _set per env_ |

Prometheus is pre-configured via `ops/monitoring/prometheus.yml`. Grafana dashboards are seeded in `ops/monitoring/dashboards/backend-overview.json`.

### Internal Endpoints

- `GET /internal/metrics` — Prometheus scrape target. Protected with HTTP Basic auth when `METRICS_BASIC_AUTH_USERNAME/PASSWORD` are set. The endpoint responds with `text/plain` Prometheus exposition format. Example:

```bash
curl \
  -H "Authorization: Basic $(printf "%s:%s" "$METRICS_BASIC_AUTH_USERNAME" "$METRICS_BASIC_AUTH_PASSWORD" | base64)" \
  http://localhost:4000/internal/metrics
```

> **Prometheus**: update `ops/monitoring/prometheus.yml` with matching `basic_auth` credentials (defaults: `metrics` / `change-me` for local development). Prefer environment-variable interpolation or a `password_file` for production deployments.

- `GET /internal/health` — Machine-readable health snapshot following the Q2 response contract. Suitable for uptime monitors, Kubernetes probes, and runbook automation.

Import the pre-built Grafana dashboard (`ops/monitoring/dashboards/backend-overview.json`) to track request throughput, latency percentiles, error rates, and resource utilisation using the standard Lumi metrics (`lumi_http_requests_total`, `lumi_http_request_duration_seconds_*`, etc.).

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

Recommended starter rules:

1. **HTTP Error Rate** – Trigger `warn` at >2% 5xx over 5 minutes, `error` at >5%.
2. **Latency SLO** – Alert when `lumi_http_request_duration_seconds` p95 exceeds 300ms for 10 minutes.
3. **Health Degradation** – Notify when `/internal/health` reports `status !== "healthy"` for two consecutive checks.

Document custom alert payloads under `ops/monitoring/alerts/` (create per-environment YAML as rules are finalised).

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
