# Environment & Configuration Management

This document captures every environment variable used by the Lumi commerce platform, the loading strategy across environments, and guidance for secure distribution in CI/CD pipelines.

## Variable Directory

| Variable                | Description                                                                  | Example                                | Required   | Default                  |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ---------- | ------------------------ |
| `NODE_ENV`              | Active Node.js environment (`development`, `test`, `staging`, `production`). | `development`                          | ✅         | `development`            |
| `APP_NAME`              | Human-friendly application name surfaced in logs/metrics.                    | `Lumi Commerce Platform`               | ✅         | `Lumi Commerce Platform` |
| `APP_PORT`              | Port used by the backend HTTP server.                                        | `4000`                                 | ✅         | `4000`                   |
| `API_BASE_URL`          | Public backend base URL.                                                     | `https://api.lumi-commerce.com`        | ✅         | —                        |
| `FRONTEND_URL`          | Public frontend base URL.                                                    | `https://app.lumi-commerce.com`        | ✅         | —                        |
| `DATABASE_URL`          | PostgreSQL connection string (including credentials).                        | `postgresql://user:pass@host:5432/app` | ✅         | —                        |
| `REDIS_URL`             | Redis connection string for caching/queues.                                  | `redis://user:pass@host:6379`          | ✅         | —                        |
| `STORAGE_BUCKET`        | Object storage bucket name/prefix.                                           | `lumi-production-assets`               | ✅         | —                        |
| `LOG_LEVEL`             | Log granularity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).        | `info`                                 | ✅         | `info`                   |
| `JWT_SECRET`            | Secret for signing JWT tokens (min 16 chars).                                | `super-secret-key`                     | ✅         | —                        |
| `SENTRY_DSN`            | Optional Sentry DSN for error reporting.                                     | `https://public@sentry.io/1`           | ❌         | empty                    |
| `FEATURE_FLAGS`         | JSON object with boolean feature toggles.                                    | `{"betaCheckout":true}`                | ❌         | `{}`                     |
| `CONFIG_HOT_RELOAD`     | Enables watching env files & reloading config in development.                | `true`                                 | ❌         | `false`                  |
| `CONFIG_ENCRYPTION_KEY` | 32-byte key used to encrypt/decrypt CI/CD env payloads.                      | `base64:...`                           | ✅ (CI/CD) | —                        |
| `CI`                    | Signals CI execution context.                                                | `true`                                 | ❌         | `false`                  |

> **Important:** Values in tracked templates are placeholders. Never commit real secrets. Use encrypted payloads or secret managers for production credentials.

## File Layout

The repository ships environment templates to cover all execution targets:

- `.env.template` – baseline for local development
- `.env.example` – dummy values for documentation/onboarding
- `.env.test` – deterministic values for automated tests
- `.env.production.template` – production blueprint with placeholders

## Loading Priority

The backend configuration loader processes files in the following order (later files override earlier values):

1. `.env`
2. `.env.local`
3. `.env.<NODE_ENV>`
4. `.env.<NODE_ENV>.local`
5. `.env.<NODE_ENV>.secrets`
6. Environment variables provided by the host/CI

This mirrors the “production parity” principle: developers can layer machine-specific overrides while CI/CD injects secrets through the environment.

## Encryption Workflow for CI/CD

To ship encrypted environment bundles alongside pipelines, use `tools/scripts/env-seal.mjs`. The script supports both encryption and decryption using AES-256-GCM with a shared `CONFIG_ENCRYPTION_KEY`.

```bash
# Encrypt
pnpm env:seal encrypt .env.production.template .env.production.enc

# Decrypt (e.g., inside CI job)
CONFIG_ENCRYPTION_KEY=base64:... pnpm env:seal decrypt .env.production.enc .env.production
```

Keep `CONFIG_ENCRYPTION_KEY` in a secure secret manager. The resulting `.env.production.enc` file can be committed to the repository or stored in artifact storage without exposing plaintext secrets.

## Feature Flags

`FEATURE_FLAGS` is parsed from JSON and exposed via the configuration service. Flags can be toggled dynamically in development because hot reload revalidates the configuration when environment files change.

Recommended naming convention:

- Prefix with domain (`checkout.betaCheckout`)
- Use `camelCase` for flag keys
- Provide documentation in `docs/configuration/feature-flags.md` (future phase)

## Testing Utilities

The backend exports helpers (`apps/backend/src/config/testing.ts`) to stub environment values within Vitest suites. Always reset the configuration after each test to avoid cross-test contamination.

---

For questions or proposals, reach out in `#lumi-platform-foundation`.
