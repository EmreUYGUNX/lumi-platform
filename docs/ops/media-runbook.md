# Media Operations Runbook

Cloudinary powers every media asset flowing through Phase&nbsp;5. The backend enforces MIME/size policies, threat scanning, CDN cache warming, and usage monitoring. This runbook explains how to operate the system when credentials rotate, uploads fail, quotas spike, or webhooks misbehave.

---

## 1. Cloudinary Dashboard Access

1. Requests go through the `#lumi-ops` Slack channel. Grant _Media Admin_ access only to engineers in the on-call rotation.
2. Sign in via <https://cloudinary.com/console> and confirm the sub-account matches the target environment (`lumi-dev`, `lumi-staging`, `lumi-prod`).
3. Bookmark the following tabs:
   - **Media Library** – real-time search for assets by `public_id`, folder, or tag.
   - **Settings → Security** – API keys, upload presets, webhook targets.
   - **Settings → Usage** – storage, bandwidth, and derived transformation quotas.

> **RBAC reminder:** Never share the master API key. For read-only investigations, provision short-lived sub-accounts instead.

### API Key Rotation Procedure

1. Create a new key pair under **Settings → Security → API Keys**. Label it with the target environment and rotation date.
2. Update secret stores (Vault/AWS Secrets Manager) and `env/.env.<env>` entries:
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Redeploy the backend. The integration layer hot-reloads credentials via `cloudinary.config()`.
4. Validate by running the Postman “Upload Media Asset” request. If it fails, roll back by re‑applying the previous key.

---

## 2. Upload Troubleshooting

1. **Check Prometheus metrics:** `media_uploads_total{status="failure"}` and `media_upload_duration_seconds_bucket` should stay steady. Use `curl http://<api-host>/internal/metrics | rg media_upload`.
2. **Review Sentry alerts:** search for the tags `media_event_type=upload.failure` or `cloudinary.error`. Every upload failure now captures the file name, folder, actor, and ApiError code.
3. **Sample the API:** use Postman or curl:
   ```bash
   curl -X POST "{{baseUrl}}/v1/media/upload" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -F folder=lumi/products \
     -F visibility=public \
     -F tags=diagnostic \
     -F file=@hero.jpg
   ```
4. **Inspect the queue:** `MediaQueueController` logs webhook job failures (look for `media:webhook-event` with errors). Sentry alerts for webhook errors carry `media_event_type=webhook.failure`.
5. **Cloudinary dashboard:** search for the `public_id` to confirm the asset arrived. If it exists but the API returned 500/timeout, trigger `POST /api/v1/admin/media/:id/regenerate` to re-sync metadata.

Common fixes:

- 413 / 415 errors: verify folder (`lumi/banners` allows 10&nbsp;MB, others 5&nbsp;MB) and MIME whitelist (`jpeg`, `png`, `webp`, `gif`).
- Malware detection: security team receives the Sentry event; asset quarantined via `MediaThreatService`.

---

## 3. CDN Cache Purge Procedure

Use this when a published asset needs to be refreshed globally.

