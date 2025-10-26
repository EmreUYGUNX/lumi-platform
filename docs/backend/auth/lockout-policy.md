# Account Lockout Policy

Brute-force protections combine progressive delays with account lockout to satisfy S1/S2 controls.
This document captures the configuration and operational expectations.

## Configuration

| Setting                | Default             | Environment Variable                 |
| ---------------------- | ------------------- | ------------------------------------ |
| Progressive delay base | 250 ms              | `AUTH_BRUTE_FORCE_DELAY_BASE_MS`     |
| Progressive delay step | +250 ms per attempt | `AUTH_BRUTE_FORCE_DELAY_STEP_MS`     |
| Progressive delay max  | 5000 ms             | `AUTH_BRUTE_FORCE_DELAY_MAX_MS`      |
| Lockout threshold      | 5 failed attempts   | `MAX_LOGIN_ATTEMPTS`                 |
| Lockout duration       | 15 minutes          | `LOCKOUT_DURATION`                   |
| Captcha threshold      | 10 attempts         | `AUTH_BRUTE_FORCE_CAPTCHA_THRESHOLD` |

`BruteForceProtectionService` applies delays prior to credential verification. Once the attempt
limit is exceeded, `AuthService` sets `User.lockoutUntil` and `failedLoginCount`.

## Runtime Behaviour

1. Failed login increments counter and triggers progressive delay.
2. On threshold breach:
   - Account locked until `lockoutUntil`.
   - Security events created (`login_blocked_locked`) with remaining duration.
   - Optional notifications sent via email.
3. Successful login resets counters and delays.

## API Surface

- Clients receive `UNAUTHORIZED` with `details.lockoutRemainingSeconds` when lockout is active.
- Admin operators can unlock accounts through `POST /api/v1/admin/users/:id/unlock` (Phase 4).
- Lockout expiration automatically clears on next successful authentication attempt.

## Monitoring

- Metric: `auth_login_lockouts_total` (increments on each lockout).
- Log: `auth:brute-force` logger emits delay decisions and Redis fallback warnings.
- Security events: `account_locked`, `login_captcha_threshold`.

## Incident Handling

- For targeted credential stuffing attacks, escalate to the incident runbook.
- Consider temporarily tightening rate limits or enabling CAPTCHA on the frontend.
- Communicate with affected users via notification templates in `docs/backend/auth/security.md`.
