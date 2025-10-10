# Tools

This directory stores operational tooling for the monorepo. Scripts here are executed via pnpm run commands or turbo tasks.

- `scripts/` – automation scripts (bootstrap, pruning, validation, log analysis, etc.)
- `config/` – centralised configuration consumed by scripts or CI pipelines.
- `templates/` – code generation blueprints consumed by the `pnpm run codegen` utility.

## Key scripts

| Script                                 | Command                                           | Purpose                                                                                                            |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `tools/scripts/doctor.ts`              | `pnpm doctor`                                     | Validates local tooling (Node, pnpm, Docker, env templates) before development.                                    |
| `tools/scripts/setup.ts`               | `pnpm setup`                                      | Bootstrap workflow: runs doctor, copies env templates, installs dependencies, and can trigger verification checks. |
| `tools/scripts/clean.ts`               | `pnpm clean:workspace`                            | Removes caches, build artifacts, and optionally node_modules/pnpm store for a fresh workspace.                     |
| `tools/scripts/verify-workspace.ts`    | `pnpm verify:workspace`                           | Aggregated quality gate (format, lint, typecheck, tests, security scans, metrics).                                 |
| `tools/scripts/database-setup.ts`      | `pnpm db:setup`                                   | Controls Docker services for local Postgres/Redis stacks with optional seeding.                                    |
| `tools/scripts/codegen.ts`             | `pnpm codegen -- --type <template> --name <Name>` | Generates typed scaffolds (React components, Express routes) from curated templates.                               |
| `tools/scripts/deps-update.ts`         | `pnpm deps:update`                                | Opinionated dependency update workflow with optional reports and audits.                                           |
| `tools/scripts/backup.ts`              | `pnpm backup:create`                              | Creates timestamped backups of critical configuration and env files.                                               |
| `tools/scripts/restore.ts`             | `pnpm backup:restore -- --latest`                 | Restores backups (with dry-run support) back into the workspace.                                                   |
| `tools/scripts/deploy-prepare.ts`      | `pnpm deploy:prepare`                             | Runs Turbo prune and stages deployment artefacts alongside manifest metadata.                                      |
| `tools/scripts/performance-profile.ts` | `pnpm profile:performance`                        | Captures Turbo profiling traces for build/development tasks.                                                       |
| `tools/scripts/build-metrics.mjs`      | `pnpm run metrics:build`                          | Captures build duration stats from Turbo runs.                                                                     |
| `tools/scripts/dev-metrics.mjs`        | `pnpm run metrics:dev`                            | Extracts task graph statistics for developer workflows.                                                            |
| `tools/scripts/log-query.mjs`          | `pnpm run logs:query`                             | Filters structured backend logs by level, request correlation id, or message content.                              |

The automation catalogue is designed to scale with future phases—extend templates or scripts as additional services land in the monorepo.
