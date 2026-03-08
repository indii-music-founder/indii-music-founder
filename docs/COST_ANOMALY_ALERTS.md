# GCP Cost Anomaly Alerts — Setup Guide

> Item 302: Prevent surprise billing spikes from AI generation functions.

## Overview

GCP Budget Alerts notify stakeholders when Cloud spend crosses defined thresholds. This is critical for indiiOS because Gemini API calls (image/video generation) can spike unpredictably.

---

## Setup Steps

### 1. Create a Budget in GCP Console

```bash
# Via gcloud CLI
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="indiiOS Monthly Budget" \
  --budget-amount=500USD \
  --threshold-rules=percent=0.8,basis=CURRENT_SPEND \
  --threshold-rules=percent=1.0,basis=CURRENT_SPEND \
  --threshold-rules=percent=1.2,basis=CURRENT_SPEND \
  --notifications-rule-pubsub-topic=projects/YOUR_PROJECT/topics/budget-alerts \
  --notifications-rule-monitoring-notification-channels=YOUR_CHANNEL_ID
```

### 2. Create Pub/Sub Topic for Alerts

```bash
gcloud pubsub topics create budget-alerts --project=YOUR_PROJECT_ID
```

### 3. Create a Cloud Function to Process Alerts

```typescript
// functions/src/billing/budgetAlert.ts
import { onMessagePublished } from 'firebase-functions/v2/pubsub';

export const processBudgetAlert = onMessagePublished(
  'budget-alerts',
  async (event) => {
    const data = JSON.parse(
      Buffer.from(event.data.message.data, 'base64').toString()
    );

    const costAmount = data.costAmount;
    const budgetAmount = data.budgetAmount;
    const percentUsed = (costAmount / budgetAmount) * 100;

    console.warn(
      `[BUDGET ALERT] ${percentUsed.toFixed(1)}% of monthly budget used. ` +
      `$${costAmount.toFixed(2)} / $${budgetAmount.toFixed(2)}`
    );

    // At 100%+: Disable non-essential AI generation
    if (percentUsed >= 100) {
      // Update feature flag to throttle generation
      // await admin.firestore().doc('config/feature_flags').update({
      //   ai_image_generation: false,
      //   ai_video_generation: false,
      // });
    }

    // Send Slack/email notification
    // await sendSlackAlert(`Budget at ${percentUsed.toFixed(1)}%`);
  }
);
```

### 4. Set Up Notification Channels

| Channel | When | Purpose |
|---------|------|---------|
| Email | 80% | Early warning to finance team |
| Slack/PagerDuty | 100% | Immediate attention required |
| Auto-throttle | 120% | Feature flags disable AI generation |

### 5. Recommended Monthly Budgets

| Environment | Budget | Alert Thresholds |
|-------------|--------|------------------|
| Production | $500 | 80%, 100%, 120% |
| Staging | $50 | 80%, 100% |
| Development | $25 | 100% |

---

## Monitoring Dashboard

Add a Cloud Monitoring dashboard with these widgets:

1. **AI API Cost** — `serviceruntime.googleapis.com/api/request_count` filtered to `generativelanguage.googleapis.com`
2. **Cloud Functions Invocations** — Per-function invocation count
3. **Storage Egress** — Firebase Storage network bytes out
4. **Firestore Reads** — Document read operations per day

---

> **Important:** Review budgets monthly and adjust based on user growth. AI generation costs scale linearly with active users.
