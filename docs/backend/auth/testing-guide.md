# Authentication Testing Guide

This guide lists the automated test suites and manual checks required to keep the authentication and
RBAC stack compliant with Phase 3 quality gates.

## Automated Test Suites

| Scope             | Command                                                                                                           | Notes                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Unit tests        | `pnpm --filter @lumi/backend exec jest --runInBand src/modules/auth/__tests__/`                                   | Covers service contracts, token utilities, RBAC cache.                    |
| Integration flows | `pnpm --filter @lumi/backend exec jest --runInBand src/modules/auth/__tests__/auth.flow.integration.jest.spec.ts` | Exercises full registration → login → refresh → logout lifecycle.         |
| Security tests    | `pnpm --filter @lumi/backend exec jest --runInBand src/modules/auth/__tests__/auth.security.jest.spec.ts`         | Validates S1–S4 policies, token replay detection, session fingerprinting. |
| OpenAPI contract  | `pnpm --filter @lumi/backend test -- --runTestsByPath src/__tests__/openapi.jest.spec.ts`                         | Ensures documentation matches runtime configuration.                      |
| Coverage          | `pnpm --filter @lumi/backend test -- --coverage`                                                                  | Must remain ≥ 90 % lines/functions for auth-related modules.              |

> Use the `--runInBand` flag when running locally to avoid exhausting bcrypt worker threads.

## Performance Budgets

- Token generation / rotation < 100 ms per Phase spec (`auth.flow.integration` enforces).
- Login (single and concurrent) < 500 ms.
- RBAC permission check < 50 ms (`rbac.service` test suite validates cache paths).

Failing budgets should be treated as regressions and block merges.

## Manual Validation Checklist

- Confirm login lockout after five consecutive failures (inspect logs + metrics).
- Validate that refresh token reuse triggers session revocation and emits security events.
- Verify rate limiter headers during stress testing (`Retry-After` present).
- Ensure password reset emails render correctly with valid signed URLs.
- Confirm admin routes return `403` without `admin` role.

## Adding New Features

1. Extend DTO schemas with validation cases and add unit tests.
2. Document new endpoints in `docs/api/openapi.yaml` and `docs/api/auth-endpoints.md`.
3. Add integration coverage for happy path and failure modes.
4. Update the RBAC matrix if new permissions are introduced.
5. Run full backend test suite before pushing: `pnpm --filter @lumi/backend test`.

## CI Expectations

GitHub Actions executes the backend workflow with coverage enabled. Failures commonly stem from:

- Slow bcrypt hashing in CI (ensure `BCRYPT_SALT_ROUNDS` uses default 12 – tests override to 6).
- Missing Redis when testing RBAC caching (memory fallback automatically activates but logs a warn).
- Spectral lint failures if OpenAPI drift occurs (`pnpm docs:openapi:lint` locally before pushing).

Address any failing stage immediately to preserve the Phase 3 quality gate.
