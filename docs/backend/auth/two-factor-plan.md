# Two-Factor Authentication (2FA) Implementation Plan

Two-factor support is scheduled for a follow-up phase. The endpoints exist today to communicate
roadmap status (`501 NOT_IMPLEMENTED`). This document tracks the workstreams required to reach GA.

## Phase Breakdown

1. **Preparation (current phase)**
   - Database columns `twoFactorSecret`, `twoFactorEnabled` added to `User`.
   - Placeholder endpoints:
     - `POST /api/v1/auth/2fa/setup`
     - `POST /api/v1/auth/2fa/verify`
   - Security documentation updated to signal forthcoming changes.
2. **Phase 4 Target**
   - Generate TOTP secrets via `otplib`.
   - Deliver QR codes & backup codes via email service.
   - Store secrets encrypted at rest using KMS-managed key.
   - Extend `AuthService.login` to enforce 2FA when enabled.
3. **Phase 5 Hardening**
   - Device management (trusted devices, remember for X days).
   - Recovery flows (backup codes, email fallback).
   - Administrative override capabilities.

## Technical Considerations

- **Secret storage** – Encrypt with AES-256-GCM, key sourced from `CONFIG_ENCRYPTION_KEY`.
- **Verification** – Use constant-time comparison to prevent timing attacks.
- **Rate limiting** – Separate limiter (`auth:2fa`) with lower thresholds to prevent brute-force.
- **Telemetry** – Log all enrolment, verification, and disable events with severity `warning`.
- **UI** – Provide step-by-step onboarding and QR code scanning for mobile authenticator apps.

## API Contract (Future)

| Endpoint                       | Status  | Notes                                                                    |
| ------------------------------ | ------- | ------------------------------------------------------------------------ |
| `POST /api/v1/auth/2fa/setup`  | Planned | Returns QR code data URI + backup codes. Requires password confirmation. |
| `POST /api/v1/auth/2fa/verify` | Planned | Verifies OTP during enrolment and login challenges.                      |
| `DELETE /api/v1/auth/2fa`      | Planned | Disable 2FA after verifying OTP + password.                              |

## Dependencies

- Secure secret storage library (Phase 4 encryption work).
- Frontend UX for enrolment/challenge flows.
- Customer support tooling to handle recovery.

## Risks & Mitigations

| Risk           | Impact                  | Mitigation                                              |
| -------------- | ----------------------- | ------------------------------------------------------- |
| Lost device    | User lockout            | Provide backup codes + support runbook.                 |
| Server skew    | OTP validation failures | Enforce NTP synchronisation (≤ 30 s drift).             |
| Secret leakage | Account compromise      | Encrypt secrets, rotate on demand, monitor access logs. |

## Action Items

- [ ] Define detailed API contract and DTO schema.
- [ ] Implement encryption helper module.
- [ ] Build enrolment UI in frontend project.
- [ ] Update incident runbook for 2FA failures.

Until these items are delivered, clients should rely on the placeholder response to hide 2FA UI or
display messaging about upcoming availability.
