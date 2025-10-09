# Troubleshooting Guide

Use this guide to diagnose and resolve common issues encountered during local development. Each entry includes symptoms, root causes, resolution steps, and escalation paths.

## pnpm install Fails

- **Symptoms**: `ERR_PNPM_ADDING_TO_ROOT`, peer dependency warnings, or lockfile conflicts.
- **Resolution**:
  1. Remove caches: `pnpm clean && rm -rf node_modules pnpm-lock.yaml`.
  2. Re-run `pnpm install --frozen-lockfile`.
  3. If the error persists, verify registry access with `npm ping`.
- **Escalation**: Contact DevOps if credentials to private registries fail.

## Docker Services Unhealthy

- **Symptoms**: `docker compose ps` shows `unhealthy` or `exited` containers.
- **Resolution**:
  1. `pnpm docker:down` to stop services.
  2. `docker system prune -f` to clear stale resources.
  3. `pnpm docker:dev` to rebuild; watch logs with `docker compose logs -f`.
- **Escalation**: Page the on-call engineer if the issue blocks multiple developers.

## pnpm dev Crashes Immediately

- **Symptoms**: Turborepo exits with environment validation errors.
- **Resolution**:
  1. Run `pnpm exec tsx tools/scripts/doctor.ts --env` to identify missing variables.
  2. Ensure `.env` is populated using `env/.env.template`.
  3. Restart Docker dependencies and rerun `pnpm dev`.

## Lint or Type Errors After Syncing Main

- **Symptoms**: Unexpected ESLint or TypeScript failures.
- **Resolution**:
  1. `pnpm clean` followed by `pnpm install` to refresh dependencies.
  2. Read `CHANGELOG.md` (introduced in later phases) for breaking changes.
  3. Update code to satisfy new rules; never disable lint rules without approval.

## Tests Failing Intermittently

- **Symptoms**: Jest/Vitest tests pass locally but fail in CI.
- **Resolution**:
  1. Run tests with `--runInBand` to rule out race conditions.
  2. Ensure mocks are isolated and avoid shared state between tests.
  3. Confirm that timeouts and asynchronous operations await completion.

## Secretlint Findings

- **Symptoms**: Pre-commit hook blocks commit citing secret disclosures.
- **Resolution**:
  1. Remove the offending file from history using `git reset` or `git commit --amend`.
  2. Rotate the compromised secret immediately through Vault.
  3. Document the incident in the security channel (`docs/guides/emergency-runbook.md`).

## Performance Degradation

- **Symptoms**: Builds exceed 60s or `pnpm dev` hot reload slowness.
- **Resolution**:
  1. Check `turbo run` logs for cache misses.
  2. Clear caches (`pnpm clean` and remove `.turbo`).
  3. Ensure Node is running with adequate file watcher limits (Linux: increase inotify).
  4. Review optimization tips in [`docs/guides/performance.md`](docs/guides/performance.md).

## When to Escalate

If the above steps do not resolve the problem or multiple engineers report the same issue, escalate immediately via Slack `#lumi-incidents` and follow the emergency runbook.
