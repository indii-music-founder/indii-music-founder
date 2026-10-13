/** Optional metadata must be omitted, never fabricated as a compliance pass. */
export function assetVersionDocument<T extends object>(value: T): T {
    // Asset versions contain JSON data only (no SDK sentinels or timestamps).
    // JSON serialization omits undefined object fields at every nesting level.
    return JSON.parse(JSON.stringify(value)) as T;
}
