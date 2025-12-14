/**
 * Distributor Requirements Knowledge Base
 *
 * Contains metadata, formatting, and delivery requirements for major music distributors.
 * Used by the onboarding system to provide distributor-specific guidance.
 */

export interface DistributorRequirements {
    id: string;
    name: string;
    displayName: string;
    website: string;

    // Cover Art Requirements
    coverArt: {
        minSize: string;           // e.g., "3000x3000"
        maxSize: string;
        format: string[];          // e.g., ["JPG", "PNG"]
        colorMode: string;         // e.g., "RGB"
        maxFileSize?: string;      // e.g., "20MB"
        notes: string[];
    };

    // Audio Requirements
    audio: {
        format: string[];          // e.g., ["WAV", "FLAC"]
        sampleRate: string;        // e.g., "44.1kHz or higher"
        bitDepth: string;          // e.g., "16-bit or 24-bit"
        channels: string;          // e.g., "Stereo"
        notes: string[];
    };

    // Metadata Requirements
    metadata: {
        requiredFields: string[];
        maxTitleLength?: number;
        maxArtistLength?: number;
        genreList?: string;        // Link or note about genre taxonomy
        isrcRequired: boolean;
        upcRequired: boolean;
        notes: string[];
    };

    // Timeline & Process
    timeline: {
        minLeadTime: string;       // e.g., "2-3 weeks recommended"
        reviewTime: string;        // e.g., "1-2 business days"
        notes: string[];
    };

    // Pricing & Splits
    pricing: {
        model: string;             // e.g., "Subscription", "Per-release", "Commission"
        artistPayout: string;      // e.g., "100%", "85%"
        notes: string[];
    };

    // Special Features
    features: string[];

    // Pro Tips for this distributor
    proTips: string[];
}

