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
