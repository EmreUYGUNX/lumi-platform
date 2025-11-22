# Auth Feature Flag Rollout Plan

## Staged Release

- **Stage 1 – Internal (5%)**: Enable for staff/admin test accounts; monitor error rate, p95 sign-in latency, refresh failures.
- **Stage 2 – Beta (25%)**: Expand to beta cohort; watch failure ratio <5%, refresh failure <5%, p95 sign-in <2.5s.
- **Stage 3 – GA (100%)**: Roll out to all; keep kill switch ready.

## Rollback Criteria

- Auth failure rate >5% for 5 minutes.
- Refresh failures >10% for 5 minutes.
- p95 login latency >3s for 5 minutes.
- Spike in CSRF/fingerprint errors or elevated 429s.
- Security signals (suspicious login alerts) elevated 2x baseline.

## Monitoring & Alerting

- Metrics: auth.login.success/fail, auth.refresh.success/fail, p95 latency, rate limit hit count, CSRF mismatch count.
- Dashboards: Auth Overview, Session Refresh, Device Fingerprint Health.
- Alerts: PagerDuty if thresholds crossed per rollback criteria.

## Operational Notes

- Keep feature flags scoped by role/environment.
- Maintain gradual ramp with 15–30 min observation per stage.
- Document incidents in runbook; attach logs and dashboards in postmortem.
