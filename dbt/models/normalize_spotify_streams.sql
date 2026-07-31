-- dbt model: normalize_spotify_streams
-- Transforms raw Airbyte Spotify streaming history into the unified omnichannel_events schema

SELECT 
    generateUUIDv4() AS event_id,
    '{{ var("artist_uid", "default_artist") }}' AS artist_id,
    'spotify' AS platform,
    'stream' AS event_type,
    toDateTime(played_at) AS event_time,
    CAST(duration_ms AS Float64) / 1000.0 AS listen_duration_seconds
FROM {{ source('airbyte_raw', 'spotify_stream_history') }}
