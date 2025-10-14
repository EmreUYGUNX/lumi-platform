# Database Migration Runbook

This document defines how the Lumi backend team manages Prisma migrations in both development and production environments. Follow the prescribed workflow to stay compliant with Phase 2 requirements.

## Naming Convention

- Use the format `YYYYMMDD-HHMMSS_description`, e.g. `20250202-000000_initial_schema`.
- Only lowercase letters, numbers, and underscores are allowed in the description.
- Timestamps must be in UTC to prevent collisions.

## Development Workflow

1. Ensure your working tree is clean and run `pnpm db:setup --services=postgres` if you need local infrastructure.
2. Generate the migration SQL without applying it by running:
   ```bash
   pnpm prisma:migrate:dev -- --create-only --name <migration-name>
   ```
3. Review the generated `prisma/migrations/<migration-name>/migration.sql` for accuracy and performance.
4. Apply migrations locally:
   ```bash
   pnpm prisma:migrate:dev
   ```
5. Run schema validation:
   ```bash
   pnpm prisma:validate
   pnpm prisma:migrate:status
   ```
6. Commit the migration directory together with any schema or application changes.

## Production Workflow

1. Ensure staging has the same migrations applied and passes validation.
2. Deploy migrations in CI/CD using:
   ```bash
   pnpm prisma:migrate:deploy
   ```
3. Run `pnpm prisma:migrate:status` after deployment to confirm the expected state.
4. Capture database backups before running production migrations.
5. Document any manual steps required for rollback in the change ticket.

## Rollback Strategy

- Prisma does not auto-generate down migrations. To revert, create a compensating migration following the same naming convention (e.g. `20250203-120501_rollback_coupon_table`).
- Verify the rollback on staging with `pnpm prisma:migrate:deploy`.
- Update the incident log with the steps taken.

## Validation Script

- Run `pnpm prisma:migrate:check` (see package scripts) to ensure the schema, migrations, and generated client are in sync.
- The CI pipeline executes the same validation to prevent drift from reaching `main`.