1. Call the admin regenerate endpoint (requires `admin`/`staff` token):
   ```bash
   curl -X POST "{{baseUrl}}/v1/admin/media/{{mediaId}}/regenerate" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   The backend triggers `cloudinary.uploader.explicit` with `invalidate=true`, updates the DB, and records the new version.
2. For bulk cache busting, run the Postman “Delete Media Asset (Admin)” request to soft-delete and then re-upload the replacement.
3. If Cloudinary still serves stale content, use the dashboard **Media Library → Invalidate** action or execute:
   ```bash
   pnpm --filter @lumi/backend exec tsx -e "import('./src/integrations/cloudinary/cloudinary.client.ts').then(async ({ getCloudinaryClient }) => { const client = getCloudinaryClient(); await client.regenerateAsset('lumi/products/hero', { invalidate: true }); process.exit(0); })"
   ```

---

## 4. Orphan Cleanup (Manual Trigger)

The scheduled cleanup runs daily at `02:00 UTC`, but you can trigger it manually after mass deletions.

```bash
pnpm --filter @lumi/backend exec tsx -e "import('./src/jobs/media-cleanup.job.ts').then(async ({ runMediaCleanupJob }) => { const result = await runMediaCleanupJob({ dryRun: false, triggeredBy: 'ops/manual' }); console.log(result); process.exit(0); })"
```

- Set `dryRun: true` to preview the assets flagged as orphans (older than 30 days with no associations).
- After execution, confirm Cloudinary usage dropped by checking `cloudinary_usage_bytes{resource="storage",kind="usage"}`.

---

## 5. Emergency Media Rollback

1. Identify the `public_id`/`version` pair from the DB or Cloudinary history view.
2. Use Cloudinary’s “Restore to previous version” action or re-upload the archived file with the same `public_id` and `overwrite=false`.
3. Call `POST /api/v1/admin/media/:id/regenerate` to ensure eager transformations and CDN caches reflect the restored version.
4. If the revert affects multiple products, soft-delete the current assets (`DELETE /v1/admin/media/:id`), re-upload the backups via `MediaUploader`, and use the gallery selection mode to reassign primary images.

---

## 6. Quota Monitoring & Alerts

The backend polls `cloudinary.api.usage()` every 15 minutes (`MediaUsageMonitor`) and exposes:

- `cloudinary_usage_bytes{resource="storage|bandwidth|transformations",kind="usage|limit"}`
- `cloudinary_usage_ratio{resource="..."}` – ratio of usage to quota.

Alerts fire via the central webhook when usage exceeds **80 %** (warn) or **95 %** (error). Alert payloads list the resource, usage, limit, and ratio.

Response playbook:

1. Acknowledge in `#lumi-ops` and link the alert ID.
2. Inspect Cloudinary → **Usage** to confirm the numbers.
3. Execute `pnpm --filter @lumi/backend exec pnpm prisma studio` (or SQL) to identify large assets and delete unused ones via the admin gallery.
4. If the ratio continues to climb, request a temporary quota bump from Cloudinary Support and document the incident in the runbook.

---

## 7. Webhook Setup & Recovery

### Configuration

1. Backend endpoint: `POST https://api.lumi-commerce.com/webhooks/cloudinary`
2. In Cloudinary **Settings → Webhooks**, add the URL and select events `upload`, `destroy`, `derived`, `moderation`.
3. Copy the signing secret into `CLOUDINARY_WEBHOOK_SIGNING_SECRET`.
4. Timestamps older than 5 minutes are rejected; ensure Cloudinary and API clocks are synced.

### Signature Verification

- Backend computes `sha256(rawBody + timestamp)` with the shared secret and compares against `x-cld-signature`.
- If the signature or timestamp fails, Cloudinary receives `401` and retries.

### Retry Policy

- BullMQ queue (`media:webhook-event`) retries failed jobs **5 times** with exponential backoff (2s base). Failures emit Sentry alerts (`media_event_type=webhook.failure`) and are logged with job IDs.
- Manual replay: locate the `notification_id` in the Cloudinary dashboard and issue the **Resend** action, or enqueue custom payloads via `MediaQueueController.enqueueWebhookEvent`.

---

## 8. Backup & Recovery Strategy

1. **Cloudinary Backups**
   - Enable “Automatic Backup” in Cloudinary (Settings → Backup) to mirror uploads to the secure S3 bucket (`lumi-media-backup`).
   - For ad-hoc exports, use `cloudinary.api.resources({ type: 'upload', max_results: 500, direction: 'desc' })` and archive the payload.
2. **Database Metadata**
   - Media metadata lives in `media_assets`. It is covered by the standard Postgres PITR snapshots (`pnpm backup:create`). Use `pnpm backup:restore --tag <timestamp>` to hydrate a staging database before promoting changes to production.
3. **Recovery Procedure**
   - Restore Cloudinary assets from S3 backup or by re-uploading archived files.
   - Restore DB metadata to staging, verify associations (products/variants), then promote by copying rows into production using controlled SQL migrations (`INSERT ... SELECT` guarded by transaction).
   - Run `POST /v1/admin/media/:id/regenerate` for the restored assets to ensure derived resources exist.

---

## 9. Reference Metrics & Commands

| Purpose             | Metric / Command                                                                        |
| ------------------- | --------------------------------------------------------------------------------------- |
| Upload health       | `media_uploads_total`, `media_upload_duration_seconds`                                  |
| Storage growth      | `media_storage_bytes{folder="lumi/products"}`                                           |
| Cloudinary quota    | `cloudinary_usage_ratio{resource="storage"}`                                            |
| CDN warming success | `media_cdn_prefetch_total{status="hit"}`                                                |
| Manual upload test  | Postman “Upload Media Asset” or curl sample above                                       |
| Manual cleanup      | `pnpm --filter @lumi/backend exec tsx -e "import('./src/jobs/media-cleanup.job.ts')...` |

Keep this runbook updated after every incident review or infrastructure change.
