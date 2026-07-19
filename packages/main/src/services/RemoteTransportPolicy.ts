const ENABLED_VALUE = 'true';

/**
 * The legacy LAN/Ngrok transport is incomplete and therefore opt-in only.
 * Mobile Remote's supported production path is the authenticated cloud relay.
 */
export function isLegacyEdgeRemoteEnabled(
    value: string | undefined = process.env['INDII_ENABLE_LEGACY_EDGE_REMOTE'],
): boolean {
    return value?.trim().toLowerCase() === ENABLED_VALUE;
}
