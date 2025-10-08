# Branch Protection Rules

To complement the CI foundation, enable the following rules on `master` and `develop`:

- Require pull requests before merging with at least one approving review.
- Dismiss stale reviews when new commits are pushed.
- Require status checks to pass with the following contexts:
  - `Lint (Node 20.11.0)`
  - `Typecheck (Node 20.11.0)`
  - `Tests (Node 20.11.0)`
  - `Tests (Node 22.x)`
  - `Build Artifacts`
  - `Dependency & Secret Scans`
  - `Docker Image Scanning`
  - `Performance Budgets`
- Require branches to be up to date before merging.
- Block force pushes and deletions on protected branches.

After applying the settings, record the configuration in the repository settings audit log for compliance.
