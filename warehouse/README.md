# Growth Intelligence Warehouse

Analytical store behind the autonomous marketing agents. Firestore holds
operational state; this holds the event history the swarm reasons over.

```
Spotify / TikTok / Meta / Shopify
        │  Airbyte (airbyte/)
        ▼
  airbyte_raw.*  ──dbt (dbt/)──►  indii_analytics.omnichannel_events
                                            │
                                            ▼ materialized view
                                  daily_ad_performance_mv
                                            │
                                            ▼ marketingGetCampaignMetrics
                                  Swarm Command Center (ROAS chart)
```

## How events get in

Two paths, deliberately different:

| Source | Path | Why |
| --- | --- | --- |
| Our own observations (clicks, pre-saves, sales) | Cloud Function → Firestore outbox → batched flush | Latency-critical and must survive warehouse downtime |
| Platform volume (streams, ad spend) | Airbyte → dbt → warehouse | Bulk, scheduled, no request path involved |

The outbox exists because MergeTree creates a data part per INSERT — per-event
writes cause part explosion and eventually `TOO_MANY_PARTS`. See
`packages/firebase/src/marketing/conversionEventOutbox.ts`.

## Layout

| Path | Purpose |
| --- | --- |
| `clickhouse/migrations/` | Schema DDL, applied in filename order |
| `airbyte/` | Source/destination connector templates, one source per artist |
| `dbt/models/` | Raw → `omnichannel_events` normalization |

## Applying the schema

```bash
clickhouse-client --host "$CLICKHOUSE_HOST" --secure \
  --multiquery < clickhouse/migrations/001_initial_analytics_schema.sql
```

`daily_ad_performance_mv` is created without `POPULATE` on purpose — `POPULATE`
races with concurrent inserts and silently drops rows that land mid-build.
Backfill history explicitly after the view exists:

```sql
INSERT INTO indii_analytics.daily_ad_performance_mv
SELECT artist_id, toDate(event_time) AS date, campaign_id, ad_creative_id,
       sum(cost), sum(revenue),
       countIf(event_type = 'ad_click'), countIf(event_type = 'sale')
FROM indii_analytics.omnichannel_events
WHERE platform IN ('facebook_ads', 'shopify')
  AND event_time < '<cutover-timestamp>'
GROUP BY artist_id, date, campaign_id, ad_creative_id;
```

## Credentials

Every value in the connector templates is a `${VAR}` placeholder resolved at
apply time. **No resolved copy of these files may be committed.** Per-artist
platform tokens are read at provisioning time from
`users/{uid}/analyticsTokens/{platform}` — the docs `platformTokenExchange`
writes — and the ClickHouse credentials come from GCP Secret Manager
(`CLICKHOUSE_HOST`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`), matching
`packages/firebase/src/config/secrets.ts`.

## Querying from the app

Application reads go through `marketingGetCampaignMetrics`
(`packages/firebase/src/marketing/campaignMetricsCallable.ts`), which pins
`artist_id` to the caller's authenticated uid. The renderer never holds
warehouse credentials and never issues SQL.

## Deviation from the original handoff

The handoff filed the schema under `packages/engine-dsp/migrations/`.
`engine-dsp` is the Python audio DSP package (librosa, alignment pipelines);
warehouse DDL there would be unrelated to everything around it. Schema,
ingestion, and transforms live together here instead, next to a README that
explains the pipeline as one unit.
