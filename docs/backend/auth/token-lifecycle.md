# Token Lifecycle

This document outlines how access and refresh tokens are created, rotated, stored, and revoked in
the Lumi backend. Understanding the lifecycle is essential for diagnosing auth issues and designing
secure clients.

## Token Types

| Token         | TTL                                | Transport                        | Purpose                  |
| ------------- | ---------------------------------- | -------------------------------- | ------------------------ |
| Access token  | 15 minutes (`AUTH_JWT_ACCESS_TTL`) | Bearer header                    | Authorise API requests   |
| Refresh token | 14 days (`AUTH_JWT_REFRESH_TTL`)   | HTTP-only cookie + response body | Obtain new access tokens |

Both tokens are HS256 JWTs containing:

- `sub` – user id
- `sessionId` – authentication session
- `jti` – unique token identifier (rotated on every refresh)
- `exp` – expiration timestamp

## Creation

1. `AuthService.login` or `refresh` invokes `TokenService`.
2. `TokenService.generateAccessToken` builds claims with roles & permissions.
3. `TokenService.generateRefreshToken` creates a new `jti` and expiry.
4. `SessionService.createSession` stores:
   - Hashed refresh token (`bcrypt`)
   - Fingerprint (if device metadata supplied)
   - Expiry and metadata (IP, user-agent)
5. Refresh token returned in payload and set as signed HTTP-only cookie.

## Validation

- Access tokens validated by `TokenService.verifyAccessToken`
  - Signature & expiry check
  - Session must exist and match user
  - Fingerprint validated when provided by client
- Refresh tokens validated by `TokenService.verifyRefreshToken`
  - Signature & expiry check
  - JTI compared against blacklist
  - Hash comparison via `SessionService.validateSession`

## Rotation

1. Client calls `POST /api/v1/auth/refresh` with refresh cookie.
2. `TokenService.rotateRefreshToken`:
   - Verifies existing refresh token
   - Adds previous `jti` to blacklist (prevent reuse)
   - Issues new token pair
   - Updates session with new hashed refresh token + expiry
3. Response sets new refresh cookie.

## Revocation Paths

| Trigger                     | Action                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Logout                      | `SessionService.revokeSession` sets `revokedAt`, clears cookie      |
| Logout all                  | `SessionService.revokeAllUserSessions` revokes every active session |
| Password reset/change       | All sessions revoked, tokens blacklisted                            |
| Verification token mismatch | Immediate session revocation                                        |
| Token replay detected       | All sessions revoked, incident logged                               |
| Session expiry cleanup job  | Marks expired sessions as revoked                                   |

Refresh token blacklist entries last until the original token expiry to block replay attempts.

## Storage & Security

- Refresh tokens never stored in plain text – only bcrypt hashes.
- Access tokens are not persisted server-side.
- Cookie attributes: `HttpOnly`, `SameSite=Strict`, `Secure` outside development, `Path=/api`.
- Fingerprinting ties sessions to device metadata (`ipAddress`, `userAgent`, optional `accept`).

## Observability

- Metrics
  - `auth_token_generation_duration_ms`
  - `auth_token_refresh_duration_ms`
  - `auth_token_replay_detected_total`
- Logs
  - Token rotation success/failure (INFO/ERROR)
  - Replay detection (WARN)
- Security events
  - `refresh_token_reuse_detected`
  - `session_revoked`

## Operational Tips

- Use `POST /api/v1/auth/logout-all` after critical incidents (e.g. suspected compromise).
- Monitor blacklist size; excessive growth may indicate automation abuse.
- Ensure clocks are synchronised (NTP) between services to avoid premature expiry.

For endpoint specifics consult `docs/api/auth-endpoints.md` and the OpenAPI specification.
