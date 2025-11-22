# Auth Orchestration Runbook

## Common Issues & Fixes

- **Session refresh failures**: Check network connectivity and API availability; validate refresh cookie; ensure clock skew <30s; retry manually from Session tab.
- **CSRF token mismatches**: Confirm `lumi.csrf` cookie present; ensure `X-CSRF-Token` header is forwarded; clear cookies and retry; verify sameSite/secure in non-prod.
- **Captcha fallback triggers**: Rate limiting or repeated failed logins; advise user to complete captcha or wait 15 minutes; confirm no automation/bots.
- **Rate limit exceeded (429)**: Surface `Retry-After`; advise user to slow retries; raise limit only for known-good traffic.
- **Device fingerprint issues**: Regenerate fingerprint (clear local storage and re-login); verify user agent availability; bypass for test if fingerprint blocked.

## SLO

- **Auth availability**: 99.9% uptime. Track via login/refresh success ratio.

## Escalation Ladder

- **Tier 1**: Frontend team (auth UX, token handling, guards).
- **Tier 2**: Backend team (auth endpoints, cookies, RBAC).
- **Tier 3**: DevOps/SRE (infrastructure, CDN, certificates).
- Escalate immediately if p95 login >3s or auth failure rate >5%.

## PagerDuty (planned integration)

- Trigger when: auth failure rate >5%, refresh failure >10%, p95 login >3s (over 5m windows).

## Triage Steps

1. Identify scope (all users vs cohort vs role).
2. Check dashboards (login success, refresh, latency, 429s, CSRF).
3. Validate feature flag rollout stage and disable risky flags if needed.
4. Inspect recent deploys and config changes.
5. Communicate status to support/stakeholders.

## Incident Templates

- **Auth Degradation**: “We are investigating increased auth errors affecting {percent}% of users. Mitigation in progress. Next update in 30m.”
- **Planned Maintenance**: “Auth services undergoing maintenance between {start}–{end}. Intermittent logins may occur.”
- **Security Incident**: “We detected suspicious auth activity. Impacted users are being notified; sessions are being rotated as a precaution.”