export const DISTRIBUTOR_REQUIREMENTS: Record<string, DistributorRequirements> = {
    distrokid: {
        id: 'distrokid',
        name: 'DistroKid',
        displayName: 'DistroKid',
        website: 'https://distrokid.com',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            maxFileSize: '36MB',
            notes: [
                'Must be perfectly square',
                'No blurry or pixelated images',
                'No social media handles, URLs, or logos (except artist logo)',
                'No pricing information',
                'No release dates on artwork'
            ]
        },

        audio: {
            format: ['WAV', 'FLAC'],
            sampleRate: '44.1kHz or higher (up to 192kHz)',
            bitDepth: '16-bit or 24-bit',
            channels: 'Stereo',
            notes: [
                'Loudness: -14 LUFS recommended for streaming optimization',
                'No clipping - keep peaks below -0.3dB',
                'Dolby Atmos supported for spatial audio'
            ]
        },

        metadata: {
            requiredFields: ['Title', 'Artist Name', 'Primary Genre', 'Language', 'Release Date'],
            maxTitleLength: 200,
            isrcRequired: false, // DistroKid generates if not provided
            upcRequired: false,  // DistroKid generates if not provided
            notes: [
                'Explicit content must be flagged',
                'Instrumental tracks should be marked',
                'Features artists in format: "Artist feat. Featured"',
                'Remix format: "Song Title (Artist Remix)"'
            ]
        },

        timeline: {
            minLeadTime: '2-3 weeks recommended',
            reviewTime: '24-48 hours typical',
            notes: [
                'Ultra-fast delivery to Spotify, Apple Music',
                'Some stores (TikTok, Instagram) may take longer',
                'Release date changes available until 2 days before'
            ]
        },

        pricing: {
            model: 'Annual subscription',
            artistPayout: '100% of royalties',
            notes: [
                '$22.99/year for unlimited releases',
                'Optional add-ons: Leave a Legacy, Spotify verification',
                'No per-release fees'
            ]
        },

        features: [
            'Spotify for Artists verification assistance',
            'YouTube Content ID',
            'Lyrics distribution to Spotify, Apple Music',
            'Split payments with collaborators',
            'Hyperfollow pre-save pages',
            'Shazam registration',
            'Instagram/Facebook/TikTok audio library'
        ],

        proTips: [
            'Upload 3+ weeks early for playlist consideration',
            'Use the "Teams" feature for splits - set it up BEFORE release',
            'Enable YouTube Content ID for passive income from covers/uses',
            'Verify your Spotify for Artists profile immediately after release'
        ]
    },

    tunecore: {
        id: 'tunecore',
        name: 'TuneCore',
        displayName: 'TuneCore',
        website: 'https://tunecore.com',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            maxFileSize: '20MB',
            notes: [
                'Must be square aspect ratio',
                'No explicit content without proper flagging',
                'No third-party logos or trademarks'
            ]
        },

        audio: {
            format: ['WAV', 'FLAC'],
            sampleRate: '44.1kHz minimum, 96kHz recommended',
            bitDepth: '16-bit minimum, 24-bit recommended',
            channels: 'Stereo',
            notes: [
                'Master at -14 LUFS for streaming',
                'True peak: -1dB or lower recommended'
            ]
        },

        metadata: {
            requiredFields: ['Title', 'Artist Name', 'Genre', 'Release Date', 'Copyright Year', 'Copyright Holder'],
            isrcRequired: false,
            upcRequired: false,
            notes: [
                'Publishing information optional but recommended',
                'Multiple primary artists supported',
                'Compilation albums supported'
            ]
        },

        timeline: {
            minLeadTime: '2-4 weeks recommended',
            reviewTime: '24-72 hours',
            notes: [
                'Social delivery (TikTok, Instagram) may require additional time',
                'YouTube Music delivery included'
            ]
        },

        pricing: {
            model: 'Per-release + annual renewal',
            artistPayout: '100% of royalties',
            notes: [
                'Single: $9.99/year',
                'Album: $29.99/year',
                'Annual renewal required to stay in stores'
            ]
        },

        features: [
            'Publishing administration available',
            'YouTube monetization',
            'Social media delivery',
            'Release scheduling',
            'Sales analytics dashboard'
        ],

        proTips: [
            'Consider their publishing admin for sync opportunities',
            'Keep releases active - they get removed if you don\'t renew',
            'Use their analytics to track performance across platforms'
        ]
    },

    cdbaby: {
        id: 'cdbaby',
        name: 'CD Baby',
        displayName: 'CD Baby',
        website: 'https://cdbaby.com',

        coverArt: {
            minSize: '1400x1400',
            maxSize: '3000x3000',
            format: ['JPG'],
            colorMode: 'RGB',
            notes: [
                '3000x3000 recommended for best quality',
                'No borders or frames',
                'Original artwork required'
            ]
        },

        audio: {
            format: ['WAV', 'FLAC'],
            sampleRate: '44.1kHz or higher',
            bitDepth: '16-bit or 24-bit',
            channels: 'Stereo',
            notes: [
                'Accepts up to 96kHz sample rate'
            ]
        },

        metadata: {
            requiredFields: ['Title', 'Artist', 'Genre', 'Release Date'],
            isrcRequired: false,
            upcRequired: false,
            notes: [
                'Free ISRC codes provided',
                'Free UPC barcode provided'
            ]
        },

        timeline: {
            minLeadTime: '2-4 weeks',
            reviewTime: '2-5 business days',
            notes: [
                'Longer review times during high-volume periods'
            ]
        },

        pricing: {
            model: 'One-time fee',
            artistPayout: '91% of digital, varies for physical',
            notes: [
                'Single: $9.95 one-time',
                'Album: $29.95 one-time',
                'No annual fees - pay once, keep it forever',
                '9% commission on digital sales'
            ]
        },

        features: [
            'Physical distribution (CDs, vinyl)',
            'Sync licensing opportunities',
            'Publishing administration',
            'YouTube monetization',
            'Show.co promotional tools',
            'Free UPC and ISRC codes'
        ],

        proTips: [
            'Great for physical merch - they handle CD and vinyl distribution',
            'Their sync licensing program is legitimate - opt in!',
            'One-time fee means no pressure to renew'
        ]
    },

    awal: {
        id: 'awal',
        name: 'AWAL',
        displayName: 'AWAL (Kobalt)',
        website: 'https://awal.com',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            notes: [
                'High-quality, professional artwork expected',
                'AWAL is selective - artwork quality matters for acceptance'
            ]
        },

        audio: {
            format: ['WAV'],
            sampleRate: '44.1kHz or 48kHz',
            bitDepth: '16-bit or 24-bit',
            channels: 'Stereo',
            notes: [
                'Professional mastering expected',
                'Dolby Atmos supported'
            ]
        },

        metadata: {
            requiredFields: ['Title', 'Artist', 'Genre', 'Release Date', 'ISRC', 'UPC'],
            isrcRequired: true,
            upcRequired: true,
            notes: [
                'AWAL provides ISRC/UPC if you don\'t have them',
                'Detailed metadata improves playlist chances'
            ]
        },

        timeline: {
            minLeadTime: '4-6 weeks recommended',
            reviewTime: 'Application-based, varies',
            notes: [
                'AWAL is selective - not all artists accepted',
                'Longer lead time for playlist pitching'
            ]
        },

        pricing: {
            model: 'Commission-based tiers',
            artistPayout: '80-85% depending on tier',
            notes: [
                'Core: 80% royalties, basic distribution',
                'Select: 85% + marketing support (invite only)',
                'No upfront costs'
            ]
        },

        features: [
            'Dedicated artist support (higher tiers)',
            'Marketing and playlist support',
            'Sync licensing team',
            'Radio promotion',
            'Detailed analytics',
            'Advances available for top performers'
        ],

        proTips: [
            'AWAL is selective - have a solid streaming track record before applying',
            'Great stepping stone between indie and major label',
            'Their playlist team actually pitches - use the lead time',
            'Connect with their A&R for marketing support'
        ]
    },

    ditto: {
        id: 'ditto',
        name: 'Ditto Music',
        displayName: 'Ditto Music',
        website: 'https://dittomusic.com',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            notes: [
                'Square format required',
                'High resolution for best results'
            ]
        },

        audio: {
            format: ['WAV', 'FLAC'],
            sampleRate: '44.1kHz or higher',
            bitDepth: '16-bit or 24-bit',
            channels: 'Stereo',
            notes: []
        },

        metadata: {
            requiredFields: ['Title', 'Artist', 'Genre', 'Release Date'],
            isrcRequired: false,
            upcRequired: false,
            notes: [
                'Free ISRC and UPC codes included'
            ]
        },

        timeline: {
            minLeadTime: '2-3 weeks',
            reviewTime: '24-48 hours',
            notes: [
                'Fast delivery to major platforms'
            ]
        },

        pricing: {
            model: 'Annual subscription',
            artistPayout: '100% of royalties',
            notes: [
                'Unlimited releases for annual fee',
                'Tiered pricing based on features'
            ]
        },

        features: [
            'Record label services',
            'Sync licensing',
            'Radio plugging',
            'PR services available',
            'Playlist pitching'
        ],

        proTips: [
            'Good option for UK-based artists',
            'Their record label services can help scale',
            'Check out their additional marketing packages'
        ]
    },

    unitedmasters: {
        id: 'unitedmasters',
        name: 'UnitedMasters',
        displayName: 'UnitedMasters',
        website: 'https://unitedmasters.com',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            notes: [
                'Professional quality expected for Select tier'
            ]
        },

        audio: {
            format: ['WAV'],
            sampleRate: '44.1kHz',
            bitDepth: '16-bit or 24-bit',
            channels: 'Stereo',
            notes: []
        },

        metadata: {
            requiredFields: ['Title', 'Artist', 'Genre'],
            isrcRequired: false,
            upcRequired: false,
            notes: []
        },

        timeline: {
            minLeadTime: '2-3 weeks',
            reviewTime: '24-72 hours',
            notes: []
        },

        pricing: {
            model: 'Free tier + paid options',
            artistPayout: '90-100% depending on tier',
            notes: [
                'Free tier: 90% royalties',
                'Select membership: $5.99/month for 100%',
                'Exclusive deals available for top artists'
            ]
        },

        features: [
            'Brand partnership opportunities (NBA, ESPN)',
            'Sync licensing',
            'A&R feedback',
            'Marketing tools',
            'Split payments'
        ],

        proTips: [
            'Their brand partnerships are unique - great for hip-hop/R&B',
            'Apply for Select tier for better payout',
            'Strong in urban/hip-hop genre connections'
        ]
    },

    amuse: {
        id: 'amuse',
        name: 'Amuse',
        displayName: 'Amuse',
        website: 'https://amuse.io',

        coverArt: {
            minSize: '3000x3000',
            maxSize: '3000x3000',
            format: ['JPG', 'PNG'],
            colorMode: 'RGB',
            notes: []
        },

        audio: {
            format: ['WAV', 'FLAC'],
            sampleRate: '44.1kHz',
            bitDepth: '16-bit',
            channels: 'Stereo',
            notes: []
        },

        metadata: {
            requiredFields: ['Title', 'Artist', 'Genre'],
            isrcRequired: false,
            upcRequired: false,
            notes: []
        },

        timeline: {
            minLeadTime: '2 weeks',
            reviewTime: 'Varies',
            notes: [
                'Mobile-first platform'
            ]
        },

        pricing: {
            model: 'Free + Pro tiers',
            artistPayout: '100% (Free), 100% (Pro)',
            notes: [
                'Free tier available with basic features',
                'Pro unlocks faster delivery, more stores',
                'Boost tier includes marketing'
            ]
        },

        features: [
            'Mobile app for releases',
            'Fast Track for priority delivery',
            'Analytics',
            'Record label discovery program'
        ],

        proTips: [
            'Great mobile experience - release from your phone',
            'Their label program scouts from their platform',
            'Good for quick releases'
        ]
    }
};

