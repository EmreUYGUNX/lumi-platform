# Contributing Guide

This document outlines the expectations for contributing to the Lumi commerce platform. Follow every step to maintain the Phase 0 quality and security bar.

## 1. Branching Strategy

- Use short-lived feature branches named `feat/<scope>-<summary>`.
- Bug fixes use `fix/<scope>-<summary>`; chores use `chore/<scope>-<summary>`.
- Sync with `main` daily using `git pull --rebase origin main`.

## 2. Development Workflow

1. Review the onboarding checklist (`docs/guides/onboarding.md`).
2. Create a branch and implement changes with tests.
3. Run the full quality gate before pushing:
   ```bash
   pnpm lint --max-warnings 0
   pnpm typecheck
   pnpm test
   pnpm format --check
   pnpm audit:security
   pnpm security:verify
   ```
4. Stage changes with meaningful commits (Husky enforces lint-staged).
5. Push to your fork or origin branch and open a Pull Request (PR).

## 3. Commit Standards

- Conventional commit format (e.g., `feat(api): add inventory endpoints`).
- Keep commits cohesive and reviewable (< 200 LOC when possible).
- Do not bypass hooks (`--no-verify`) without approval from the Engineering Manager.

## 4. Pull Request Checklist

- [ ] PR title follows conventional commit style (converted automatically during merge).
- [ ] Linked issue or Jira ticket references appear in the description.
- [ ] Tests added or updated; include coverage rationale in the PR body.
- [ ] Documentation updates referenced (README, guides, etc.).
- [ ] Screenshots or logs attached for UI or API behaviour changes.

## 5. Code Review Expectations

- Two approvals required: one from a peer engineer and one from the owning tech lead.
- Use the [`docs/guides/code-review.md`](docs/guides/code-review.md) checklist when reviewing.
- Respond to review feedback within one business day; unresolved conversations block merges.

## 6. Security & Compliance

- Never commit secrets. Validate with `pnpm security:verify` before pushing.
- Follow the incident response process for any suspected vulnerability (`docs/guides/emergency-runbook.md`).
- Ensure new dependencies comply with the license allowlist in `package.json`.

## 7. Documentation Requirements

- Update relevant documentation with every feature or configuration change.
- Architectural updates should include ADR drafts (Phase 1 and beyond).
- Keep `docs/api/` synchronized with backend endpoints.

## 8. Release Process

- Release branches follow `release/<version>` and are cut by the Release Manager.
- Releases require sign-off from Engineering, QA, DevOps, and Product (see `PHASE-0-FOUNDATION-SETUP.md`).
- Tag releases using semantic versioning.

## 9. Support

For any questions, reach out via Slack channel `#lumi-dev` or email `dev-team@lumi.com`. Escalations follow the emergency runbook.
