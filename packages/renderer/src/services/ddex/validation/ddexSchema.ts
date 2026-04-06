import { z } from 'zod';
import type {
    ContributorRole,
} from '../types/common';

/**
 * DDEX Zod Schemas
 * Comprehensive validation for ERN 4.3 metadata
 */

// --- Common Primitives ---

export const DPIDSchema = z.object({
    partyId: z.string().regex(/^PADPIDA[a-zA-Z0-9]{10}$/, 'Invalid DPID format (Must be PADPIDA + 10 characters)'),
    partyName: z.string().min(1, 'Party name is required')
});

export const ContributorRoleSchema = z.enum([
    'MainArtist', 'FeaturedArtist', 'Composer', 'Lyricist', 'Producer',
    'Arranger', 'Mixer', 'MasteringEngineer', 'RecordingEngineer',
    'RemixArtist', 'AssociatedPerformer'
] as [ContributorRole, ...ContributorRole[]]);

export const ContributorSchema = z.object({
    name: z.string().min(1, 'Contributor name is required'),
    role: ContributorRoleSchema,
    sequenceNumber: z.number().int().positive().optional(),
    partyId: z.string().optional()
});

export const DateRangeSchema = z.object({
    startDate: z.string().datetime({ message: 'Start date must be ISO 8601' }),
    endDate: z.string().datetime().optional()
});

export const PriceSchema = z.object({
    amount: z.number().nonnegative(),
    currencyCode: z.string().length(3, 'Currency code must be ISO 4217 (3 letters)')
});

export const AIGenerationInfoSchema = z.object({
    isFullyAIGenerated: z.boolean(),
    isPartiallyAIGenerated: z.boolean(),
    aiToolsUsed: z.array(z.string()).optional(),
    humanContributionDescription: z.string().optional()
});

// --- ERN Specific Components ---

export const TitleTextSchema = z.object({
    titleText: z.string().min(1, 'Title text is required'),
    titleType: z.enum(['FormalTitle', 'DisplayTitle', 'GroupingTitle', 'AlternativeTitle']).optional(),
    languageCode: z.string().length(2).optional() // ISO 639-2 (simplified to 2-char for common use)
});

export const CopyrightLineSchema = z.object({
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    text: z.string().min(1, 'Copyright text is required')
});

export const GenreSchema = z.object({
    genre: z.string().min(1, 'Primary genre is required'),
    subGenre: z.string().optional()
});

export const TechnicalDetailsSchema = z.object({
    audioCodec: z.enum(['FLAC', 'WAV', 'MP3', 'AAC']).optional(),
    samplingRate: z.number().int().positive().optional(),
    bitDepth: z.number().int().positive().optional(),
    numberOfChannels: z.number().int().min(1).max(8).optional(),
    duration: z.string().regex(/^PT[0-9]+M[0-9]+S$/, 'Invalid ISO 8601 duration format (e.g. PT3M45S)').optional(),
    fileSizeInBytes: z.number().int().positive().optional(),
    fileName: z.string().optional()
});

// --- Resource Schema ---

export const ResourceIdSchema = z.object({
    isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/, 'Invalid ISRC format').optional(),
    proprietaryId: z.object({
        proprietaryIdType: z.string(),
        id: z.string()
    }).optional()
});

export const ResourceSchema = z.object({
    resourceReference: z.string().regex(/^A[0-9]+$/, 'Resource reference must be A followed by digits'),
    resourceType: z.enum(['SoundRecording', 'Video', 'Image']),
    resourceId: ResourceIdSchema,
    resourceTitle: TitleTextSchema,
    displayArtistName: z.string().min(1, 'Display artist name is required'),
    contributors: z.array(ContributorSchema).min(1, 'At least one contributor is required'),
    duration: z.string().optional(),
    technicalDetails: TechnicalDetailsSchema.optional(),
    parentalWarningType: z.enum(['Explicit', 'NotExplicit', 'NoAdviceAvailable', 'Edited']).optional(),
    aiGenerationInfo: AIGenerationInfoSchema.optional()
});

// --- Release Schema ---

export const ReleaseIdSchema = z.object({
    icpn: z.string().min(12).max(14).optional(), // Barcode (UPC/EAN)
    gridId: z.string().optional(),
    isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/, 'Invalid ISRC format').optional(),
    catalogNumber: z.string().optional()
});

export const ReleaseSchema = z.object({
    releaseId: ReleaseIdSchema,
    releaseReference: z.string().regex(/^R[0-9]+$/, 'Release reference must be R followed by digits'),
    releaseType: z.enum(['Single', 'EP', 'Album', 'Compilation', 'Mixtape', 'Audiobook', 'ClassicalAlbum']),
    releaseTitle: TitleTextSchema,
    displayArtistName: z.string().min(1, 'Display artist name is required'),
    contributors: z.array(ContributorSchema).min(1, 'At least one contributor is required'),
    labelName: z.string().min(1, 'Label name is required'),
    pLine: CopyrightLineSchema.optional(),
    cLine: CopyrightLineSchema.optional(),
    genre: GenreSchema,
    parentalWarningType: z.enum(['Explicit', 'NotExplicit', 'NoAdviceAvailable', 'Edited']),
    aiGenerationInfo: AIGenerationInfoSchema.optional(),
    releaseResourceReferenceList: z.array(z.string()).min(1, 'Release must contain at least one resource reference')
});

// --- Deal Schema ---

export const UsageSchema = z.object({
    useType: z.enum(['OnDemandStream', 'PermanentDownload', 'TimeDelimitedStream', 'NonInteractiveStream', 'Broadcast', 'Simulcast']),
    distributionChannelType: z.enum(['Download', 'Stream', 'MobileDevice']).optional()
});

export const DealTermsSchema = z.object({
    commercialModelType: z.enum(['AdvertisementSupportedModel', 'PayAsYouGoModel', 'SubscriptionModel', 'FreeOfChargeModel']),
    usage: z.array(UsageSchema).min(1, 'At least one usage type is required'),
    territoryCode: z.array(z.string()).min(1, 'At least one territory is required'),
    validityPeriod: DateRangeSchema,
    takeDown: z.boolean().optional()
});

export const DealSchema = z.object({
    dealReference: z.string().regex(/^D[0-9]+$/, 'Deal reference must be D followed by digits'),
    dealTerms: DealTermsSchema
});

// --- Top Level Message Schema ---

export const ERNMessageSchema = z.object({
    messageSchemaVersionId: z.literal('4.3'),
    messageHeader: z.object({
        messageId: z.string().uuid().or(z.string().min(1)),
        messageSender: DPIDSchema,
        messageRecipient: DPIDSchema,
        messageCreatedDateTime: z.string().datetime(),
        messageControlType: z.enum(['LiveMessage', 'TestMessage']).optional()
    }),
    releaseList: z.array(ReleaseSchema).min(1, 'Message must contain at least one release'),
    resourceList: z.array(ResourceSchema).min(1, 'Message must contain at least one resource'),
    dealList: z.array(DealSchema).min(1, 'Message must contain at least one deal')
});

/**
 * Validates a DDEX ERN object against the schema.
 * Returns a ValidationResult compatible with indiiOS internal types.
 */
export function validateERN(data: unknown) {
    const result = ERNMessageSchema.safeParse(data);

    if (result.success) {
        return { isValid: true, errors: [], warnings: [] };
    } else {
        return {
            isValid: false,
            errors: result.error.errors.map(err => ({
                code: 'SCHEMA_VIOLATION',
                message: err.message,
                field: err.path.join('.'),
                severity: 'error' as const
            })),
            warnings: []
        };
    }
}
