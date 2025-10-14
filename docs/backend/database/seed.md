# Database Seed Runbook

This guide explains how to seed the Lumi database across different environments using the Prisma seed infrastructure delivered in Phase 2.

## Overview

- Seed entry point: `prisma/seed.ts`
- Data factories: `prisma/seed/data/*`
- Supported profiles: `development`, `qa`, `production`, `demo`
- Idempotent upserts with transaction safety
- Automatic validation after each execution (roles, permissions, admin user, product sanity)

## Commands

```bash
# Core seed command (defaults to development profile)
pnpm prisma:seed

# Profile-specific seeds
SEED_PROFILE=development pnpm prisma:seed       # or pnpm prisma:seed:dev
SEED_PROFILE=qa          pnpm prisma:seed       # or pnpm prisma:seed:qa
SEED_PROFILE=production  pnpm prisma:seed       # or pnpm prisma:seed:prod
SEED_PROFILE=demo        pnpm prisma:seed       # or pnpm prisma:seed:demo

# Validation without data mutation
pnpm prisma:seed:status
SEED_PROFILE=qa pnpm prisma:seed:status
```

## Profiles

| Profile     | Description                          | Data scope                                                 |
| ----------- | ------------------------------------ | ---------------------------------------------------------- |
| development | Lean local dataset                   | Base roles/permissions, admin user, curated catalog sample |
| qa          | Expanded QA dataset                  | Development data + extra generated categories/products     |
| production  | Minimal bootstrap for production     | Core RBAC entities and admin user, no sample catalog       |
| demo        | Showcase dataset for sandboxes/demos | QA dataset + additional demo-specific catalog entries      |

## What Gets Seeded

- **RBAC**: Roles (customer, staff, admin), permissions, role-permission mapping
- **Admin User**: `admin@lumi.com` (override via `SEED_ADMIN_*` env vars)
- **Catalog**: Hierarchical categories, products, variants, media assets, inventory (profile-dependent)
- **Validation**: Ensures bcrypt hashes (S1), role & permission counts, product presence when required

## Environment Variables

| Variable                | Purpose                             | Default            |
| ----------------------- | ----------------------------------- | ------------------ |
| `SEED_PROFILE`          | Selects seed profile                | `development`      |
| `SEED_ADMIN_EMAIL`      | Admin user email                    | `admin@lumi.com`   |
| `SEED_ADMIN_PASSWORD`   | Admin user password (bcrypt hashed) | `ChangeMeNow!2025` |
| `SEED_ADMIN_FIRST_NAME` | Admin user first name               | `Lumi`             |
| `SEED_ADMIN_LAST_NAME`  | Admin user last name                | `Admin`            |

## CI Integration

The `database` job in `.github/workflows/ci.yml` now runs:

1. `pnpm prisma:migrate:check`
2. `SEED_PROFILE=development pnpm prisma:seed`
3. `SEED_PROFILE=development pnpm prisma:seed:status`

This enforces migration + seed health on every PR.

## Validation Only Mode

Use `--check`, `--status`, or `--validate` to run non-destructive validation:

```bash
pnpm exec tsx prisma/seed.ts --status
pnpm exec tsx prisma/seed.ts --check --profile qa
```

The command checks RBAC entities, admin user bcrypt compliance, and catalog counts (when applicable).

## Extending Seeds

- Add or adjust factory logic in `prisma/seed/data/`.
- Keep identifiers stable (slug, SKU, assetId) to remain idempotent.
- Update `ROLE_PERMISSIONS_MAP` when introducing new permissions.
- Export new helper functions via `prisma/seed/data/index.ts` if needed by `prisma/seed.ts`.

## Troubleshooting

- **Unique constraint conflicts**: ensure generated slugs/SKUs are stable and unique. Factories include guards for collisions.
- **Connection issues**: confirm `DATABASE_URL` points to a writable database; CI uses PostgreSQL service `postgresql://postgres:postgres@localhost:5432/lumi`.
- **Validation failures**: inspect the error list printed after validation. All failures exit with non-zero status.

## Cleanup

To reset the database and re-seed:

```bash
pnpm prisma:migrate:reset -- --force --skip-seed   # drops all data
SEED_PROFILE=development pnpm prisma:seed          # reseed
```

> Replace the profile to target QA/demo/production datasets.
