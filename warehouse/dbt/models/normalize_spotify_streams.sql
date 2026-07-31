{{
  config(
    materialized='incremental',
    unique_key='event_id',
    incremental_strategy='append'
  )
}}

-- Maps raw Airbyte Spotify rows onto the omnichannel event spine.
--
-- Incremental + append: play history is immutable once written, so re-running
-- the model must not re-emit rows already loaded. The high-water mark is the
-- newest event_time already in the warehouse for this artist.

SELECT
    generateUUIDv4()                    AS event_id,
    '{{ var("artist_uid") }}'           AS artist_id,
    'spotify'                           AS platform,
    'stream'                            AS event_type,
    toDateTime64(played_at, 3, 'UTC')   AS event_time,
    toUInt32(duration_ms / 1000)        AS listen_duration_seconds
FROM {{ source('airbyte_raw', 'spotify_stream_history') }}
WHERE played_at IS NOT NULL

{% if is_incremental() %}
  AND toDateTime64(played_at, 3, 'UTC') > (
      SELECT coalesce(max(event_time), toDateTime64('1970-01-01 00:00:00', 3, 'UTC'))
      FROM {{ this }}
      WHERE artist_id = '{{ var("artist_uid") }}'
  )
{% endif %}
