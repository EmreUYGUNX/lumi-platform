# Lumi Monitoring Stack

This directory contains the Prometheus configuration, Grafana dashboards, and alert
definitions used to observe the Lumi backend service.

## Prometheus Scrape Credentials

Prometheus now authenticates to the backend metrics endpoint with HTTP Basic auth.
Update the deployment secrets so they match the values exposed to the server:

```bash
kubectl create secret generic lumi-metrics-basic-auth \
  --namespace=lumi-platform \
  --from-literal=username="${METRICS_BASIC_AUTH_USERNAME:-metrics}" \
  --from-literal=password="${METRICS_BASIC_AUTH_PASSWORD:-change-me}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Then reference the secret in your Prometheus values (Helm or plain manifests):

```yaml
scrape_configs:
  - job_name: backend
    metrics_path: /internal/metrics
    basic_auth:
      username: ${METRICS_BASIC_AUTH_USERNAME}
      password: ${METRICS_BASIC_AUTH_PASSWORD}
```

> For production, source the credentials from your secret store (Vault, SSM, etc.)
> instead of hardcoding them in manifests.

## Grafana Dashboard

Import the dashboard shipped with the repo:

1. Open Grafana → Dashboards → Import.
2. Upload `ops/monitoring/dashboards/backend-overview.json`.
3. Select your Prometheus data source and click **Import**.

The dashboard expects metrics with the `lumi_` prefix emitted by the backend.

## Alert Rules

Prometheus alert rules live in `alerts/backend-rules.yml`. Apply them alongside the
scrape configuration and wire to Alertmanager. See inline comments for thresholds.

```bash
kubectl apply -f ops/monitoring/alerts/backend-rules.yml
```

Remember to align Alertmanager receivers with the on-call rotation (PagerDuty, Slack, etc.).
