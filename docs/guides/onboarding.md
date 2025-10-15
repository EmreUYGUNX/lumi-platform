# Onboarding Checklist

Complete this checklist during your first day on the Lumi engineering team. Each item should be marked as done in the onboarding tracker.

## Day 0 – Access & Accounts

- [ ] Complete HR onboarding and obtain GitHub SSO access.
- [ ] Request Vault, PagerDuty, and Slack access via the IT portal.
- [ ] Enable hardware security key or WebAuthn MFA for all services.

## Day 1 – Workstation Setup

- [ ] Install Node.js 20.18+, pnpm 9+, and Docker 24+.
- [ ] Clone the repository and run through [`docs/getting-started.md`](../getting-started.md).
- [ ] Run `pnpm exec tsx tools/scripts/verify-workspace.ts --full` and attach the report to the onboarding ticket.
- [ ] Review security policies in [`docs/security.md`](../security.md).

## Day 2 – Knowledge Ramp

- [ ] Read [`docs/architecture/overview.md`](../architecture/overview.md) and [`docs/architecture/tech-stack.md`](../architecture/tech-stack.md).
- [ ] Walk through the development workflow guide (`development-workflow.md`).
- [ ] Pair with a teammate to tour the backend and frontend applications.
- [ ] Set up your IDE using the shared `.vscode` settings and recommended extensions.

## Day 3 – Practice Changes

- [ ] Create a sample branch `feat/sample-onboarding`.
- [ ] Add a dummy test in `apps/backend/__tests__/onboarding.spec.ts` and run the quality suite.
- [ ] Open a draft PR to verify CI integration and share with your mentor.
- [ ] Review the code review checklist (`code-review.md`).

## Ongoing

- [ ] Attend the security induction session within the first week.
- [ ] Subscribe to the weekly architecture office hours calendar invite.
- [ ] Bookmark critical documentation (this checklist, emergency runbook, troubleshooting guide).

When complete, ping the onboarding coordinator with a link to your tracked checklist.
