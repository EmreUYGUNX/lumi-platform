# Auth Release Checklist

## Pre-release

- ✅ Unit, integration, and E2E tests green.
- ✅ Coverage ≥85%.
- ✅ Lighthouse ≥90 (Performance/Accessibility/Best Practices).
- ✅ Accessibility audit clean (axe).
- ✅ Security audit clean (no secrets, CSRF/guard checks).
- ✅ Feature flags configured with rollout plan.

## Deployment

- ✅ Apply DB migrations if required.
- ✅ Update environment variables/secrets.
- ✅ Purge CDN caches where auth UI is cached.
- ✅ Verify monitoring dashboards (login success, refresh, latency) before traffic.

## Post-release

- ✅ Run smoke tests (login/register/reset/verify).
- ✅ Monitor error/latency rates for 1 hour.
- ✅ Monitor suspicious login alerts and refresh failures.
- ✅ Stakeholder sign-off after stable metrics.
