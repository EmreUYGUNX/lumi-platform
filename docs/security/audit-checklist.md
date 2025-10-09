# Security Audit Checklist

Use this checklist quarterly or before major releases to validate Lumi’s security posture.

## Application Security

- [ ] Secret scans (`pnpm security:verify`) and Gitleaks reports are clean.
- [ ] CORS configuration matches approved origin list; wildcard usage justified.
- [ ] Security headers align with `docs/security.md` defaults (CSP, HSTS, COOP/COEP, CORP).
- [ ] Rate limiter thresholds match product requirements; Redis strategy reviewed if enabled.
- [ ] Input validation schemas updated for new endpoints; sanitize + stripUnknown flags verified.
- [ ] RBAC policies documented for new routes (Phase 3 dependency).

## Dependency & Build Security

- [ ] `pnpm audit:security` passes with no HIGH/CRITICAL issues.
- [ ] Dependency Review Action produces no blocking findings on active PRs.
- [ ] Renovate PR backlog reviewed and merged or deferred with justification.
- [ ] Docker images scanned (Trivy) and base images patched.

## Secret Management

- [ ] Secret inventory updated (names, owners, rotation dates).
- [ ] Backups validated (latest Vault snapshot restore test timestamp < 90 days).
- [ ] Rotation tickets closed for secrets due within the period.
- [ ] Access review completed; stale permissions revoked.

## Monitoring & Logging

- [ ] Alerting thresholds exercised (health, metrics, security alerts).
- [ ] Log retention complies with policy (90 days online, 365 days cold storage).
- [ ] Critical dashboards (SLOs, error budget, security posture) reviewed for anomalies.

## Compliance Alignment

- [ ] GDPR/KVKK data processing register updated.
- [ ] Data subject request (DSR) process tested end-to-end.
- [ ] Third-party processors reviewed; DPAs up to date.
- [ ] Security training completion rate ≥ 95% for active engineers.

Record audit outcomes in the Security Operations journal and assign remediation tasks with clear owners and due dates.
