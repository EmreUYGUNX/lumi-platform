# Emergency Procedures Runbook

Activate this runbook when Lumi experiences a production outage, security incident, or any event impacting customer trust.

## Severity Classification

- **SEV-1** – Full outage, data breach, or regulatory impact.
- **SEV-2** – Major functionality degraded with high customer impact.
- **SEV-3** – Minor functionality issues with workarounds.

## Activation Steps

1. **Declare** the incident in Slack `#lumi-incidents` using `/incident start`.
2. **Assign Roles**:
   - Incident Commander (IC)
   - Communications Lead
   - Scribe (timeline + actions)
   - Subject Matter Experts as required
3. **Open** a PagerDuty incident and page the on-call engineer.
4. **Document** start time, affected systems, and customer impact in the incident doc.

## Containment

- Gather logs, metrics, and alerts.
- Disable impacted features if necessary using feature flags.
- Preserve evidence for forensics; avoid resetting systems prematurely.

## Communication

- Provide updates every 15 minutes in the incident channel.
- Notify stakeholders via email (`dev-team@lumi.com`, `product@lumi.com`).
- Customer communication handled by Communications Lead following approved templates.

## Resolution

- Implement fixes, validate across environments, and monitor metrics for stability.
- Downgrade severity or close the incident once all systems are healthy and verified.

## Post-Incident Review

- Conduct a blameless retrospective within 48 hours.
- Capture root cause, contributing factors, remediation tasks, and owners.
- Update runbooks, monitoring, and alerts to prevent recurrence.

## Security Incidents

- Notify the Security Lead immediately and follow responsible disclosure policies.
- Involve Legal and Compliance teams for SEV-1 events.
- Initiate credential rotation if secrets are compromised.

## Resources

- PagerDuty On-Call Schedule: https://pagerduty.com/organizations/lumi/oncall
- Incident Template: `ops/templates/incident-report.md`
- Observability Dashboards: Grafana (staging/production), Prometheus (local).
