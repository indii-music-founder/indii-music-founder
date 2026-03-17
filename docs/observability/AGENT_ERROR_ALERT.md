# Item 392: Agent Error Rate Alert — Cloud Monitoring Configuration

This document defines the Cloud Monitoring alert policy for high agent task
failure rates in indiiOS production.

## Alert Policy: High Agent Error Rate

**Trigger condition:** Agent task failures exceed 10% of requests in a 5-minute window.

### Cloud Monitoring Alert Policy (JSON)

Deploy this policy via `gcloud` CLI or the Cloud Console:

```json
{
  "displayName": "indiiOS: High Agent Error Rate",
  "documentation": {
    "content": "Agent task failure rate exceeded 10% in a 5-minute window. Check agent logs at https://console.cloud.google.com/logs and the `.agent/skills/error_memory/ERROR_LEDGER.md` for known patterns.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Agent error rate > 10% for 5 minutes",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"logging.googleapis.com/user/agent_task_failure_rate\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "crossSeriesReducer": "REDUCE_MEAN",
            "perSeriesAligner": "ALIGN_RATE"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.10,
        "duration": "0s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "alertStrategy": {
    "notificationRateLimit": {
      "period": "1800s"
    },
    "autoClose": "604800s"
  },
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": [
    "projects/{PROJECT_ID}/notificationChannels/{SLACK_CHANNEL_ID}"
  ]
}
```

### Deploy Command

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/agent_error_alert_policy.json \
  --project={PROJECT_ID}
```

## Custom Log-Based Metric

Agent task failures are logged as structured JSON by `AgentExecutor.ts`:

```typescript
// Fires when an agent task fails (already in AgentExecutor.ts)
logger.error({
  message: 'Agent task failed',
  traceId,
  agentId: agent?.id,
  errorCode: 'AGENT_TASK_FAILURE',
  userId,
});
```

Create a log-based metric in Cloud Monitoring to count these:

```bash
gcloud logging metrics create agent_task_failure_rate \
  --description="Agent task failure rate for indiiOS" \
  --log-filter='resource.type="cloud_run_revision"
    jsonPayload.errorCode="AGENT_TASK_FAILURE"' \
  --project={PROJECT_ID}
```

## Notification Channel: Slack

Set up a Slack notification channel in the GCP Console:

1. Go to **Monitoring** → **Alerting** → **Edit notification channels**
2. Add **Slack** → authenticate with `#incidents` channel
3. Copy the channel ID and replace `{SLACK_CHANNEL_ID}` in the policy JSON above

## Notification Channel: PagerDuty (Optional)

For on-call escalation:

1. Go to **Monitoring** → **Edit notification channels** → **PagerDuty**
2. Enter your PagerDuty integration key from the `indiiOS` service
3. Add the PagerDuty channel ID to `notificationChannels` in the policy

## Runbook

When this alert fires:

1. Check recent agent logs: `gcloud logging read 'jsonPayload.errorCode="AGENT_TASK_FAILURE"' --limit=50 --project={PROJECT_ID}`
2. Cross-reference with `.agent/skills/error_memory/ERROR_LEDGER.md`
3. Check Agent Zero sidecar health: `curl http://localhost:50080/health`
4. If sidecar is down, restart: `docker-compose restart agent0`
5. If Gemini API errors: check quota at `https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas`
