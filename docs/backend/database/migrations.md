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

1. Verify staging mirrors production (migrations, seed, configuration) and all automated tests pass.
2. Trigger the backup pipeline (see [Backup Strategy](#backup-strategy)) and record the archive ID in the rollout ticket.
3. Place the service in **read-only** mode if required by the migration (long-running schema changes, column drops, etc.).
4. Deploy migrations through CI/CD:
   ```bash
   pnpm prisma:migrate:deploy
   ```
5. Immediately run a status check from the deployed environment:
   ```bash
   pnpm prisma:migrate:status
   ```
6. Run targeted smoke tests (API read/write happy paths) before opening the service to full traffic.
7. Document follow-up tasks, compensating data fixes, or feature flags associated with the rollout.

## Backup Strategy

- **Schedule**: Nightly logical dumps (`pg_dump --format=custom`) retained for 30 days and hourly WAL archiving for point-in-time recovery. Backups are orchestrated by `tools/scripts/backup.ts`.
- **On-demand backups**: Prior to each production migration run `pnpm backup:create` (wrapper around `tools/scripts/backup.ts`) and store the artefact in the secure S3 bucket (`s3://lumi-backups/<environment>/<timestamp>`). Tag the change ticket with the backup URI.
- **Verification**: CI runs `pnpm backup:restore -- --verify` weekly against staging to confirm backups are restorable. Engineers can manually test restores using Docker by pulling the latest artefact and invoking the restore script.
- **Access control**: Backup buckets are encrypted with KMS and restricted to the SRE IAM role; do not embed credentials in scripts. Fetch temporary credentials from Vault when running manual backups.

## Rollback Strategy

1. **Containment**: Disable write traffic (load balancer drain or feature flag) and notify stakeholders.
2. **Evaluate options**:
   - Schema-only issues → create a compensating migration (e.g. `20250203-120501_rollback_coupon_table`) and deploy via the normal pipeline.
   - Data corruption → restore the latest backup to a shadow database, validate correctness, then promote or replay targeted WAL segments.
3. **Implement**:
   ```bash
   pnpm prisma:migrate:dev --name rollback_<issue>
   pnpm prisma:migrate:deploy
   ```
   Document manual changes executed against production (SQL scripts, hotfixes).
4. **Validation**: Re-run smoke tests, monitor error rates, and close the incident with a root-cause summary.

## Validation Script

- Run `pnpm prisma:migrate:check` (see package scripts) to ensure the schema, migrations, and generated client are in sync.
- The CI pipeline executes the same validation to prevent drift from reaching `main`.
