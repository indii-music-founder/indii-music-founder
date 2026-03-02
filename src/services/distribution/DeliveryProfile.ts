
import { DPID } from '../ddex/types/common';

/**
 * DeliveryProfile
 *
 * Configures how indiiOS (as a registered DDEX sender, PA-DPIDA-2025122604-E)
 * delivers to a specific partner. All Party IDs sourced from dpid.ddex.net.
 *
 * Mode is controlled per-environment via the DDEX_LIVE_MODE env var:
 *   - DDEX_LIVE_MODE=true  → MusicDistribution (live delivery)
 *   - DDEX_LIVE_MODE=false → TestMessage (safe for conformance testing)
 */

const isLiveMode = import.meta.env.VITE_DDEX_LIVE_MODE === 'true';

export interface DeliveryProfile {
    id: string;
    partnerName: string;
    dpid: DPID;
    isTestMode: boolean;
    deliveryMethod: 'SFTP_Batch' | 'SFTP_Single' | 'ITMSP' | 'S3';
    ernVersion: '4.3' | '3.8.2';
    sftpHost?: string;
    sftpPort?: number;
    /** Remote path prefix on the partner's SFTP server */
    remotePathPrefix?: string;
}

// ---------------------------------------------------------------------------
// Direct Delivery Profiles (indiiOS as the distributor)
// All DPIDs verified against dpid.ddex.net
// ---------------------------------------------------------------------------

/** Merlin Network — fastest path to all major DSPs for independent labels */
export const MERLIN_PROFILE: DeliveryProfile = {
    id: 'merlin',
    partnerName: 'Merlin Network',
    dpid: { partyId: 'PADPIDA2012110501U', partyName: 'Merlin Network' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: 'sftp.merlinnetwork.org',
    sftpPort: 22,
    remotePathPrefix: '/incoming',
};

/** Spotify — direct delivery when Spotify for Distributors partnership is active */
export const SPOTIFY_PROFILE: DeliveryProfile = {
    id: 'spotify',
    partnerName: 'Spotify',
    dpid: { partyId: 'PADPIDA2011112001R', partyName: 'Spotify' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    // SFTP host assigned by Spotify upon direct distributor partnership agreement
    sftpHost: import.meta.env.VITE_SPOTIFY_SFTP_HOST || '',
    sftpPort: 22,
    remotePathPrefix: '/upload',
};

/** Apple Music — delivered via ITMSP bundle format through Transporter */
export const APPLE_PROFILE: DeliveryProfile = {
    id: 'apple',
    partnerName: 'Apple Music',
    dpid: { partyId: 'PADPIDA200911030', partyName: 'Apple Music' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'ITMSP',
    ernVersion: '4.3',
    sftpHost: 'transporter.apple.com',
    sftpPort: 22,
    remotePathPrefix: '/upload',
};

/** Amazon Music — direct content provider delivery */
export const AMAZON_PROFILE: DeliveryProfile = {
    id: 'amazon',
    partnerName: 'Amazon Music',
    dpid: { partyId: 'PADPIDA2011110101', partyName: 'Amazon Music' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_AMAZON_SFTP_HOST || '',
    sftpPort: 22,
};

/** Tidal — direct delivery for high-fidelity releases */
export const TIDAL_PROFILE: DeliveryProfile = {
    id: 'tidal',
    partnerName: 'Tidal',
    dpid: { partyId: 'PADPIDA2014042201H', partyName: 'Tidal' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_TIDAL_SFTP_HOST || '',
    sftpPort: 22,
};

/** Deezer — distributed via Merlin or direct partnership */
export const DEEZER_PROFILE: DeliveryProfile = {
    id: 'deezer',
    partnerName: 'Deezer',
    dpid: { partyId: 'PADPIDA2009060301Q', partyName: 'Deezer' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_DEEZER_SFTP_HOST || '',
    sftpPort: 22,
};

// ---------------------------------------------------------------------------
// Profile registry — all direct delivery targets
// ---------------------------------------------------------------------------
export const DELIVERY_PROFILES: Record<string, DeliveryProfile> = {
    merlin: MERLIN_PROFILE,
    spotify: SPOTIFY_PROFILE,
    apple: APPLE_PROFILE,
    amazon: AMAZON_PROFILE,
    tidal: TIDAL_PROFILE,
    deezer: DEEZER_PROFILE,
};

export const getDeliveryProfile = (id: string): DeliveryProfile | undefined =>
    DELIVERY_PROFILES[id];
