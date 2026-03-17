# Item 390: BigQuery Revenue Funnel Dashboard

This document defines the BigQuery views and Looker Studio configuration for the
indiiOS revenue funnel analytics dashboard.

## BigQuery Views

The following views should be created in the `analytics` dataset in the Firebase-linked
BigQuery project (`VITE_FIREBASE_PROJECT_ID`).

### 1. Revenue Funnel View

```sql
-- Create view: analytics.revenue_funnel_daily
CREATE OR REPLACE VIEW `{PROJECT_ID}.analytics.revenue_funnel_daily` AS
WITH events AS (
  SELECT
    DATE(TIMESTAMP_MICROS(event_timestamp)) AS event_date,
    user_pseudo_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plan') AS plan,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'currency') AS currency,
    (SELECT value.int_value    FROM UNNEST(event_params) WHERE key = 'value') AS revenue_cents
  FROM `{PROJECT_ID}.analytics_{ANALYTICS_ID}.events_*`
  WHERE event_name IN (
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'trial_started',
    'trial_converted',
    'purchase'
  )
)
SELECT
  event_date,
  event_name,
  plan,
  COUNT(DISTINCT user_pseudo_id) AS unique_users,
  COUNT(*)                        AS event_count,
  SUM(revenue_cents) / 100.0      AS revenue_usd
FROM events
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;
```

### 2. Plan Cohort View

```sql
-- Create view: analytics.plan_cohorts
CREATE OR REPLACE VIEW `{PROJECT_ID}.analytics.plan_cohorts` AS
SELECT
  DATE_TRUNC(first_event_date, MONTH) AS cohort_month,
  first_plan,
  COUNT(DISTINCT user_pseudo_id)       AS cohort_size,
  COUNTIF(converted_to_pro)            AS converted_to_pro,
  COUNTIF(converted_to_label)          AS converted_to_label,
  ROUND(SAFE_DIVIDE(COUNTIF(converted_to_pro), COUNT(DISTINCT user_pseudo_id)) * 100, 2) AS pro_conversion_pct
FROM (
  SELECT
    user_pseudo_id,
    MIN(DATE(TIMESTAMP_MICROS(event_timestamp))) AS first_event_date,
    MIN((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plan')) AS first_plan,
    LOGICAL_OR((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plan') = 'pro') AS converted_to_pro,
    LOGICAL_OR((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'plan') = 'label') AS converted_to_label
  FROM `{PROJECT_ID}.analytics_{ANALYTICS_ID}.events_*`
  WHERE event_name = 'subscription_started'
  GROUP BY user_pseudo_id
)
GROUP BY 1, 2;
```

### 3. Agent Usage & Revenue View

```sql
-- Create view: analytics.agent_revenue_correlation
CREATE OR REPLACE VIEW `{PROJECT_ID}.analytics.agent_revenue_correlation` AS
SELECT
  DATE(TIMESTAMP_MICROS(event_timestamp)) AS event_date,
  user_pseudo_id,
  COUNTIF(event_name = 'agent_task_completed') AS agent_tasks,
  COUNTIF(event_name = 'release_submitted')     AS releases_submitted,
  SUM(CASE WHEN event_name = 'purchase'
    THEN (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') / 100.0
    ELSE 0 END)                                 AS revenue_usd
FROM `{PROJECT_ID}.analytics_{ANALYTICS_ID}.events_*`
GROUP BY 1, 2;
```

## Looker Studio Report Configuration

### Data Sources
1. `revenue_funnel_daily` — Revenue Funnel Overview page
2. `plan_cohorts` — Cohort Analysis page
3. `agent_revenue_correlation` — Agent ROI page

### Report Pages

**Page 1: Revenue Funnel (free → trial → pro → label)**
- Funnel chart: steps = [free_signup, trial_started, trial_converted, subscription_started]
- Time series: daily revenue by plan tier
- Scorecard tiles: MRR, ARR, Active Pro subscribers, Active Label subscribers

**Page 2: Cohort Retention**
- Cohort table: cohort_month × retention_week (0–12)
- Line chart: plan_conversion_pct over cohort months

**Page 3: Agent ROI**
- Scatter plot: agent_tasks vs revenue_usd per user
- Bar chart: releases_submitted by plan tier

### Setup Steps
1. In BigQuery, run the three `CREATE OR REPLACE VIEW` statements above
   (replace `{PROJECT_ID}` and `{ANALYTICS_ID}` with actual values)
2. Open [Looker Studio](https://lookerstudio.google.com) → Create → Report
3. Add data source → BigQuery → select `{PROJECT_ID}.analytics`
4. Import this report structure or build manually using the views above
5. Share the report with `analytics@indiios.com` with Viewer access

## Firebase Analytics Events to Instrument

Ensure these events are fired from the app:

| Event | Properties | Location |
|-------|-----------|----------|
| `subscription_started` | `plan`, `currency`, `value` | Stripe webhook CF |
| `trial_started` | `plan` | Subscription CF |
| `trial_converted` | `plan`, `value` | Stripe webhook CF |
| `subscription_cancelled` | `plan`, `reason` | Stripe webhook CF |
| `agent_task_completed` | `agent_id`, `duration_ms` | AgentExecutor |
| `release_submitted` | `distributor`, `track_count` | DistributionService |

These events are already fired by `functions/src/analytics/` Cloud Functions.
