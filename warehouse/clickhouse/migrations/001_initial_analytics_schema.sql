-- ============================================================================
-- ClickHouse schema for the indii Growth Intelligence warehouse
--
-- Why this exists: the marketing swarm needs to ask "what did this creative
-- cost and earn?" on every optimization pass. Answering that from Firestore
-- means a collection scan per question and a billing line that grows with the
-- swarm's tick rate. ClickHouse answers it from a columnar scan for a flat
-- infrastructure cost.
--
-- Shape: One Big Table. Every platform event — a stream, an ad click, a sale —
-- lands in `omnichannel_events` with a common spine. Per-platform quirks stay
-- in `raw_metadata` rather than forcing a join or a schema migration.
--
-- `artist_id` is the Firebase auth uid. Every query the API issues is filtered
-- on it, and it leads the ORDER BY so that filter is a primary-key prefix scan.
--
-- Apply with:
--   clickhouse-client --host <host> --multiquery < 001_initial_analytics_schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS indii_analytics;

-- ── Unified event spine ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indii_analytics.omnichannel_events
(
    event_id                UUID DEFAULT generateUUIDv4(),
    artist_id               String,
    platform                LowCardinality(String),  -- 'spotify' | 'tiktok' | 'facebook_ads' | 'shopify'
    event_type              LowCardinality(String),  -- 'stream' | 'ad_click' | 'sale'
    event_time              DateTime64(3, 'UTC'),

    -- Money is Decimal, never Float: ROAS is reported to artists and a float
    -- rounding drift shows up as a wrong number on their dashboard.
    revenue                 Decimal(18, 4) DEFAULT 0.0000,
    cost                    Decimal(18, 4) DEFAULT 0.0000,

    listen_duration_seconds UInt32 DEFAULT 0,
    campaign_id             String DEFAULT '',
    ad_creative_id          String DEFAULT '',
    utm_source              LowCardinality(String) DEFAULT '',
    utm_medium              LowCardinality(String) DEFAULT '',

    -- Untyped passthrough for platform-specific fields. Query with JSONExtract.
    raw_metadata            String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (artist_id, event_time, platform)
TTL toDateTime(event_time) + INTERVAL 2 YEAR;

-- ── Daily ad rollup ─────────────────────────────────────────────────────────
-- The dashboard's ROAS chart reads this, not the raw table: a per-artist daily
-- series is a handful of rows instead of every click ever recorded.
--
-- SummingMergeTree collapses same-key rows on merge, so the materialized view
-- can emit a partial aggregate per insert block and let the engine finish the
-- job. Reads must still wrap columns in sum()/SUM — merges are asynchronous and
-- an unmerged part would otherwise be read as a duplicate row.
--
-- Deliberately no POPULATE: it races with concurrent inserts and would silently
-- drop rows landing mid-build. Backfill explicitly after creation instead
-- (INSERT INTO ... SELECT over the historical partitions).
CREATE MATERIALIZED VIEW IF NOT EXISTS indii_analytics.daily_ad_performance_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (artist_id, date, campaign_id, ad_creative_id)
AS
SELECT
    artist_id,
    toDate(event_time)                  AS date,
    campaign_id,
    ad_creative_id,
    sum(cost)                           AS total_spend,
    sum(revenue)                        AS total_revenue,
    countIf(event_type = 'ad_click')    AS total_clicks,
    countIf(event_type = 'sale')        AS total_conversions
FROM indii_analytics.omnichannel_events
WHERE platform IN ('facebook_ads', 'shopify')
GROUP BY artist_id, date, campaign_id, ad_creative_id;
