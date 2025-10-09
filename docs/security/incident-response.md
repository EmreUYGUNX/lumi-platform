# Security Incident Response Plan

This document extends the general emergency runbook with actions tailored to security events (breaches, leaked credentials, policy violations).

## 1. Detection

- Alert sources: Gitleaks SARIF, secretlint failures, SOC alerts, vendors, customer reports.
- First responder validates alert authenticity and severity within 15 minutes.

## 2. Declaration

1. Raise an incident via Slack `/incident start` with severity (SEV-1..SEV-3).
2. Engage the Platform Security on-call via PagerDuty.
3. Reference this plan in the incident timeline.

## 3. Roles

- **Incident Commander (IC)** – Coordinates activities, maintains timeline.
- **Security Lead** – Drives containment, assesses regulatory exposure.
- **SRE Representative** – Handles infrastructure changes, rollbacks.
- **Communications Lead** – Manages stakeholder/customer updates.
- **Scribe** – Captures events, decisions, evidence.

## 4. Immediate Actions

1. Identify compromised assets (services, credentials, user data).
2. Contain: revoke/rotate secrets (`docs/security/secret-operations.md`), isolate services, disable compromised accounts.
3. Preserve evidence: capture logs, metrics, and snapshots before remediation.
4. Enable heightened logging/alerting where necessary.

## 5. Eradication & Recovery

- Patch vulnerabilities, apply configuration fixes, or deploy hotfix builds.
- Validate systems in staging before re-enabling production paths.
- Monitor for recurrence (logs, metrics, IDS) for at least 24 hours after resolution.

## 6. Communication

- Send updates every 15 minutes in `#lumi-incidents`.
- Notify executives and legal within 30 minutes for SEV-1 incidents.
- Prepare customer messaging templates if data exposure is suspected.

## 7. Post-Incident Review

- Complete within 48 hours: timeline, root cause, blast radius, detection efficacy.
- Assign remediation tasks with owners and due dates.
- Update runbooks and automation to prevent recurrence.
- File regulatory notifications (GDPR/KVKK) if required; consult Legal.

## 8. Artifacts

- Incident tracker (Notion) with linked tickets.
- Evidence bundle: logs, metrics exports, forensics snapshots.
- Post-incident report shared with engineering leadership and compliance officers.

This plan ensures a consistent, auditable response that aligns with Lumi’s zero-trust commitments and regulatory obligations.
