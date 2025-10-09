# Tools

This directory stores operational tooling for the monorepo. Scripts here are executed via pnpm run commands or turbo tasks.

- `scripts/` – automation scripts (bootstrap, pruning, validation, log analysis, etc.)
- `config/` – centralised configuration consumed by scripts or CI pipelines.

Key scripts:

- `tools/scripts/log-query.mjs` – filters structured backend logs by level, request correlation id, or message content.
