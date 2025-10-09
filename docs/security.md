# Security Handbook

This handbook codifies Phase 0 security requirements (S1–S4) and operational practices for the Lumi platform.

## Security Principles

- **Zero-Trust**: Never trust inbound data. Validate and sanitize everything.
- **Least Privilege**: Services and users receive only the permissions they need.
- **Defense in Depth**: Combine static analysis, runtime guards, and operational monitoring.

## S1 – Credential Handling

- Password hashing must use bcrypt (>= 12 rounds). Implementation delivered in Phase 3.
- Store only hashed credentials; never log plaintext passwords.

## S2 – Validation & Sanitization

- Use Zod schemas for every inbound request and environment variable.
- Shared schemas live in `@lumi/types` to ensure parity across clients.
- Reject payloads that fail validation; do not attempt to coerce silently.

## S3 – RBAC Preparation

- Role enums and policy scaffolding exist in `@lumi/shared/auth` (Phase 3 deliverable).
- New endpoints must specify the minimum required role and enforce via middleware hooks.

## S4 – Secret Management

- Secrets are never hardcoded. Use environment variables defined in `env/.env.template`.
- Seal secrets using `pnpm env:seal` before sharing via version-controlled channels.
- Commit secret templates only; production values stay in Vault.
- Run `pnpm exec secretlint "**/*"` before every push and part of CI.

## Secure Development Lifecycle

1. **Plan** – Conduct threat modelling for new features and document mitigations.
2. **Build** – Follow secure coding guidelines and run lint/security checks locally.
3. **Test** – Use Jest/Vitest security tests plus dependency audits.
4. **Deploy** – Ensure Docker images run as non-root; sign images for verification.
5. **Monitor** – Configure alerting for anomalies and integrate with PagerDuty.

## Dependency Hygiene

- Run `pnpm audit:security` weekly and before each release.
- Use Renovate dashboard to approve dependency upgrades after verification.
- Check license compliance with `pnpm deps:licenses`.

## Incident Response

- Immediate escalation via Slack `#lumi-incidents` and PagerDuty on-call (see `docs/guides/emergency-runbook.md`).
- Start an incident document capturing timeline, impact, and mitigation steps.
- Post-incident reviews are mandatory within 48 hours of resolution.

## Access Controls

- Repository access managed via GitHub SSO and role-based teams.
- Production secrets require MFA and approval from Security Lead.
- Rotate credentials at least every 90 days.

## Reporting Vulnerabilities

- Internal: open a confidential ticket tagged `security`.
- External: Notify security@lumi.com with reproduction steps.
- Follow responsible disclosure guidelines; do not exploit beyond proof of concept.