/**
 * Get distributor requirements by name (fuzzy matching)
 */
export function getDistributorRequirements(distributorName: string): DistributorRequirements | null {
    const normalized = distributorName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Direct match
    if (DISTRIBUTOR_REQUIREMENTS[normalized]) {
        return DISTRIBUTOR_REQUIREMENTS[normalized];
    }

    // Fuzzy match
    const fuzzyMatches: Record<string, string> = {
        'distro': 'distrokid',
        'distrokid': 'distrokid',
        'dk': 'distrokid',
        'tunecore': 'tunecore',
        'tune': 'tunecore',
        'tc': 'tunecore',
        'cdbaby': 'cdbaby',
        'cd': 'cdbaby',
        'baby': 'cdbaby',
        'awal': 'awal',
        'kobalt': 'awal',
        'ditto': 'ditto',
        'dittomusic': 'ditto',
        'unitedmasters': 'unitedmasters',
        'united': 'unitedmasters',
        'um': 'unitedmasters',
        'amuse': 'amuse',
    };

    const matchKey = fuzzyMatches[normalized];
    if (matchKey && DISTRIBUTOR_REQUIREMENTS[matchKey]) {
        return DISTRIBUTOR_REQUIREMENTS[matchKey];
    }

    return null;
}

/**
 * Get a summary of distributor requirements for the AI
 */
