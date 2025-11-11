# API Runbook

This runbook summarises the operational procedures for the Lumi Core API after Phase&nbsp;4.

## Rate Limit Tuning

| Scope    | Route prefix           | Default limit              | Notes                                                                                       |
| -------- | ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| Customer | `/api/v1/orders`       | 60 requests per 5 minutes  | Covers checkout, order list, cancellation. Increase cautiously; brute-force impact is high. |
| Admin    | `/api/v1/admin/orders` | 300 requests per 5 minutes | Shared budget for admin tooling. Coordinate with the dashboard team before changing.        |

**Change process**

1. Update `ORDER_RATE_LIMIT` in `apps/backend/src/modules/order/order.router.ts`.
2. Adjust the security configuration for distributed rate limit stores if Redis is used.
3. Announce the change in `#ops-alerts` and update this table when the change is deployed.

## Feature Flag Rollout

- Order-payment integrations should be hidden behind [`featureFlags.orderPayments`](../../apps/backend/src/config/index.ts) before enabling new providers.
- Use staged rollout: development → staging soak (24h) → production canary (10% traffic) → full rollout.
- Capture metrics from `order_created_total` and `order_status_transitions_total` during each stage. Abort if error rates exceed 1%.

## Emergency Procedures

### Failed Payments

1. Identify the failing provider from `Payment.provider`.
2. Mark the payment as `FAILED` and trigger `sendOrderRefundEmail`.
3. Notify the customer manually when automated email delivery fails.

### Inventory Mismatch

1. Run `pnpm --filter @lumi/backend prisma:migrate:status` to ensure schema consistency.
2. Compare `Cart` reservations with `ProductVariant.stock`.
3. Use `OrderService.restockInventory` via the admin refund endpoint to re-balance stock.

### Fraud or Chargeback Alerts

1. Review audit logs under `/api/v1/admin/audit-logs`.
2. Lock the affected user via the admin user endpoint.
3. Record a security incident entry referencing the order reference and timeline payload from `GET /api/v1/orders/:reference/track`.

## Incident Communication

- Primary channel: `#lumi-incidents`.
- Escalation order: On-call Backend → Engineering Manager → CTO.
- Always attach the request ID from the response formatter when opening an incident.

## Production Deployment

### Environment Variables

- Copy `.env.production.template` and set the highlighted values **before** the first deploy:
  - Database safety: `DATABASE_POOL_MIN/MAX`, `DATABASE_SLOW_QUERY_THRESHOLD_MS=100`, `QUERY_TIMEOUT_MS=5000`.
  - Security: `COOKIE_SECRET`, `JWT_*_SECRET`, `SESSION_FINGERPRINT_SECRET`, `CONFIG_ENCRYPTION_KEY`.
  - CORS and domains: `CORS_ALLOWED_ORIGINS=https://app.lumi-commerce.com,https://admin.lumi-commerce.com`, `CORS_EXPOSED_HEADERS=X-Request-Id,X-API-Version`.
  - Rate limits: `RATE_LIMIT_ENABLED=true`, `RATE_LIMIT_STRATEGY=redis`, `RATE_LIMIT_REDIS_URL` pointing at the production Redis cluster.
- Commit the template values to `ops/infra` and keep the actual secrets in the vault (AWS Secrets Manager/Azure Key Vault).

### API Gateway / Load Balancer

- Terminate TLS at the gateway (ALB/Nginx) and forward traffic with `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` so the backend sees the real client IP.
- Health checks should target `/api/v1/health/ready` (readiness) and `/api/v1/health/live` (liveness) every 30 s with a 2 s timeout.
- Enable HTTP/2 and enforce HSTS at the edge; the Express server already disables `x-powered-by` and trusts the first proxy hop in production.

### CORS & Rate Limits

- Verify `CORS_ALLOWED_ORIGINS` includes every production domain (storefront, admin, partner portal). Use comma-separated values; redeploy after edits.
- Redis-backed rate limits require the `RATE_LIMIT_REDIS_URL` secret. Ensure the Redis security group allows connections from the API subnets only.
- Monitor `lumi_http_requests_total` and `lumi_cart_operations_total` when changing rate-limit points and update the runbook table with the new budgets.

### Log Aggregation

- Ship `apps/backend/logs/*.log` via Fluent Bit or Filebeat to the central observability stack (Elastic/Loki).
- Tag streams with `service=backend-api`, `environment`, and `region` so alerts can pivot quickly.
- Retain request logs for 14 days; archival logs can move to S3 Glacier according to the compliance checklist.

### Automated Backups

- **Postgres**: schedule `pg_dump --format=custom` every hour plus daily base backups (WAL archiving). Sync artefacts to `s3://lumi-backups/postgres/`.
- **Redis**: enable RDB snapshots (`save 600 10000`) and replicate to a warm standby instance. Store weekly snapshots in S3.
- **Config**: version the `.env.production` secrets in the vault and export a redacted copy to the incident response folder whenever variables change.
- Test restores quarterly: spin up a temporary database, apply the latest dump, run `pnpm prisma:migrate:status`, and document the outcome.
