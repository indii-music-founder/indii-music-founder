import { type SystemIdentity } from './proprietary-ingestion/types/common';

/**
 * DeliveryProfile
 *
 * Configures how indii (as a registered DDEX sender, PA-DPIDA-2025122604-E)
 * delivers to a specific partner. All Party IDs sourced from dpid.ddex.net.
 *
 * Mode is controlled per-environment via the DDEX_LIVE_MODE env var:
 *   - DDEX_LIVE_MODE=true  → MusicDistribution (live delivery)
 *   - DDEX_LIVE_MODE=false → TestMessage (safe for conformance testing)
 */

const isLiveMode = import.meta.env.VITE_DDEX_LIVE_MODE === 'true';

export interface AudioSpec {
    format: string[]; // e.g. ['wav', 'flac']
    sampleRateMin: number; // e.g. 44100
    bitDepthMin: number; // e.g. 16
    codec?: string[];
    lufsTarget?: number; // e.g. -14
}

export interface ArtworkSpec {
    format: string[]; // e.g. ['jpg', 'png']
    minWidth: number; // e.g. 3000
    minHeight: number;
    aspectRatio: string; // '1:1'
    colorSpace: string; // 'RGB'
}

export interface MetadataSpec {
    requiresISRC: boolean;
    requiresUPC: boolean;
    maxTitleLength: number;
}

export interface DeliveryProfile {
    id: string;
    partnerName: string;
    dpid: SystemIdentity;
    isTestMode: boolean;
    deliveryMethod: 'SFTP_Batch' | 'SFTP_Single' | 'ITMSP' | 'S3';
    ernVersion: '4.3' | '3.8.2';
    sftpHost?: string;
    sftpPort?: number;
    remotePathPrefix?: string;
    
    // Specs for DSP Compliance Coaching (WO-7)
    audioSpecs?: AudioSpec;
    artworkSpecs?: ArtworkSpec;
    metadataSpecs?: MetadataSpec;
}

// ---------------------------------------------------------------------------
// Direct Delivery Profiles (indii as the distributor)
// All DPIDs verified against dpid.ddex.net
// ---------------------------------------------------------------------------

/** Merlin Network — fastest path to all major DSPs for independent labels */
export const MERLIN_PROFILE: DeliveryProfile = {
    id: 'merlin',
    partnerName: 'Merlin Network',
    dpid: { systemIdentifier: 'PADPIDA2012110501U', entityName: 'Merlin Network' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: 'sftp.merlinnetwork.org',
    sftpPort: 22,
    remotePathPrefix: '/incoming',
    audioSpecs: {
        format: ['wav', 'flac'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 200
    }
};

/** Spotify — direct delivery when Spotify for Distributors partnership is active */
export const SPOTIFY_PROFILE: DeliveryProfile = {
    id: 'spotify',
    partnerName: 'Spotify',
    dpid: { systemIdentifier: 'PADPIDA2011112001R', entityName: 'Spotify' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_SPOTIFY_SFTP_HOST || '',
    sftpPort: 22,
    remotePathPrefix: '/upload',
    audioSpecs: {
        format: ['wav', 'flac'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
};

/** Apple Music — delivered via ITMSP bundle format through Transporter */
export const APPLE_PROFILE: DeliveryProfile = {
    id: 'apple',
    partnerName: 'Apple Music',
    dpid: { systemIdentifier: 'PADPIDA200911030', entityName: 'Apple Music' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'ITMSP',
    ernVersion: '4.3',
    sftpHost: 'transporter.apple.com',
    sftpPort: 22,
    remotePathPrefix: '/upload',
    audioSpecs: {
        format: ['wav', 'flac', 'alac'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -16
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
};

/** Amazon Music — direct content provider delivery */
export const AMAZON_PROFILE: DeliveryProfile = {
    id: 'amazon',
    partnerName: 'Amazon Music',
    dpid: { systemIdentifier: 'PADPIDA2011110101', entityName: 'Amazon Music' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_AMAZON_SFTP_HOST || '',
    sftpPort: 22,
    audioSpecs: {
        format: ['wav', 'flac'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
};

/** Tidal — direct delivery for high-fidelity releases */
export const TIDAL_PROFILE: DeliveryProfile = {
    id: 'tidal',
    partnerName: 'Tidal',
    dpid: { systemIdentifier: 'PADPIDA2014042201H', entityName: 'Tidal' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_TIDAL_SFTP_HOST || '',
    sftpPort: 22,
    audioSpecs: {
        format: ['flac', 'wav'],
        sampleRateMin: 44100,
        bitDepthMin: 16, // Tidal prefers 24-bit
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
};

/** Deezer — distributed via Merlin or direct partnership */
export const DEEZER_PROFILE: DeliveryProfile = {
    id: 'deezer',
    partnerName: 'Deezer',
    dpid: { systemIdentifier: 'PADPIDA2009060301Q', entityName: 'Deezer' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_DEEZER_SFTP_HOST || '',
    sftpPort: 22,
    audioSpecs: {
        format: ['flac', 'wav'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
};

/** YouTube Music */
export const YOUTUBE_PROFILE: DeliveryProfile = {
    id: 'youtube',
    partnerName: 'YouTube Music',
    dpid: { systemIdentifier: 'PADPIDA2011030901', entityName: 'YouTube' },
    isTestMode: !isLiveMode,
    deliveryMethod: 'SFTP_Batch',
    ernVersion: '4.3',
    sftpHost: import.meta.env.VITE_YOUTUBE_SFTP_HOST || '',
    sftpPort: 22,
    audioSpecs: {
        format: ['flac', 'wav'],
        sampleRateMin: 44100,
        bitDepthMin: 16,
        lufsTarget: -14
    },
    artworkSpecs: {
        format: ['jpg', 'png'],
        minWidth: 3000,
        minHeight: 3000,
        aspectRatio: '1:1',
        colorSpace: 'RGB'
    },
    metadataSpecs: {
        requiresISRC: true,
        requiresUPC: true,
        maxTitleLength: 255
    }
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
    youtube: YOUTUBE_PROFILE,
};

export const getDeliveryProfile = (id: string): DeliveryProfile | undefined =>
    DELIVERY_PROFILES[id];
