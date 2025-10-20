# Authentication Security Features

This document captures the security controls introduced for Phase&nbsp;3 with a focus on
account protection, two-factor authentication readiness, and critical event visibility.

## Account Lockout Policy

- **Threshold**: Accounts are locked after five consecutive failed login attempts.
- **Duration**: Lockout period is 15 minutes (`LOCKOUT_DURATION` environment variable).
- **User Experience**:
  - API responses include `lockoutRemainingSeconds` and `lockoutRemainingMinutes` so clients can
    surface the remaining wait time.
  - Lockout notifications are queued through the auth email service.
- **Operations**:
  - Administrators can unlock accounts with `POST /api/v1/admin/users/:userId/unlock`.
  - Unlock actions reset `failedLoginCount`, clear `lockoutUntil`, and produce an
    `account_unlock_manual` security event including the operator id and reason.
  - Lockout expirations are cleaned on the next successful login attempt, preventing cumulative
    counters from lingering.

## Two-Factor Authentication Roadmap

- Database now stores `twoFactorSecret` and `twoFactorEnabled` flags to support future TOTP-based
  flows.
- Placeholder endpoints are exposed and gated behind authentication:
  - `POST /api/v1/auth/2fa/setup`
  - `POST /api/v1/auth/2fa/verify`
- Each endpoint returns a `NOT_IMPLEMENTED` error (HTTP&nbsp;501) with planned feature metadata so
  clients can gracefully detect the roadmap status.
- Future work will add TOTP enrolment, verification, recovery codes, and device management.

## Email Verification & Password Reset Enhancements

- Verification and reset tokens are generated using cryptographically secure secrets and stored as
  bcrypt hashes.
- All tokens are bound to an expiry (24&nbsp;hours for email verification, 1&nbsp;hour for password
  resets) and are invalidated on reuse or after consumption.
- Password resets revoke all active sessions, trigger notifications, and emit
  `password_reset_completed` security events.

## Security Event Telemetry

- `SecurityEventService` now classifies events by severity and forwards critical incidents to
  Sentry for alerting (`refresh_token_replay_detected`, `session_fingerprint_mismatch`,
  `admin_access_denied`).
- Key events captured:
  - `login_failed` / `login_success`
  - `account_locked` / `account_unlock_manual`
  - `permission_denied`, `role_denied`, `admin_access_attempt`, `admin_access_granted`
  - Session revocations and fingerprint mismatches
- Logged payloads include IP address, user agent, request metadata, and contextual fields such as
  lockout duration or administrative action.

These controls provide the foundation for enterprise-grade authentication resilience while keeping
operators informed about high-risk activity.
