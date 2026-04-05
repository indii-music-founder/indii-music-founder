/**
 * Distributor Configuration
 *
 * indiiOS operates as a registered DDEX sender (PA-DPIDA-2025122604-E / New Detroit Music LLC)
 * and delivers directly to DSPs — no aggregator middlemen.
 *
 * This file has two sections:
 *
 * 1. DIRECT_DSP_PROFILES — the primary delivery targets. indiiOS IS the distributor.
 *    Releases go directly to DSPs via DDEX SFTP, bypassing DistroKid, TuneCore, etc.
 *
 * 2. LEGACY_AGGREGATORS — read-only migration connectors for artists with existing catalogs
 *    on aggregator platforms. Used ONLY to import existing releases into indiiOS, then
 *    migrate delivery to direct channels. These are NOT active delivery targets.
 *
 * All DDEX Party IDs sourced from dpid.ddex.net.
 */

export interface DistributorProfile {
    id: string;
    name: string;
    ddexPartyId: string;
    ftpHost?: string;
    ftpPort?: number;
    requiresUPC: boolean;
    requiresISRC: boolean;
    /** Direct DSPs own the artist relationship. Aggregators are migration-only. */
    type: 'direct' | 'migration_only';
    description: string;
}

// ---------------------------------------------------------------------------
// SECTION 1: Direct DSP Delivery Targets
// indiiOS delivers here as a registered distributor
// ---------------------------------------------------------------------------

export const DIRECT_DSP_PROFILES: Record<string, DistributorProfile> = {
    merlin: {
        id: 'merlin',
        name: 'Merlin Network',
        ddexPartyId: 'PADPIDA2012110501U',
        ftpHost: 'sftp.merlinnetwork.org',
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Collective licensing body — single SFTP delivery reaches Spotify, Apple Music, Amazon, Deezer, Tidal, SoundCloud, and more.',
    },
    spotify: {
        id: 'spotify',
        name: 'Spotify',
        ddexPartyId: 'PADPIDA2011112001R',
        ftpHost: '', // Assigned by Spotify upon distributor partnership agreement
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Direct Spotify delivery via DDEX SFTP. Requires Spotify for Distributors partnership.',
    },
    apple: {
        id: 'apple',
        name: 'Apple Music',
        ddexPartyId: 'PADPIDA200911030',
        ftpHost: 'transporter.apple.com',
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Direct Apple Music delivery via ITMSP bundle format. Requires iTunes Store Provider account.',
    },
    amazon: {
        id: 'amazon',
        name: 'Amazon Music',
        ddexPartyId: 'PADPIDA2011110101',
        ftpHost: '', // Assigned by Amazon upon content provider agreement
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Direct Amazon Music delivery. Requires Amazon Music content provider agreement.',
    },
    tidal: {
        id: 'tidal',
        name: 'Tidal',
        ddexPartyId: 'PADPIDA2014042201H',
        ftpHost: '',
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Direct Tidal delivery for high-fidelity catalog. Requires Tidal partner agreement.',
    },
    deezer: {
        id: 'deezer',
        name: 'Deezer',
        ddexPartyId: 'PADPIDA2009060301Q',
        ftpHost: '',
        ftpPort: 22,
        requiresUPC: true,
        requiresISRC: true,
        type: 'direct',
        description: 'Direct Deezer delivery. Also reachable via Merlin membership.',
    },
};

// ---------------------------------------------------------------------------
// SECTION 2: Legacy Aggregator Migration Connectors
// Read-only — used to import existing catalogs, NOT for new delivery
// ---------------------------------------------------------------------------

export const LEGACY_AGGREGATORS: Record<string, DistributorProfile> = {
    distrokid: {
        id: 'distrokid',
        name: 'DistroKid (Migration Only)',
        ddexPartyId: 'PADPIDA2013021901W',
        requiresUPC: false,
        requiresISRC: false,
        type: 'migration_only',
        description: 'Import existing DistroKid releases into indiiOS. New releases go direct — no more 9% cuts or TOS changes.',
    },
    tunecore: {
        id: 'tunecore',
        name: 'TuneCore (Migration Only)',
        ddexPartyId: 'PADPIDA2009090203U',
        requiresUPC: true,
        requiresISRC: true,
        type: 'migration_only',
        description: 'Import existing TuneCore catalog into indiiOS for direct distribution.',
    },
    cdbaby: {
        id: 'cdbaby',
        name: 'CD Baby (Migration Only)',
        ddexPartyId: 'PADPIDA20061109026',
        requiresUPC: false,
        requiresISRC: false,
        type: 'migration_only',
        description: 'Import existing CD Baby releases. Reclaim your masters and move to direct DSP delivery.',
    },
    symphonic: {
        id: 'symphonic',
        name: 'Symphonic Distribution (Migration Only)',
        ddexPartyId: 'PADPIDA2011030901S',
        requiresUPC: true,
        requiresISRC: true,
        type: 'migration_only',
        description: 'Import existing Symphonic catalog. Transition to direct delivery with full royalty retention.',
    },
};

// ---------------------------------------------------------------------------
// Unified registry — both direct and migration profiles
// ---------------------------------------------------------------------------

export const DISTRIBUTORS: Record<string, DistributorProfile> = {
    ...DIRECT_DSP_PROFILES,
    ...LEGACY_AGGREGATORS,
};

export type DistributorParams = keyof typeof DISTRIBUTORS;
export type DirectDSPId = keyof typeof DIRECT_DSP_PROFILES;
export type LegacyAggregatorId = keyof typeof LEGACY_AGGREGATORS;
