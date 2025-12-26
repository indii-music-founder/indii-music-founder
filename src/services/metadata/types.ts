/**
 * Music Metadata Types
 * Core metadata schema for music tracks with DDEX extension support
 */

import { DDEX_CONFIG } from '@/core/config/ddex';

export interface RoyaltySplit {
    legalName: string;
    role: 'songwriter' | 'producer' | 'performer' | 'other';
    percentage: number; // 0-100
    email: string; // For rapid payment
}

export interface GoldenMetadata {
    // 1. Core Identity
    trackTitle: string;
    artistName: string;
    isrc: string; // International Standard Recording Code
    iswc?: string; // International Standard Musical Work Code (Optional but recommended)
    explicit: boolean;
    genre: string;
    labelName: string;
    dpid?: string; // DDEX Party ID

    // 2. The Economics
    splits: RoyaltySplit[];

    // 3. Rights Administration
    pro: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'None';
    publisher: string;

    // 4. Content Content & Clearance
    containsSamples: boolean;
    masterFingerprint?: string; // The "Sonic ID" of the track itself
    samples?: {
        fingerprint?: string; // Unique ID of the sample file
        sourceName: string; // e.g. "Splice: Funky Drum Loop 001"
        cleared: boolean;
        licenseFile?: string; // Path or URL to license PDF
        clearanceDetails?: {
            licenseType: string;
            termsSummary: string;
            platformId?: string;
        };
    }[];

    // 5. Verification
    isGolden: boolean; // Computed flag: true only if schema is valid and splits sum to 100%
}

/**
 * Extended GoldenMetadata with DDEX-specific fields
 * For distribution and rights management
 */
export interface ExtendedGoldenMetadata extends GoldenMetadata {
    // Internal Identifier
    id?: string;

    // Release Information
    releaseType: 'Single' | 'EP' | 'Album' | 'Compilation';
    releaseDate: string; // ISO 8601 date
    preOrderDate?: string;
    originalReleaseDate?: string;

    // Distribution
    territories: string[]; // ISO 3166-1 codes or 'Worldwide'
    distributionChannels: ('streaming' | 'download' | 'physical')[];
    exclusiveTerritory?: string;
    exclusiveEndDate?: string;

    // Additional Identifiers
    upc?: string; // Universal Product Code (for albums/EPs)
    gridId?: string; // Global Release Identifier
    catalogNumber?: string;
    releaseTitle?: string; // Defaults to trackTitle for Singles

    // Copyright Information
    pLineYear?: number;
    pLineText?: string; // e.g., "2025 Artist Name"
    cLineYear?: number;
    cLineText?: string; // e.g., "2025 Publisher Name"

    // AI Content Disclosure (ERN 4.3)
    aiGeneratedContent: {
        isFullyAIGenerated: boolean;
        isPartiallyAIGenerated: boolean;
        aiToolsUsed?: string[];
        humanContribution?: string;
    };

    // Enhanced Metadata for Discovery
    subGenre?: string;
    mood?: string[];
    keywords?: string[];
    language?: string; // ISO 639-2 (e.g., 'eng', 'spa')
    isInstrumental?: boolean;

    // Marketing
    marketingComment?: string;
    focusTrack?: boolean; // Highlight for playlist pitching

    // Duration (computed from audio)
    durationSeconds?: number;
    durationFormatted?: string; // "3:45"
}

// Type for release status in distribution
export type ReleaseDistributionStatus =
    | 'draft'
    | 'metadata_complete'
    | 'assets_uploaded'
    | 'validating'
    | 'pending_review'
    | 'approved'
    | 'delivering'
    | 'live'
    | 'takedown_requested'
    | 'taken_down';

// Release record for Firestore
export interface DDEXReleaseRecord {
    id: string;
    orgId: string;
    projectId: string;
    userId: string;

    // Metadata
    metadata: ExtendedGoldenMetadata;

    // Assets
    assets: {
        audioUrl: string;
        audioFormat: 'wav' | 'flac' | 'mp3';
        audioSampleRate: number;
        audioBitDepth: number;
        coverArtUrl: string;
        coverArtWidth: number;
        coverArtHeight: number;
    };

    // Distribution State
    status: ReleaseDistributionStatus;
    distributors: {
        distributorId: string;
        releaseId?: string;
        status: string;
        submittedAt?: string;
        publishedAt?: string;
        error?: string;
    }[];

    // Timestamps
    createdAt: string;
    updatedAt: string;
    submittedAt?: string;
    publishedAt?: string;
}

export const INITIAL_METADATA: GoldenMetadata = {
    trackTitle: '',
    artistName: '',
    isrc: '',
    explicit: false,
    genre: '',
    labelName: DDEX_CONFIG.PARTY_NAME,
    dpid: DDEX_CONFIG.PARTY_ID,
    splits: [{ legalName: 'Self', role: 'songwriter', percentage: 100, email: '' }],
    pro: 'None',
    publisher: 'Self-Published',
    containsSamples: false,
    samples: [],
    isGolden: false
};
