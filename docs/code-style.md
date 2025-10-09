# Code Style Guide

This guide aggregates the enforced linting, formatting, and architectural conventions across the Lumi monorepo.

## General Principles

- Write explicit, typed code. `any` and implicit `any` are disallowed by the TypeScript configuration.
- Prefer composable, pure functions. Side effects should be isolated and documented.
- Maintain parity between backend and frontend DTOs by centralising them in `@lumi/types`.

## TypeScript Standards

- Enable `strict` mode (already enforced via `tsconfig.base.json`).
- Use `unknown` instead of `any` for untyped inputs and validate with Zod.
- Export types from `packages/types` when sharing domain models.

## Naming Conventions

- Files: `kebab-case` for general files (`order-service.ts`), `PascalCase` for React components.
- Directories: `kebab-case`; avoid deep nesting beyond three levels.
- Constants: `UPPER_CASE`; enums are `PascalCase`.

## React Guidelines

- Functional components only; hooks for shared logic.
- Keep components pure and memoize expensive renders using `React.memo` or `useMemo` when profiling indicates.
- Co-locate component styles with the component. Tailwind utility classes should leverage the design token system.

## Backend Guidelines

- Controllers stay thin and delegate to services in `apps/backend/src/services`.
- Validate incoming payloads with Zod schemas stored in `apps/backend/src/schemas` or `@lumi/types`.
- Use Winston loggers provided by `@lumi/shared/logging` instead of `console.log`.

## Error Handling

- Throw typed errors with contextual metadata.
- Translate errors to standard API responses using the error middleware.
- Always log errors at the point of capture; avoid swallowing exceptions silently.

## Formatting & Linting

- Prettier handles formatting; rely on the workspace plugin for sorting imports.
- ESLint rulesets extend Airbnb base, React hooks, Promise, Security, Unicorn, and SonarJS.
- Run `pnpm lint --max-warnings 0` and `pnpm format --check` before commits.

## Testing Expectations

- Co-locate unit tests in `__tests__` directories with `.spec.ts` suffix.
- Snapshot tests require explicit review. Update snapshots only when behaviour intentionally changes.
- Integration tests belong in the backend service and should use Supertest.

## Documentation of Exceptions

Any lint rule overrides or architectural deviations must be justified in the PR description and recorded in an ADR when applicable.
