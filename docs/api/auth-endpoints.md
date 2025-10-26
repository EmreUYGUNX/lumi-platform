# Auth API Reference

This guide supplements the OpenAPI specification (`docs/api/openapi.yaml`) with narrative guidance for
client engineers integrating with the authentication surface. Each endpoint follows the standard
response envelope:

- Success payloads: `{"success": true, "data": { ... }}`
- Error payloads: `{"success": false, "error": { "code": string, "message": string, "details"?: object }}`

Tokens are expressed as JSON Web Tokens (JWT) signed with HS256. Refresh tokens are always issued as
HTTP-only, SameSite=strict cookies in addition to being returned in the response body for native
clients that need to manage their own storage.

## Endpoint Summary

| Method | Path                               | Description                                     | Auth           | Rate Limit                                 |
| ------ | ---------------------------------- | ----------------------------------------------- | -------------- | ------------------------------------------ |
| `POST` | `/api/v1/auth/register`            | Create a new customer account                   | None           | 5 / 15 min (per IP)                        |
| `POST` | `/api/v1/auth/login`               | Exchange credentials for tokens                 | None           | 5 / 15 min (per IP) with progressive delay |
| `POST` | `/api/v1/auth/refresh`             | Rotate refresh token and fetch new access token | Refresh cookie | 10 / min                                   |
| `POST` | `/api/v1/auth/logout`              | Revoke current session                          | Bearer token   | 20 / min                                   |
| `POST` | `/api/v1/auth/logout-all`          | Revoke every active session                     | Bearer token   | 5 / min                                    |
| `GET`  | `/api/v1/auth/me`                  | Retrieve authenticated profile                  | Bearer token   | 60 / min                                   |
| `POST` | `/api/v1/auth/verify-email`        | Confirm email ownership                         | None           | 30 / hour                                  |
| `POST` | `/api/v1/auth/resend-verification` | Issue a new verification email                  | Bearer token   | 3 / hour (per account)                     |
| `POST` | `/api/v1/auth/forgot-password`     | Trigger password reset email                    | None           | 3 / hour (per IP/email)                    |
| `POST` | `/api/v1/auth/reset-password`      | Complete password reset with token              | None           | 10 / hour                                  |
| `PUT`  | `/api/v1/auth/change-password`     | Change password for current session             | Bearer token   | 5 / hour (per account)                     |
| `POST` | `/api/v1/auth/2fa/setup`           | Two-factor enrolment placeholder                | Bearer token   | 10 / hour                                  |
| `POST` | `/api/v1/auth/2fa/verify`          | Two-factor verification placeholder             | Bearer token   | 10 / hour                                  |

> ℹ️ Rate limits shown derive from `config.security.rateLimit.routes.auth` defaults. Environments
> may override these values.

## Request & Response Contracts

### Register (`POST /api/v1/auth/register`)

- **Request body**
  ```json
  {
    "email": "customer@example.com",
    "password": "Str0ng!Passw0rd",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "phone": "+442012341234" // optional
  }
  ```
- **Responses**
  - `201`: user profile plus verification expiry
  - `400`: validation issues (payload or password policy)
  - `409`: email already registered

### Login (`POST /api/v1/auth/login`)

- **Request body**: `{ "email": string, "password": string }`
- **Successful response (`200`)**
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "6f7f2f7b-2f6b-4f6f-9ad0-6cb5f03f6f20",
      "accessToken": "<jwt>",
      "refreshToken": "<jwt>",
      "accessTokenExpiresAt": "2025-10-26T23:15:00.000Z",
      "refreshTokenExpiresAt": "2025-11-09T23:00:00.000Z",
      "user": { "...": "AuthUserProfile" }
    }
  }
  ```
- **Error codes**: `400` validation, `401` invalid credentials or inactive account.
- **Headers**: `Set-Cookie: refreshToken=...; HttpOnly; Secure?; SameSite=Strict; Path=/api`.

### Refresh (`POST /api/v1/auth/refresh`)

- **Request**: no body; signed `refreshToken` cookie required.
- **Response**: same payload as login with rotated tokens.
- **Errors**: `401` (missing cookie, replay attempt, expired session).

### Logout (`POST /api/v1/auth/logout`)

- **Auth**: Bearer access token.
- **Response**: `{ "data": { "sessionId": "<revoked-id>" } }`
- **Side effects**: refresh cookie cleared; audit event emitted.

### Logout All (`POST /api/v1/auth/logout-all`)

- **Response**: `{ "data": { "revokedSessions": number } }`

### Me (`GET /api/v1/auth/me`)

- Returns the full `AuthUserProfile`. Useful for bootstrapping client session state.

### Verify Email (`POST /api/v1/auth/verify-email`)

- **Request**: `{ "token": "<verification-token>" }`
- **Errors**:
  - `400`: malformed or already-consumed token.
  - `401`: signature mismatch; all sessions revoked as a precaution.

### Resend Verification (`POST /api/v1/auth/resend-verification`)

- **Auth**: Bearer token.
- **Errors**:
  - `409`: email already verified.
  - `429`: resend throttled (per user).

### Forgot Password (`POST /api/v1/auth/forgot-password`)

- Always returns `200` with inclusive messaging.
- On success, security telemetry logs the request; rate limiting applied.

### Reset Password (`POST /api/v1/auth/reset-password`)

- **Request**: `{ "token": "<reset-token>", "password": "<new-password>" }`
- **Errors**: `401` when token invalid or expired. All active sessions are revoked on success.

### Change Password (`PUT /api/v1/auth/change-password`)

- **Request**
  ```json
  {
    "currentPassword": "OldPass123!",
    "newPassword": "N3w!Passw0rd"
  }
  ```
- **Errors**
  - `400`: password policy failure or password reuse detected.
  - `401`: current password incorrect.
  - `429`: throttled after repeated attempts.

### Two-Factor Placeholders (`POST /api/v1/auth/2fa/*`)

- Both `setup` and `verify` return `501 NOT_IMPLEMENTED` with roadmap metadata. Use this to toggle
  client UI until 2FA support ships.

## Standard Error Codes

| HTTP  | `error.code`        | Meaning                                              | Notes                                                          |
| ----- | ------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `400` | `VALIDATION_ERROR`  | Payload failed schema or password policy enforcement | `error.details.issues[]` exposes field-level feedback          |
| `401` | `UNAUTHORIZED`      | Invalid credentials, token reuse, session expired    | Trigger re-authentication, optionally surface `details.reason` |
| `403` | `FORBIDDEN`         | Missing permissions for admin/authenticated routes   | Log incident in client telemetry                               |
| `404` | `NOT_FOUND`         | Resource not located (rare for auth flows)           | Typically returned for stale verification links                |
| `409` | `CONFLICT`          | Operation conflicts with current state               | Example: email already verified                                |
| `429` | `TOO_MANY_REQUESTS` | Rate limit enforced by `authRateLimiter`             | Observe `Retry-After` header if present                        |
| `501` | `NOT_IMPLEMENTED`   | 2FA roadmap placeholder                              | Includes planned feature metadata                              |

## Operational Checklist

- Persist only the access token on the client; rely on the HTTP-only refresh cookie when possible.
- After password resets or email verification, refresh the profile via `GET /api/v1/auth/me`.
- When receiving `TOKEN_REUSE_DETECTED` or `session_revoked` events, force logout and prompt the
  user to re-authenticate.
- Monitor retry headers (`Retry-After`) to back off on throttled flows.

Cross-reference the OpenAPI specification for exhaustive schema definitions and error object
structures.
