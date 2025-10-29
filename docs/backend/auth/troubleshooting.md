# Authentication Troubleshooting

Common issues encountered while operating the auth stack and the steps to resolve them.

## 1. Users Cannot Log In (401)

- **Symptoms**: `UNAUTHORIZED` with `invalid_credentials`.
- **Checks**
  - Examine `AuthService` logs for brute-force delays (`auth:brute-force` logger).
  - Confirm account status (`User.status` should be `ACTIVE`).
  - Verify password hashing rounds: `BCRYPT_SALT_ROUNDS` ≥ 12 outside tests.
- **Resolution**: Reset lockout counters (`prisma.user.update` clearing `failedLoginCount`) only after
  root cause confirmed.

## 2. Account Locked After Failures

- **Symptoms**: `UNAUTHORIZED` with `account_locked`.
- **Checks**
  - Inspect `lockoutUntil` and `failedLoginCount` fields.
  - Ensure lockout duration matches configuration (`LOCKOUT_DURATION` env).
- **Resolution**: Use admin unlock endpoint (`POST /api/v1/admin/users/:id/unlock`) and advise user to
  reset password. See `docs/backend/auth/lockout-policy.md`.

## 3. Token Replay Detected

- **Symptoms**: `TOKEN_REUSE_DETECTED`, sessions revoked unexpectedly.
- **Checks**
  - Review security events for `refresh_token_reuse_detected`.
  - Ensure clients do not retry refresh requests concurrently.
  - Validate that multiple devices use independent refresh cookies.
- **Resolution**: Force logout across devices (`logout-all`), prompt password change, consider incident
  runbook escalation (`docs/security/auth-incident-runbook.md`).

## 4. RBAC Denies Legitimate Access

- **Symptoms**: `FORBIDDEN` on admin endpoints.
- **Checks**
  - Confirm user’s roles via query: `SELECT r.name FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"`.
  - Verify permission matrix updates for new features.
  - Clear RBAC cache (`rbacService.invalidateUserPermissions(userId)`).
- **Resolution**: Adjust role assignments and update `ROLE_PERMISSIONS_MAP` if seeding is required.

## 5. Refresh Endpoint Returns 401

- **Symptoms**: Missing refresh cookie, invalid signature, or session revoked.
- **Checks**
  - Ensure client sends cookies (`credentials: "include"` in fetch).
  - Validate cookie domain matches `AUTH_COOKIE_DOMAIN`.
  - Inspect server logs for `refresh_token_reuse_detected` or `session_expired`.
- **Resolution**: Re-authenticate user; if persistent, examine clock skew and session expiry.

## 6. Rate Limit Responses (429)

- **Symptoms**: `Too many requests` message from auth rate limiter.
- **Checks**
  - Confirm limiter configuration in `config.security.rateLimit.routes.auth`.
  - Inspect Redis availability (if using distributed strategy).
- **Resolution**: Increase thresholds cautiously or add users/IPs to whitelist in testing
  environments.

## 7. Email Verification Tokens Failing

- **Symptoms**: `VALIDATION_ERROR` or `token_mismatch`.
- **Checks**
  - Ensure tokens are unmodified (URL encoding issues).
  - Verify token expiry (default 24 h).
- **Resolution**: Resend verification email (`POST /api/v1/auth/resend-verification`). If mismatch
  persists, instruct user to clear old sessions.

## Diagnostics Toolkit

- `pnpm --filter @lumi/backend exec prisma studio` – inspect user/session tables.
- `pnpm --filter @lumi/backend test -- auth` – rerun focused tests.
- Prometheus dashboards – track login success rate, lockout count, token rotation latency.

Escalate to the incident runbook for suspected credential stuffing, token theft, or repeated replay
events.
