# API Documentation

This directory hosts the API specifications, endpoint references, and integration guides for Lumi services.

## Structure

- `rest/` – REST endpoint specifications grouped by domain (OpenAPI YAML + markdown guides).
- `schemas/` – Shared request/response schemas sourced from `@lumi/types`.
- `changelog/` – Versioned change logs documenting API additions, deprecations, and removals.
- `auth-endpoints.md` – Narrative companion to the OpenAPI spec covering authentication flows, error semantics, and rate limits.

## Authoring Standards

- Maintain OpenAPI 3.1 specs for every public REST endpoint.
- Document authentication, rate limits, and RBAC requirements per endpoint.
- Include example requests/responses and error shapes.
- Update the API changelog with semantic versioning for every release.

## Tooling

- Use `pnpm exec openapi-generator-cli` (to be added in Phase 1) for client SDK generation.
- Generate the canonical spec with `pnpm docs:openapi:generate` and keep it committed.
- Validate specs using Spectral (`pnpm docs:openapi:lint`) before committing.

## Next Steps

Initial endpoint documentation will be added during Phase 1 when the backend routes are implemented. In the interim, ensure any new API design starts with an ADR and corresponding draft spec in `rest/`.
