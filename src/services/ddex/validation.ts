import { z } from 'zod';

/**
 * Common DDEX/Music Metadata Validation Schemas
 * Phase 1.3: Data Validation & Sanitization
 */

// ISO 8601 Date regex
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const DateRangeSchema = z.object({
    startDate: z.string().regex(isoDateRegex).or(z.string().regex(isoDateTimeRegex)),
    endDate: z.string().regex(isoDateRegex).or(z.string().regex(isoDateTimeRegex)).optional(),
});

export const DistributorIdSchema = z.enum([
    'distrokid',
    'tunecore',
    'cdbaby',
    'ditto',
    'awal',
    'unitedmasters',
    'amuse',
    'symphonic'
]);

export const TerritoryCodeSchema = z.string().length(2).or(z.literal('Worldwide'));

export const PriceSchema = z.object({
    amount: z.number().min(0),
    currency: z.string().length(3),
});

/**
 * Metadata Validation
 */

export const RoyaltySplitSchema = z.object({
    legalName: z.string().min(1, 'Legal name is required'),
    role: z.enum(['songwriter', 'producer', 'performer', 'other']),
    percentage: z.number().min(0).max(100),
    email: z.string().email('Invalid email address'),
});

export const SampleSchema = z.object({
    fingerprint: z.string().optional(),
    sourceName: z.string().min(1),
    cleared: z.boolean(),
    licenseFile: z.string().optional(),
    clearanceDetails: z.object({
        licenseType: z.string(),
        termsSummary: z.string(),
        platformId: z.string().optional(),
    }).optional(),
});

export const GoldenMetadataSchema = z.object({
    trackTitle: z.string().min(1, 'Track title is required'),
    artistName: z.string().min(1, 'Artist name is required'),
    isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/, 'Invalid ISRC format'),
    iswc: z.string().optional(),
    explicit: z.boolean(),
    genre: z.string().min(1, 'Genre is required'),
    labelName: z.string().min(1, 'Label name is required'),
    dpid: z.string().optional(),
    splits: z.array(RoyaltySplitSchema).min(1, 'At least one royalty split is required'),
    pro: z.enum(['ASCAP', 'BMI', 'SESAC', 'GMR', 'None']),
    publisher: z.string().min(1, 'Publisher is required'),
    containsSamples: z.boolean(),
    samples: z.array(SampleSchema).optional(),
    lyrics: z.string().optional(),
    isGolden: z.boolean(),
});

export const ExtendedGoldenMetadataSchema = GoldenMetadataSchema.extend({
    id: z.string().optional(),
    tracks: z.array(GoldenMetadataSchema).optional(),
    releaseType: z.enum(['Single', 'EP', 'Album', 'Compilation']),
    releaseDate: z.string().regex(isoDateRegex, 'Invalid release date'),
    preOrderDate: z.string().regex(isoDateRegex).optional(),
    originalReleaseDate: z.string().regex(isoDateRegex).optional(),
    territories: z.array(TerritoryCodeSchema),
    distributionChannels: z.array(z.enum(['streaming', 'download', 'physical'])),
    exclusiveTerritory: TerritoryCodeSchema.optional(),
    exclusiveEndDate: z.string().regex(isoDateRegex).optional(),
    upc: z.string().optional(),
    gridId: z.string().optional(),
    catalogNumber: z.string().optional(),
    releaseTitle: z.string().optional(),
    pLineYear: z.number().optional(),
    pLineText: z.string().optional(),
    cLineYear: z.number().optional(),
    cLineText: z.string().optional(),
    aiGeneratedContent: z.object({
        isFullyAIGenerated: z.boolean(),
        isPartiallyAIGenerated: z.boolean(),
        aiToolsUsed: z.array(z.string()).optional(),
        humanContribution: z.string().optional(),
    }),
    subGenre: z.string().optional(),
    mood: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    language: z.string().length(3).optional(),
    isInstrumental: z.boolean().optional(),
    marketingComment: z.string().optional(),
    focusTrack: z.boolean().optional(),
    durationSeconds: z.number().optional(),
    durationFormatted: z.string().optional(),
});

/**
 * DSR Reporting Validation
 */

export const ResourceIdentifierSchema = z.object({
    isrc: z.string().optional(),
    proprietaryId: z.string().optional(),
    title: z.string().optional(),
});

export const ReleaseIdentifierSchema = z.object({
    icpn: z.string().optional(),
    gridId: z.string().optional(),
    proprietaryId: z.string().optional(),
});

export const DSRTransactionSchema = z.object({
    transactionId: z.string(),
    resourceId: ResourceIdentifierSchema,
    releaseId: ReleaseIdentifierSchema.optional(),
    usageType: z.enum(['OnDemandStream', 'ProgrammedStream', 'Download', 'RingtoneDownload', 'Other']),
    usageCount: z.number().min(0),
    revenueAmount: z.number(),
    currencyCode: z.string().length(3),
    territoryCode: TerritoryCodeSchema,
    serviceName: z.string().optional(),
    serviceType: z.enum(['Streaming', 'Download', 'Other']).optional(),
    usagePeriod: DateRangeSchema.optional(),
    subscriberType: z.enum(['Premium', 'AdSupported', 'Free', 'Trial']).optional(),
});

export const DSRSummarySchema = z.object({
    totalUsageCount: z.number(),
    totalRevenue: z.number(),
    totalStreams: z.number().optional(),
    totalDownloads: z.number().optional(),
    currencyCode: z.string().length(3),
});

export const DSRReportSchema = z.object({
    reportId: z.string(),
    senderId: z.string(),
    recipientId: z.string(),
    reportingPeriod: DateRangeSchema,
    reportCreatedDateTime: z.string().regex(isoDateTimeRegex),
    currencyCode: z.string().length(3),
    summary: DSRSummarySchema,
    transactions: z.array(DSRTransactionSchema),
});

/**
 * Distribution Specific Validation
 */

export const ReleaseAssetsSchema = z.object({
    audioFiles: z.array(z.object({
        trackIndex: z.number().optional(),
        url: z.string().url(),
        mimeType: z.string(),
        sizeBytes: z.number().positive(),
        format: z.enum(['wav', 'flac', 'mp3', 'aac']),
        sampleRate: z.number().positive(),
        bitDepth: z.number().positive(),
    })).min(1),
    audioFile: z.object({
        url: z.string().url(),
        mimeType: z.string(),
        sizeBytes: z.number().positive(),
        format: z.enum(['wav', 'flac', 'mp3', 'aac']),
        sampleRate: z.number().positive(),
        bitDepth: z.number().positive(),
    }).optional(),
    coverArt: z.object({
        url: z.string().url(),
        mimeType: z.string(),
        width: z.number().positive(),
        height: z.number().positive(),
        sizeBytes: z.number().positive(),
    }),
    additionalAssets: z.array(z.object({
        type: z.enum(['lyrics', 'video', 'pressKit']),
        url: z.string().url(),
        mimeType: z.string(),
    })).optional(),
});

export const EarningsBreakdownSchema = z.object({
    platform: z.string(),
    territoryCode: z.string(),
    streams: z.number(),
    downloads: z.number(),
    revenue: z.number(),
});

export const DistributorEarningsSchema = z.object({
    distributorId: DistributorIdSchema,
    releaseId: z.string(),
    period: DateRangeSchema,
    streams: z.number(),
    downloads: z.number(),
    grossRevenue: z.number(),
    distributorFee: z.number(),
    netRevenue: z.number(),
    currencyCode: z.string().length(3),
    breakdown: z.array(EarningsBreakdownSchema).optional(),
    lastUpdated: z.string().regex(isoDateTimeRegex),
});

