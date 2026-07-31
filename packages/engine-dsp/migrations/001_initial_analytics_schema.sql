-- ClickHouse Schema for Indii.music Growth Intelligence

-- 1. Create the overarching Analytics Database
CREATE DATABASE IF NOT EXISTS indii_analytics;

-- 2. Create the unified Omnichannel Events Table
CREATE TABLE IF NOT EXISTS indii_analytics.omnichannel_events (
    event_id UUID DEFAULT generateUUIDv4(),
    artist_id String,
    platform LowCardinality(String), -- 'spotify', 'tiktok', 'facebook_ads'
    event_type LowCardinality(String), -- 'stream', 'ad_click', 'sale'
    event_time DateTime64(3, 'UTC'),
    revenue Decimal(18,4) DEFAULT 0.0000,
    cost Decimal(18,4) DEFAULT 0.0000,
    listen_duration_seconds UInt32 DEFAULT 0,
    campaign_id String DEFAULT '',
    ad_creative_id String DEFAULT '',
    utm_source LowCardinality(String) DEFAULT '',
    utm_medium LowCardinality(String) DEFAULT '',
    raw_metadata String 
) 
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (artist_id, event_time, platform)
TTL event_time + INTERVAL 2 YEAR;

-- 3. Create a Materialized View for Daily Ad Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS indii_analytics.daily_ad_performance_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (artist_id, date, campaign_id, ad_creative_id)
AS SELECT
    artist_id,
    toDate(event_time) AS date,
    campaign_id,
    ad_creative_id,
    sum(cost) AS total_spend,
    sum(revenue) AS total_revenue,
    countIf(event_type = 'ad_click') AS total_clicks,
    countIf(event_type = 'sale') AS total_conversions
FROM indii_analytics.omnichannel_events
WHERE platform = 'facebook_ads' OR platform = 'shopify'
GROUP BY artist_id, date, campaign_id, ad_creative_id;
