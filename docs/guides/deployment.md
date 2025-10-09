# Deployment Guide (Foundation)

This guide defines the baseline deployment process established in Phase 0. Full production automation will be completed in later phases; the foundation ensures readiness.

## Environments

- **Development** – Local Docker Compose stack (`pnpm docker:dev`).
- **Staging** – Managed via GitHub Actions workflow `deploy-staging.yml` (Phase 1 deliverable).
- **Production** – To be orchestrated through Terraform and ArgoCD (Phase 2+).

## Deployment Artifacts

- Backend and frontend Docker images built using the multi-stage Dockerfiles under `apps/*/Dockerfile`.
- Deployment manifests generated using `pnpm prune:deploy` for selective package shipping.

## Manual Deployment Flow (Interim)

1. Run quality gates locally and ensure main is green.
2. Build artifacts:
   ```bash
   pnpm build
   pnpm prune:deploy
   ```
3. Publish Docker images to the container registry (requires credentials):
   ```bash
   docker build -t registry.lumi.com/backend:TAG apps/backend
   docker push registry.lumi.com/backend:TAG
   ```
4. Trigger the environment-specific workflow in GitHub Actions.
5. Monitor rollout logs and metrics via Grafana dashboards.

## Rollback Procedure

- Use the previous Docker image tag (`registry.lumi.com/backend:PREV`) and redeploy via CI.
- If rollback fails, follow the emergency procedure documented in [`emergency-runbook.md`](emergency-runbook.md).

## Release Readiness Checklist

- [ ] All tests green on `main`.
- [ ] Security scans (`pnpm audit:security`, secretlint) pass.
- [ ] Documentation updates merged.
- [ ] Release notes drafted and approved by Product.
- [ ] On-call engineers briefed on deployment timeline.

## Future Automation

Phase 1 introduces staging automation and smoke tests triggered post-deploy. Phase 2 expands to full Infrastructure-as-Code, canary deployments, and automated rollbacks.
