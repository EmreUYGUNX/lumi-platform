# Git Workflow & Branching Strategy

This workflow keeps history clean and supports predictable releases.

## Branch Types

- `main` – Always deployable; protected by branch rules and required checks.
- `feature/*` – Feature and enhancement work.
- `fix/*` – Bug fixes and patches.
- `chore/*` – Maintenance, tooling, and non-functional updates.
- `release/*` – Release stabilization branches managed by Release Engineering.

## Working With Branches

1. Start from `main`:
   ```bash
   git checkout main
   git pull --rebase origin main
   git checkout -b feat/<scope>-<summary>
   ```
2. Rebase regularly to incorporate upstream changes and avoid merge commits.
3. Push branches to origin with the same name; avoid force pushes on shared branches.

## Commit Practices

- Follow Conventional Commit format (`type(scope): message`).
- Prefer small, logical commits. If necessary, use interactive rebase to tidy history before opening a PR.
- Reference ticket IDs in the commit body when appropriate.

## Pull Requests

- Open a draft PR early to garner feedback.
- Link the relevant ticket and describe testing performed.
- Apply labels (`area/backend`, `area/frontend`, `security-impact`) as needed.

## Merge Strategy

- Squash merge is the default for features.
- Rebase merge reserved for large, multi-commit histories when preserving context matters (requires approval).
- Do not use merge commits; they pollute the timeline and complicate history.

## Tagging & Releases

- Release Engineer tags commits on `main` with semantic versions (`vX.Y.Z`).
- Hotfixes branch from the latest production tag and merge back into `main` post-release.

## Handling Incidents

- For emergency fixes, coordinate via the emergency runbook and use `hotfix/*` branches with explicit incident IDs.