export function getDistributorSummaryForAI(distributorName: string): string | null {
    const requirements = getDistributorRequirements(distributorName);
    if (!requirements) return null;

    return `
**${requirements.displayName} Requirements Summary:**

📸 **Cover Art**: ${requirements.coverArt.minSize} pixels, ${requirements.coverArt.format.join('/')} format
${requirements.coverArt.notes.slice(0, 2).map(n => `   - ${n}`).join('\n')}

🎵 **Audio**: ${requirements.audio.format.join('/')} at ${requirements.audio.sampleRate}, ${requirements.audio.bitDepth}
${requirements.audio.notes.slice(0, 2).map(n => `   - ${n}`).join('\n')}

📋 **Metadata**: ${requirements.metadata.requiredFields.join(', ')}
   - ISRC: ${requirements.metadata.isrcRequired ? 'Required' : 'Auto-generated'}
   - UPC: ${requirements.metadata.upcRequired ? 'Required' : 'Auto-generated'}

⏱️ **Timeline**: Upload ${requirements.timeline.minLeadTime} before release date

💰 **Payout**: ${requirements.pricing.artistPayout} (${requirements.pricing.model})

💡 **Pro Tips**:
${requirements.proTips.slice(0, 2).map(t => `   → ${t}`).join('\n')}
`.trim();
}

/**
 * Get all supported distributor names
 */
export function getSupportedDistributors(): string[] {
    return Object.values(DISTRIBUTOR_REQUIREMENTS).map(d => d.displayName);
}
