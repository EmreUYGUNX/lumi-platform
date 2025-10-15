# Getting Started Guide

This guide walks a new Lumi engineer from a clean machine to a fully validated local workspace in under one hour. Follow every step in sequence; each section lists validation checks to keep Phase 0 quality gates intact.

## 1. Prerequisites

- Node.js 20.18.1 or higher (use `asdf`, `nvm`, or Volta to lock versions).
- pnpm 9.0.0 or higher (`corepack enable pnpm` is recommended).
- Docker Desktop (macOS/Windows) or Docker Engine 24+ (Linux).
- Git with LFS extension enabled.
- Access to the sealed secret management store (HashiCorp Vault enterprise cluster).

### Verify tooling

```bash
node -v
pnpm -v
docker --version
```

> Expected: Versions match or exceed the requirements above.

## 2. Repository Setup

1. Clone the monorepo and configure Git remotes:
   ```bash
   git clone git@github.com:lumi-commerce/lumi-ticaret.git
   cd lumi-ticaret
   git remote set-url origin git@github.com:lumi-commerce/lumi-ticaret.git
   ```
2. Install workspace dependencies:

   ```bash
   pnpm install
   ```

   - The install must complete without warnings or peer dependency prompts.
   - pnpm automatically generates `pnpm-lock.yaml`; never edit this file manually.

## 3. Environment Configuration

1. Copy the environment template and populate secrets:
   ```bash
   cp env/.env.template env/.env
   pnpm env:seal         # optional: encrypt secrets for secure storage
   ```
2. Retrieve encrypted secrets using the Vault integration documented in [`docs/security.md`](docs/security.md#secret-operations).
3. Run the environment doctor to validate required keys:
   ```bash
   pnpm exec tsx tools/scripts/doctor.ts --env
   ```
   > Expected: No missing variables and zero validation errors.

## 4. Bootstrapping Services

1. Launch supporting services (databases, queues, observability stack):

   ```bash
   pnpm docker:dev
   ```

   - Wait until `docker compose ps` reports all containers as `healthy`.

2. Start the development processes:

   ```bash
   pnpm dev
   ```

   - Turborepo orchestrates individual `dev` pipelines for each workspace.

3. Validate endpoints:
   - Frontend storefront → http://localhost:3000
   - Backend health probe → http://localhost:4000/health
   - Metrics endpoint (Prometheus) → http://localhost:9090/targets

## 5. Quality Gates

With the stack running, execute the quality suite to ensure local parity with CI.

```bash
pnpm lint --max-warnings 0
pnpm typecheck
pnpm test
pnpm format --check
pnpm audit:security
pnpm security:verify
```

All commands must complete without errors. Address findings before writing code.

## 6. Workspace Validation Script

Run the automated validation pipeline whenever onboarding a new developer workstation:

```bash
pnpm exec tsx tools/scripts/verify-workspace.ts --full
```

The script verifies cache health, environment parity, Docker status, and npm registry lock-downs.

## 7. Next Steps

- Read the architectural context in [`docs/architecture/overview.md`](docs/architecture/overview.md).
- Follow the onboarding checklist in [`docs/guides/onboarding.md`](docs/guides/onboarding.md) to complete mandatory orientation tasks.
- Review the code style and contribution guidelines before opening a pull request:
  - [`docs/code-style.md`](docs/code-style.md)
  - [`docs/contributing.md`](docs/contributing.md)

## 8. Getting Help

If any step fails:

- Consult the troubleshooting matrix: [`docs/troubleshooting.md`](docs/troubleshooting.md).
- Ask for assistance in Slack `#lumi-incidents` with logs and command output.
- For access or security issues, escalate through the emergency runbook at [`docs/guides/emergency-runbook.md`](docs/guides/emergency-runbook.md).
