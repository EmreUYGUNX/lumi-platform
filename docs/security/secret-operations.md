# Secret Operations Playbook

This playbook documents how Lumi manages secrets throughout their lifecycle, from provisioning to backup and rotation. It satisfies Phase 0 requirements for documented rotation, backup, and access policies.

## 1. Ownership & Access Policies

- Vault namespace: `lumi/platform`
- Secret owners: Platform Security (primary), SRE (secondary)
- Access tiers:
  - **Read/Write**: Platform Security engineers (MFA required, hardware key enforced)
  - **Read-only**: On-call SREs during incidents (time-bound approval via PagerDuty)
  - **No access**: All other roles; secrets must be consumed via runtime injection only
- Granting access requires a Jira request approved by the Security Lead and recorded in the access log.
- Access reviews occur monthly; revoke unused permissions immediately.

## 2. Secret Provisioning Workflow

1. Request tracked in Jira with owner, scope, justification, and expiry date.
2. Generate secret via Vault or dedicated provider (AWS KMS, Stripe dashboard, etc.).
3. Document secret metadata (name, owning system, rotation interval) in the vault inventory registry.
4. Update the relevant environment template with placeholder values only (`env/.env.template`).
5. Trigger automated secret scan (`pnpm security:verify`) to confirm no plaintext leakage.

## 3. Rotation Procedure

- Standard rotation cadence: every 90 days or immediately following an incident.
- Trigger rotation in Vault (or provider) → new version automatically versioned.
- Update deployment pipelines to consume the new version.
- Validate in staging, then production, monitoring for authentication errors.
- Revoke previous secret version after successful rollout.
- Update registry entry with rotation timestamp, operator, and ticket reference.

## 4. Emergency Rotation

- Applicable when compromise is suspected (alert from Gitleaks, SOC, or vendor notice).
- Execute `pnpm security:verify` to ensure repository cleanliness.
- Rotate secrets immediately, regardless of standard cadence.
- Coordinate with incident commander (see `docs/security/incident-response.md`).
- Perform post-incident review capturing cause, blast radius, and follow-up actions.

## 5. Backup & Recovery

- Vault snapshots are taken hourly and encrypted with KMS; retention: 30 days.
- Snapshots stored in secure object storage (`lumi-security-backups`) with cross-region replication.
- Restore tests executed quarterly; outcomes logged in the security operations journal.
- Backup access restricted to Security Lead and SRE Manager; all retrievals audited.

## 6. Tooling & Automation

- **Local verification**: `pnpm security:verify` runs secretlint + `pnpm audit:security`.
- **Pre-commit**: lint-staged executes `pnpm exec secretlint --maskSecrets` on staged files.
- **CI**: `.github/workflows/ci.yml` runs secretlint and Gitleaks; SARIF published to the Security dashboard.
- **Scheduled audits**: `dependency-security.yml` runs weekly to identify vulnerable packages.

## 7. Documentation & Reporting

- Maintain the secret inventory spreadsheet (Notion link) with fields: `name`, `environment`, `owner`, `rotationDue`.
- Archive rotation evidence (command transcripts/logs) in the rotation ticket.
- Notify impacted teams via Slack `#lumi-security` when rotation completes.

Adhering to this playbook guarantees S4 compliance and ensures secrets remain secure, recoverable, and well-governed.
