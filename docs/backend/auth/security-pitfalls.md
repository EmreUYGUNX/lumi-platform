# Common Security Pitfalls

Authentication systems fail when small misconfigurations accumulate. Avoid the following issues when
extending Lumi’s auth stack.

## 1. Skipping Password Hashing

- Never persist passwords or refresh tokens in plain text.
- Always use `hashPassword` and store only the resulting bcrypt hash.
- When verifying manually (e.g. scripts), use `verifyPassword`; avoid `bcrypt.compareSync` in async
  contexts.

## 2. Bypassing RBAC Middleware

- Directly mounting controllers without `requireAuth`/`requireRole` leads to privilege escalation.
- Use route factories (`createAuthRouter`, admin router) as examples of correct ordering.

## 3. Trusting Client-Supplied Roles or Permissions

- Access tokens originate server-side; never accept roles/permissions from request bodies.
- Always recompute permissions in backend services (`rbacService.getUserPermissions`).

## 4. Forgetting to Revoke Sessions

- After password resets or high-risk events, call `SessionService.revokeAllUserSessions`.
- `TokenService.rotateRefreshToken` already revokes previous tokens—do not short-circuit it.

## 5. Disabling Rate Limits for Convenience

- Removing rate limiters to “fix” local testing introduces attack vectors in production.
- Instead, whitelist trusted IPs in non-production environments.

## 6. Overly Verbose Error Messages

- Use generic error messages (`Invalid credentials`) to prevent account enumeration.
- Only include detailed validation issues for form errors that do not leak account existence.

## 7. Ignoring Telemetry

- Security events (e.g. `refresh_token_reuse_detected`) require operational attention.
- Wire dashboards/alerts before go-live; stale dashboards signal blind spots.

## 8. Misconfigured Cookies

- Keep `SameSite=Strict`, `HttpOnly`, and `Secure` flags enabled.
- Ensure `AUTH_COOKIE_DOMAIN` matches the deployed domain; mismatches break refresh flows.

By adhering to these practices we maintain S1–S4 compliance and reduce the risk of auth regressions.
