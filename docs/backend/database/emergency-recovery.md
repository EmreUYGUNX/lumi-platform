# Emergency Recovery Playbook

This guide details the actions required to restore Lumi database operations after a catastrophic failure (data loss, widespread corruption, or unrecoverable migration). It complements the [Migration Runbook](./migrations.md) and should be followed in conjunction with the incident response process.

## 1. Detection & Communication

1. Declare a **SEV-1 incident** in the incident tooling and page the on-call engineer, SRE team, and product owner.
2. Freeze writes by enabling maintenance mode (toggle in the control plane) or by removing API instances from the load balancer.
3. Capture observability artefacts: database logs, slow query logs, and the latest application traces. Attach them to the incident timeline.

## 2. Assess Blast Radius

- Determine the last known good timestamp using monitoring dashboards and audit logs.
- Identify affected systems (primary database, read replicas, downstream analytics).
- Decide whether to pursue **point-in-time recovery** (preferred) or restore from the last full logical backup.

## 3. Prepare Recovery Environment

1. Provision a clean PostgreSQL instance (staging or temporary production replacement).
2. Retrieve the backup artefact:
   ```bash
   aws s3 cp s3://lumi-backups/production/<timestamp>.dump.gz ./restore.dump.gz
   ```
3. Verify checksum against the manifest stored with the backup.
4. Decompress the archive and perform a dry-run restore using:
   ```bash
   pnpm backup:restore -- --input ./restore.dump --target postgresql://<temp-db-uri>
   ```

## 4. Execute Restore

1. For point-in-time recovery, replay WAL files up to the identified timestamp. For logical backups, run:
   ```bash
   pnpm backup:restore -- --input ./restore.dump --target $DATABASE_URL --force
   ```
2. Apply any compensating migrations recorded after the backup. Use the `prisma migrate deploy` history for ordering.
3. Validate schema alignment:
   ```bash
   pnpm prisma:migrate:status
   pnpm prisma:generate
   ```
4. Run targeted verification scripts (`pnpm test:jest -- database`) or the smoke-test suite to confirm functional readiness.

## 5. Reintroduce Traffic

1. Gradually restore API instances behind the load balancer.
2. Keep read traffic throttled until error rates stabilise; closely monitor:
   - `db_queries_total`
   - `db_query_duration_seconds`
   - Application error budgets
3. Communicate recovery status to stakeholders and provide an estimated time for full capacity.

## 6. Postmortem Checklist

- Document root cause, timeline, actions taken, and prevention steps.
- Capture data discrepancies and arrange reconciliation processes where necessary.
- Audit backup retention policies and confirm the failure mode is covered by future drills.

> **Reminder**: Never delete or overwrite backup artefacts during an incident. Always copy to a new location to preserve evidentiary integrity.
