# Product & Order Index Verification

This checklist documents the `EXPLAIN ANALYZE` runs that validate the new Phase 4 performance indexes. Run the commands below against a populated Postgres instance (use `DATABASE_URL` from `env/.env.template`).

## Product Indexes

```sql
EXPLAIN ANALYZE SELECT id FROM "Product" WHERE slug = 'aurora-desk-lamp';
EXPLAIN ANALYZE SELECT id FROM "Product" WHERE status = 'ACTIVE' ORDER BY createdAt DESC LIMIT 24;
EXPLAIN ANALYZE SELECT id FROM "Product" WHERE searchKeywords @> ARRAY['lamp'];
```

Expected plan highlights:

- `Index Scan using "Product_slug_key"` on `slug`
- `Bitmap Heap Scan on "Product_status_idx"` when filtering by status
- `Bitmap Index Scan on "Product_searchKeywords_idx"` for keyword queries

## Order Indexes

```sql
EXPLAIN ANALYZE SELECT id FROM "Order" WHERE userId = 'usr_123' ORDER BY createdAt DESC LIMIT 10;
EXPLAIN ANALYZE SELECT id FROM "Order" WHERE status = 'PAID' ORDER BY createdAt DESC LIMIT 10;
EXPLAIN ANALYZE SELECT id FROM "Order" WHERE reference = 'LUMI-2025-0001';
```

Expected plan highlights:

- `Index Scan using "Order_userId_idx"` for user lookups
- `Bitmap Heap Scan on "Order_status_idx"` for status dashboards
- `Index Scan using "Order_reference_key"` for reference validation

Add the captured plans to `reports/performance/index-verification-<DATE>.md` during release audits.
