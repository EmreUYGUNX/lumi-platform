# API Documentation

This directory hosts the API specifications, endpoint references, and integration guides for Lumi services.

## Structure

- `rest/` – REST endpoint specifications grouped by domain (OpenAPI YAML + markdown guides).
- `schemas/` – Shared request/response schemas sourced from `@lumi/types`.
- `changelog/` – Versioned change logs documenting API additions, deprecations, and removals.
- `auth-endpoints.md` – Narrative companion to the OpenAPI spec covering authentication flows, error semantics, and rate limits.
- `packages/shared/src/api-schemas/openapi.yaml` – Canonical OpenAPI 3.1 spec merged into the backend Swagger pipeline.

## Authoring Standards

- Maintain OpenAPI 3.1 specs for every public REST endpoint.
- Document authentication, rate limits, and RBAC requirements per endpoint.
- Include example requests/responses and error shapes.
- Update the API changelog with semantic versioning for every release.

## Tooling

- Use `pnpm exec openapi-generator-cli` (to be added in Phase 1) for client SDK generation.
- Generate the canonical spec with `pnpm docs:openapi:generate` and keep it committed.
- Validate specs using Spectral (`pnpm docs:openapi:lint`) before committing.

## Versioning & Compatibility

- The stable surface lives under `/api/v1/*`. A legacy `/api/*` alias maps to the same handlers but responds with `X-API-Version: v0` plus `Deprecation`/`Sunset` headers. The alias will be removed after a six-month sunset period.
- Every response includes `X-API-Version` so API clients (mobile apps, partners) can log or branch logic per version without inspecting URLs.
- Backwards-compatible changes (fields added, new endpoints) ship within the active major version. Breaking changes require a new `/api/v{n}` prefix plus an API changelog entry and migration guide.
- Deprecations follow a three-step policy: announce in the changelog, emit warning headers for the affected routes, and remove the surface only after the documented sunset date.

## Next Steps

Initial endpoint documentation will be added during Phase 1 when the backend routes are implemented. In the interim, ensure any new API design starts with an ADR and corresponding draft spec in `rest/`.
