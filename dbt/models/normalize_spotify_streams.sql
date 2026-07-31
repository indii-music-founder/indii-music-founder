INSERT INTO indii_analytics.omnichannel_events 
(event_id, artist_id, platform, event_type, event_time, listen_duration_seconds)
SELECT 
    generateUUIDv4() as event_id,
    '{{ var("artist_uid") }}' as artist_id,
    'spotify' as platform,
    'stream' as event_type,
    toDateTime(played_at) as event_time,
    duration_ms / 1000 as listen_duration_seconds
FROM {{ source('airbyte_raw', 'spotify_stream_history') }}
