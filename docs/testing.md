# Testing Strategy

This guide outlines the testing layers, tooling, and execution commands mandated by Phase 0.

## Testing Pyramid

- **Unit Tests** – Fast, isolated tests covering functions and components.
- **Integration Tests** – Verify interactions between modules (e.g., Express routes + services).
- **End-to-End Tests** – Planned for later phases; current scope focuses on service-level validation.

## Tooling Matrix

| Surface         | Framework                      | Location                  |
| --------------- | ------------------------------ | ------------------------- |
| Backend         | Jest + Supertest               | `apps/backend/__tests__`  |
| Backend         | Vitest (lightweight utilities) | `apps/backend/__tests__`  |
| Frontend        | Jest + Testing Library         | `apps/frontend/__tests__` |
| Shared Packages | Vitest                         | `packages/*/__tests__`    |

## Commands

Run tests at the workspace root unless stated otherwise.

```bash
pnpm test              # Executes all registered test pipelines
pnpm test:coverage     # Collects coverage metrics
pnpm --filter @lumi/backend test
pnpm --filter @lumi/frontend test
```

## Quality Gates

- Minimum coverage thresholds are tracked per package (see individual `jest.config.cjs`).
- Tests must be deterministic; avoid reliance on network or real-time services.
- Snapshot updates require reviewer approval and should be referenced in the PR description.

## Writing Tests

- Place tests alongside source files in `__tests__` folders using `.spec.ts(x)` suffixes.
- Use dependency injection or test doubles for external integrations.
- For backend API tests, use Supertest against the in-memory Express server.
- Leverage `@faker-js/faker` for data generation and to avoid brittle assumptions.

## CI Integration

- CI runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` on every push.
- Failing tests block merges; do not use `--force` merges.
- Coverage artifacts are stored under the `coverage/` directory for inspection.

## Debugging Failures

Refer to [`docs/guides/debugging.md`](docs/guides/debugging.md) for techniques and recommended tooling when diagnosing test failures.
