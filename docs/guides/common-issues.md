# Common Issues & Resolutions

This quick-reference guide summarises the issues most frequently encountered during daily development. For detailed runbooks and advanced diagnostics, consult [`../troubleshooting.md`](../troubleshooting.md).

| Issue                        | Symptoms                                | Resolution                                                                                       |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| pnpm install fails           | `ERR_PNPM_*`, lockfile conflicts        | Clear caches (`pnpm clean`), remove `node_modules`, reinstall.                                   |
| Docker services unhealthy    | `docker compose ps` reports `unhealthy` | Restart via `pnpm docker:down` → `docker system prune` → `pnpm docker:dev`.                      |
| Environment validation fails | `Missing environment variable` error    | Re-run `pnpm exec tsx tools/scripts/doctor.ts --env` and update `.env`.                          |
| Lint errors after syncing    | New ESLint rules triggered              | Run `pnpm lint --max-warnings 0`, update code to satisfy rules, do not disable without approval. |
| Tests flake in CI            | Pass locally, fail in pipeline          | Re-run with `--runInBand`, ensure deterministic data and proper cleanup.                         |
| Secretlint blocks commit     | Pre-commit rejects secret               | Remove secret, rotate in Vault, document incident per security handbook.                         |

Escalate unresolved issues via Slack `#lumi-incidents`.
