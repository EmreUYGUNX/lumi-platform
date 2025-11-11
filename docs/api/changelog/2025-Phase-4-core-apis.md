# 2025-10-01 – Phase 4 Core APIs

## Added

- `X-API-Version` response header on every endpoint so client telemetry and SDKs can assert which version served the request.
- API versioning policy documentation covering `/api/v1` (stable) and forward-looking `/api/v2` planning plus the backward-compatibility contract.
- API runbook outlining rate-limit change controls, feature-flag rollout steps, and emergency procedures for cart/order/payment failures.

## Changed

- Production `.env` template now ships battle-tested defaults for CORS, Redis-backed rate limits, connection pooling, and 100 ms slow-query logging.
- Order APIs emit Sentry transaction traces (`order.create`, `order.cancel`, `order.status_update`, `order.refund`) to correlate incidents with business workflows.

## Deprecated

- The legacy `/api/*` alias is now tagged as version `v0`. Every call receives `Deprecation`, `Sunset`, and `X-API-Version: v0` headers. Consumers must migrate to `/api/v1/*` before the six-month sunset completes.
