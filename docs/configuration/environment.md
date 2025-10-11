# Environment & Configuration Management

This document captures every environment variable used by the Lumi commerce platform, the loading strategy across environments, and guidance for secure distribution in CI/CD pipelines.

## Variable Directory

| Variable                                        | Description                                                                  | Example                                | Required   | Default                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`                                      | Active Node.js environment (`development`, `test`, `staging`, `production`). | `development`                          | ✅         | `development`                                                                     |
| `APP_NAME`                                      | Human-friendly application name surfaced in logs/metrics.                    | `Lumi Commerce Platform`               | ✅         | `Lumi Commerce Platform`                                                          |
| `APP_PORT`                                      | Preferred backend port (overridden when `PORT` is set).                      | `4000`                                 | ✅         | `4000`                                                                            |
| `PORT`                                          | Runtime override injected by platforms (Heroku, Render, etc.).               | `4000`                                 | ❌         | —                                                                                 |
| `API_BASE_URL`                                  | Public backend base URL.                                                     | `https://api.lumi-commerce.com`        | ✅         | —                                                                                 |
| `FRONTEND_URL`                                  | Public frontend base URL.                                                    | `https://app.lumi-commerce.com`        | ✅         | —                                                                                 |
| `DATABASE_URL`                                  | PostgreSQL connection string (including credentials).                        | `postgresql://user:pass@host:5432/app` | ✅         | —                                                                                 |
| `REDIS_URL`                                     | Redis connection string for caching/queues.                                  | `redis://user:pass@host:6379`          | ✅         | —                                                                                 |
| `STORAGE_BUCKET`                                | Object storage bucket name/prefix.                                           | `lumi-production-assets`               | ✅         | —                                                                                 |
| `LOG_LEVEL`                                     | Log granularity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).        | `info`                                 | ✅         | `info`                                                                            |
| `JWT_SECRET`                                    | Secret for signing JWT tokens (min 32 chars).                                | `super-secure-secret-32-characters!!!` | ✅         | —                                                                                 |
| `CORS_ENABLED`                                  | Enables CORS middleware.                                                     | `true`                                 | ✅         | `true`                                                                            |
| `CORS_ALLOWED_ORIGINS`                          | Comma-separated list of allowed origins (`CORS_ORIGIN` alias supported).     | `https://app.lumi.com`                 | ✅         | `http://localhost:3000`                                                           |
| `CORS_ALLOWED_METHODS`                          | Allowed HTTP methods.                                                        | `GET,POST,PUT`                         | ✅         | `GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`                                          |
| `CORS_ALLOWED_HEADERS`                          | Allowed request headers.                                                     | `Content-Type,Authorization`           | ✅         | `Content-Type,Authorization,X-Request-Id`                                         |
| `CORS_EXPOSED_HEADERS`                          | Response headers exposed to the client.                                      | `X-Request-Id`                         | ❌         | `X-Request-Id`                                                                    |
| `CORS_ALLOW_CREDENTIALS`                        | Whether to allow cookies/credentials.                                        | `true`                                 | ✅         | `true`                                                                            |
| `CORS_MAX_AGE`                                  | Max age (seconds) for preflight cache.                                       | `600`                                  | ❌         | `600`                                                                             |
| `SECURITY_HEADERS_ENABLED`                      | Toggles security header injection.                                           | `true`                                 | ✅         | `true`                                                                            |
| `SECURITY_HEADERS_CSP`                          | Content Security Policy template.                                            | `default-src 'self';`                  | ✅         | `default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';` |
| `SECURITY_HEADERS_REFERRER_POLICY`              | Referrer-Policy header value.                                                | `strict-origin-when-cross-origin`      | ✅         | `strict-origin-when-cross-origin`                                                 |
| `SECURITY_HEADERS_FRAME_GUARD`                  | X-Frame-Options directive.                                                   | `DENY`                                 | ✅         | `DENY`                                                                            |
| `SECURITY_HEADERS_PERMISSIONS_POLICY`           | Permissions-Policy directive.                                                | `camera=(),microphone=()`              | ✅         | `accelerometer=(),camera=(),geolocation=(),gyroscope=(),microphone=(),payment=()` |
| `SECURITY_HEADERS_HSTS_MAX_AGE`                 | HSTS max-age in seconds.                                                     | `63072000`                             | ✅         | `63072000`                                                                        |
| `SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS`      | Include subdomains in HSTS.                                                  | `true`                                 | ✅         | `true`                                                                            |
| `SECURITY_HEADERS_HSTS_PRELOAD`                 | Enable HSTS preload directive.                                               | `true`                                 | ❌         | `true`                                                                            |
| `SECURITY_HEADERS_EXPECT_CT_ENFORCE`            | Enforce Expect-CT failures.                                                  | `false`                                | ❌         | `false`                                                                           |
| `SECURITY_HEADERS_EXPECT_CT_MAX_AGE`            | Expect-CT max-age in seconds.                                                | `86400`                                | ❌         | `86400`                                                                           |
| `SECURITY_HEADERS_EXPECT_CT_REPORT_URI`         | Optional report URI for Expect-CT.                                           | `https://ct.example.com/report`        | ❌         | —                                                                                 |
| `SECURITY_HEADERS_CROSS_ORIGIN_EMBEDDER_POLICY` | COEP directive.                                                              | `require-corp`                         | ✅         | `require-corp`                                                                    |
| `SECURITY_HEADERS_CROSS_ORIGIN_OPENER_POLICY`   | COOP directive.                                                              | `same-origin`                          | ✅         | `same-origin`                                                                     |
| `SECURITY_HEADERS_CROSS_ORIGIN_RESOURCE_POLICY` | CORP directive.                                                              | `same-site`                            | ✅         | `same-site`                                                                       |
| `SECURITY_HEADERS_X_CONTENT_TYPE_OPTIONS`       | X-Content-Type-Options directive.                                            | `nosniff`                              | ✅         | `nosniff`                                                                         |
| `RATE_LIMIT_ENABLED`                            | Enables global rate limiter.                                                 | `true`                                 | ✅         | `true`                                                                            |
| `RATE_LIMIT_STRATEGY`                           | Limiter store backend (`memory`, `redis`).                                   | `memory`                               | ✅         | `memory`                                                                          |
| `RATE_LIMIT_POINTS`                             | Allowed requests per window.                                                 | `100`                                  | ✅         | `100`                                                                             |
| `RATE_LIMIT_DURATION`                           | Window length (seconds).                                                     | `900`                                  | ✅         | `900`                                                                             |
| `RATE_LIMIT_BLOCK_DURATION`                     | Block duration after limit exceeded (seconds).                               | `900`                                  | ❌         | `900`                                                                             |
| `RATE_LIMIT_KEY_PREFIX`                         | Key prefix for limiter storage.                                              | `lumi:rate-limit`                      | ❌         | `lumi:rate-limit`                                                                 |
| `RATE_LIMIT_REDIS_URL`                          | Redis connection string (strategy `redis`).                                  | `redis://user:pass@host:6379`          | ❌         | —                                                                                 |
| `RATE_LIMIT_AUTH_POINTS`                        | Requests per window for authentication-sensitive routes.                     | `5`                                    | ✅         | `5`                                                                               |
| `RATE_LIMIT_AUTH_DURATION`                      | Authentication window length (seconds).                                      | `900`                                  | ✅         | `900`                                                                             |
| `RATE_LIMIT_AUTH_BLOCK_DURATION`                | Authentication block duration after limit exceeded (seconds).                | `900`                                  | ❌         | `900`                                                                             |
| `VALIDATION_STRICT`                             | Enforce strict validation (reject unknown keys).                             | `true`                                 | ✅         | `true`                                                                            |
| `VALIDATION_SANITIZE`                           | Enable sanitisation of string inputs.                                        | `true`                                 | ✅         | `true`                                                                            |
| `VALIDATION_STRIP_UNKNOWN`                      | Remove unknown keys when not in strict mode.                                 | `true`                                 | ✅         | `true`                                                                            |
| `VALIDATION_MAX_BODY_KB`                        | Maximum request payload size in kilobytes.                                   | `512`                                  | ✅         | `512`                                                                             |
| `SENTRY_DSN`                                    | Optional Sentry DSN for error reporting.                                     | `https://public@sentry.io/1`           | ❌         | empty                                                                             |
| `FEATURE_FLAGS`                                 | JSON object with boolean feature toggles.                                    | `{"betaCheckout":true}`                | ❌         | `{}`                                                                              |
| `CONFIG_HOT_RELOAD`                             | Enables watching env files & reloading config in development.                | `true`                                 | ❌         | `false`                                                                           |
| `CONFIG_ENCRYPTION_KEY`                         | 32-byte key used to encrypt/decrypt CI/CD env payloads.                      | `base64:...`                           | ✅ (CI/CD) | —                                                                                 |
| `CI`                                            | Signals CI execution context.                                                | `true`                                 | ❌         | `false`                                                                           |

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
