# Authentication Incident Runbook

Use this playbook when suspicious activity is detected in the authentication or session
infrastructure (e.g. token replay, brute-force attack, credential stuffing).

## 1. Detection & Classification

| Signal                                                     | Source                      | Severity |
| ---------------------------------------------------------- | --------------------------- | -------- |
| `refresh_token_reuse_detected` event                       | SecurityEventService / logs | High     |
| Rapid increase in `login_failed`/`account_locked` metrics  | Prometheus                  | Medium   |
| Unusual rate-limit breaches (`auth:login`, `auth:refresh`) | Logs / metrics              | Medium   |
| Admin route access denied attempts                         | Logs                        | High     |

Classify incidents as:

- **Category A** – Confirmed token replay or credential leak.
- **Category B** – Automated brute-force attack without compromise.
- **Category C** – False positive or user error.

## 2. Immediate Response

1. Notify on-call engineer (PagerDuty) with incident summary.
2. Increase logging verbosity (`LOG_LEVEL=debug`) if necessary.
3. For Category A:
   - Execute `POST /api/v1/auth/logout-all` for affected users.
   - Force password reset by setting `User.status = "SUSPENDED"` until new password set.
4. For Category B:
   - Tighten rate limits temporarily (reduce points/duration).
   - Enable CAPTCHA on frontend if available.
5. Preserve evidence – export relevant logs and metrics snapshots.

## 3. Investigation Checklist

- Identify affected user IDs and session IDs from security events.
- Confirm whether IP addresses belong to known ranges or TOR/VPN networks.
- Check if password reset emails were triggered without user action.
- Verify no admin accounts were targeted; if so escalate to security leadership.

## 4. Communication

- **Internal**: Post updates in `#security-incidents` Slack channel every 30 minutes.
- **External**: Notify customers if incident impacts confidentiality (coordinate with Legal/Comms).
- **Post-incident**: File Jira ticket documenting timeline, root cause, and remediation.

## 5. Recovery Actions

- Regenerate JWT secrets if servers are suspected compromised.
- Rotate Redis keys used for RBAC cache if tampering detected.
- Update WAF/IP block lists based on malicious sources.
- Ensure affected users reset passwords and confirm via email acknowledgement.

## 6. Post-Incident Review

- Schedule retro within 3 business days.
- Capture action items (e.g. improve monitoring, update tests).
- Update this runbook with lessons learned.

## References

- `docs/backend/auth/token-lifecycle.md`
- `docs/backend/auth/lockout-policy.md`
- `docs/backend/auth/troubleshooting.md`
- `docs/security/incident-response.md`

Keep this runbook version-controlled and review quarterly to align with evolving threat models.
