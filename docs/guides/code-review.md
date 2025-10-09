# Code Review Guidelines

These guidelines help reviewers deliver consistent, actionable feedback while safeguarding quality.

## Review Principles

- **Empathy**: Critique the code, not the author. Provide constructive alternatives.
- **Holistic View**: Understand the feature context before commenting.
- **Security First**: Prioritise security and data protection concerns.

## Reviewer Checklist

- [ ] Scope matches the linked ticket(s) and does not include unrelated changes.
- [ ] Tests cover new functionality and edge cases.
- [ ] Lint, typecheck, and security commands are referenced in the PR description.
- [ ] API or schema changes update `docs/api/` and consumer packages.
- [ ] Secrets, credentials, or sensitive data are absent.
- [ ] Error handling covers failure scenarios with actionable messages.
- [ ] Logging and metrics follow established patterns.
- [ ] Documentation updates accompany behaviour changes.

## Commenting Best Practices

- Highlight severity (blocking vs. suggestion).
- Offer code snippets or references supporting your feedback.
- Acknowledge resolved comments and verify updates before approval.

## Approvals & Merges

- Require two approvals (peer + tech lead).
- Do not approve your own PRs or merge without CI passing.
- Use GitHub's `Re-request review` feature after significant changes.

## Escalation

If a PR reveals architectural concerns or security risks, escalate immediately to the engineering manager and halt merging until addressed.
