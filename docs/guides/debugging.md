# Debugging Techniques

Use these practices to troubleshoot issues efficiently across Lumi services.

## General Principles

- Reproduce consistently before diving deep.
- Capture logs, metrics, and environment details for every report.
- Automate once resolved to prevent regression.

## Backend Debugging

- Start the backend in watch mode: `pnpm --filter @lumi/backend dev`.
- Enable verbose logging by setting `LOG_LEVEL=debug` in `.env`.
- Use the built-in request logger middleware and inspect `apps/backend/logs/*.log`.
- Attach a debugger via VS Code launch configuration (`.vscode/launch.json`).

## Frontend Debugging

- Use React Developer Tools and Next.js inspect utilities (`next inspect`).
- Enable network request logging with browser devtools.
- Capture console warnings and align them with ESLint hints.

## Testing Failures

- Run failing Jest tests with `--runInBand --watch` for quicker feedback.
- Leverage `debug` breakpoints by adding `debugger;` statements or using VS Code Test Explorer.
- For Vitest, use `vitest --inspect-brk` to attach Node inspector.

## Performance Bottlenecks

- Profile backend routes with `clinic doctor` (to be added in Phase 1).
- Use `pnpm analyze:bundle` for frontend bundle insights.
- Monitor Turborepo cache hits via `pnpm turbo:daemon:status`.

## Observability Stack

- Access Prometheus at http://localhost:9090 for metrics.
- Tail Docker logs: `docker compose logs -f <service>`.
- Use Grafana dashboards (available in later phases) for aggregated views.

## Escalation

If debugging exceeds two hours without progress, escalate via Slack `#lumi-incidents` and document steps taken so far. Reference the emergency procedures if customer impact is suspected.
