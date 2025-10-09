# Development Workflow

Follow this workflow for every change to maintain high velocity without compromising reliability.

## 1. Plan

- Align with your tech lead on scope and acceptance criteria.
- Create or update Jira tickets with detailed tasks and testing notes.
- Identify documentation and testing impact before writing code.

## 2. Branch

- Create a feature branch from `main` using the naming convention from [`docs/contributing.md`](../contributing.md#1-branching-strategy).
- Sync your branch daily with `git pull --rebase origin main`.

## 3. Develop

- Implement changes using TDD where applicable.
- Keep commits small and focused, ensuring tests and linters pass before committing.
- Update documentation in tandem with code changes.

## 4. Validate Locally

Run the full suite before pushing:

```bash
pnpm lint --max-warnings 0
pnpm typecheck
pnpm test
pnpm format --check
pnpm audit:security
pnpm exec secretlint "**/*"
```

Resolve all issues locally; CI should confirm, not discover, problems.

## 5. Push & Review

- Push the branch and open a PR with a clear summary and testing evidence.
- Request reviewers early, especially for cross-workstream changes.
- Respond to feedback within one business day.

## 6. Merge

- Squash or rebase commits to maintain a readable history; keep the PR title in conventional commit format.
- Do not merge if CI is red or if required approvals are missing.

## 7. Post-Merge

- Monitor CI/CD pipelines until deployment completes.
- Validate the change in the target environment.
- Update any operational dashboards, runbooks, or follow-up tasks triggered by the change.

## 8. Retrospective

- Capture lessons learned in the weekly engineering sync or the ADR log if architectural insights surface.
