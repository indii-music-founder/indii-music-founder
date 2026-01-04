/**
 * DistributorContext - System-wide intelligence layer for distributor requirements
 *
 * This service provides distributor-aware defaults across the entire app:
 * - Image generation auto-sizes to distributor cover art specs
 * - Audio exports validate against distributor requirements
 * - AI prompts include distributor context for smart suggestions
 * - Export functionality validates before upload
 */

import { getDistributorRequirements, DistributorRequirements } from './distributorRequirements';
import type { UserProfile } from '@/modules/workflow/types';

// --- Types ---

export interface ImageConstraints {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    format: string[];
    colorMode: string;
    aspectRatio: string;
    notes: string[];
}

export interface AudioConstraints {
    format: string[];
    sampleRate: number[];
    bitDepth: number[];
    channels: 'stereo' | 'mono' | 'both';
    notes: string[];
}

export interface MetadataConstraints {
    requiredFields: string[];
    optionalFields: string[];
    isrcRequired: boolean;
    upcRequired: boolean;
    notes: string[];
}

export interface TimelineConstraints {
    minLeadTimeDays: number;
    reviewTimeDays: number;
    recommendedLeadTimeDays: number;
    notes: string[];
}

export interface VideoConstraints {
    formats: string[];
    canvas?: {
        minDuration: number;
        maxDuration: number;
        aspectRatio: string;
        resolution: string;
    };
    musicVideo?: {
        maxResolution: string;
        acceptedFormats: string[];
    };
    notes: string[];
}

export interface DistributorContext {
    distributor: DistributorRequirements | null;
    image: ImageConstraints;
    audio: AudioConstraints;
    metadata: MetadataConstraints;
    timeline: TimelineConstraints;
    video: VideoConstraints;
    isConfigured: boolean;
    summary: string;
}

// --- Default Fallbacks (Industry Standard) ---

const DEFAULT_IMAGE_CONSTRAINTS: ImageConstraints = {
    width: 3000,
    height: 3000,
    minWidth: 3000,
    minHeight: 3000,
    maxWidth: 6000,
    maxHeight: 6000,
    format: ['JPEG', 'PNG'],
    colorMode: 'RGB',
    aspectRatio: '1:1',
    notes: ['No distributor configured - using industry standard 3000x3000']
};

const DEFAULT_AUDIO_CONSTRAINTS: AudioConstraints = {
    format: ['WAV', 'FLAC'],
    sampleRate: [44100, 48000],
    bitDepth: [16, 24],
    channels: 'stereo',
    notes: ['No distributor configured - using industry standard specs']
};

const DEFAULT_METADATA_CONSTRAINTS: MetadataConstraints = {
    requiredFields: ['Track Title', 'Artist Name', 'Release Date', 'Genre', 'Language'],
    optionalFields: ['ISRC', 'UPC', 'Lyrics', 'Composer', 'Producer'],
    isrcRequired: false,
    upcRequired: false,
    notes: ['No distributor configured - basic metadata only']
};

const DEFAULT_TIMELINE_CONSTRAINTS: TimelineConstraints = {
    minLeadTimeDays: 7,
    reviewTimeDays: 3,
    recommendedLeadTimeDays: 14,
    notes: ['No distributor configured - recommend 2 weeks lead time']
};

const DEFAULT_VIDEO_CONSTRAINTS: VideoConstraints = {
    formats: ['MP4', 'MOV'],
    notes: ['No distributor configured - using standard video formats']
};

// --- Helper Functions ---

function parseSizeString(sizeStr: string): { width: number; height: number } {
    // Parse strings like "3000x3000" or "3000 x 3000"
    const match = sizeStr.match(/(\d+)\s*x\s*(\d+)/i);
    if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    // Fallback for single number (assumes square)
    const single = sizeStr.match(/(\d+)/);
    if (single) {
        const size = parseInt(single[1]);
        return { width: size, height: size };
    }
    return { width: 3000, height: 3000 };
}

function parseLeadTime(timeStr: string): number {
    // Parse strings like "2-4 weeks", "7 days", "1 week"
    const weeksMatch = timeStr.match(/(\d+)(?:-\d+)?\s*week/i);
    if (weeksMatch) {
        return parseInt(weeksMatch[1]) * 7;
    }
    const daysMatch = timeStr.match(/(\d+)\s*day/i);
    if (daysMatch) {
        return parseInt(daysMatch[1]);
    }
    return 7; // Default 1 week
}

function parseSampleRate(rateStr: string): number[] {
    // Parse strings like "44.1kHz or 48kHz"
    const rates: number[] = [];
    if (rateStr.includes('44.1') || rateStr.includes('44100')) rates.push(44100);
    if (rateStr.includes('48') || rateStr.includes('48000')) rates.push(48000);
    if (rateStr.includes('96') || rateStr.includes('96000')) rates.push(96000);
    return rates.length > 0 ? rates : [44100, 48000];
}

function parseBitDepth(depthStr: string): number[] {
    // Parse strings like "16-bit or 24-bit"
    const depths: number[] = [];
    if (depthStr.includes('16')) depths.push(16);
    if (depthStr.includes('24')) depths.push(24);
    if (depthStr.includes('32')) depths.push(32);
    return depths.length > 0 ? depths : [16, 24];
}

// --- Main Context Builder ---

export function buildDistributorContext(profile: UserProfile): DistributorContext {
    const distributorName = profile.brandKit?.socials?.distributor;

    if (!distributorName) {
        return {
            distributor: null,
            image: DEFAULT_IMAGE_CONSTRAINTS,
            audio: DEFAULT_AUDIO_CONSTRAINTS,
            metadata: DEFAULT_METADATA_CONSTRAINTS,
            timeline: DEFAULT_TIMELINE_CONSTRAINTS,
            video: DEFAULT_VIDEO_CONSTRAINTS,
            isConfigured: false,
            summary: 'No distributor configured. Using industry-standard specifications.'
        };
    }

    const distro = getDistributorRequirements(distributorName);

    if (!distro) {
        return {
            distributor: null,
            image: DEFAULT_IMAGE_CONSTRAINTS,
            audio: DEFAULT_AUDIO_CONSTRAINTS,
            metadata: DEFAULT_METADATA_CONSTRAINTS,
            timeline: DEFAULT_TIMELINE_CONSTRAINTS,
            video: DEFAULT_VIDEO_CONSTRAINTS,
            isConfigured: false,
            summary: `Distributor "${distributorName}" not recognized. Using industry-standard specifications.`
        };
    }

    // Parse distributor requirements into structured constraints
    const minSize = parseSizeString(distro.coverArt.minSize);
    const maxSize = parseSizeString(distro.coverArt.maxSize);

    const imageConstraints: ImageConstraints = {
        width: minSize.width,
        height: minSize.height,
        minWidth: minSize.width,
        minHeight: minSize.height,
        maxWidth: maxSize.width,
        maxHeight: maxSize.height,
        format: distro.coverArt.format.map(f => f.trim().toUpperCase()),
        colorMode: distro.coverArt.colorMode,
        aspectRatio: '1:1',
        notes: distro.coverArt.notes || []
    };

    const audioConstraints: AudioConstraints = {
        format: distro.audio.format.map(f => f.trim().toUpperCase()),
        sampleRate: parseSampleRate(distro.audio.sampleRate),
        bitDepth: parseBitDepth(distro.audio.bitDepth),
        channels: 'stereo',
        notes: distro.audio.notes || []
    };

    const metadataConstraints: MetadataConstraints = {
        requiredFields: distro.metadata.requiredFields,
        optionalFields: [],
        isrcRequired: distro.metadata.isrcRequired,
        upcRequired: distro.metadata.upcRequired,
        notes: distro.metadata.notes || []
    };

    const timelineConstraints: TimelineConstraints = {
        minLeadTimeDays: parseLeadTime(distro.timeline.minLeadTime),
        reviewTimeDays: parseLeadTime(distro.timeline.reviewTime),
        recommendedLeadTimeDays: parseLeadTime(distro.timeline.minLeadTime) + 7,
        notes: distro.timeline.notes || []
    };

    const videoConstraints: VideoConstraints = {
        formats: distro.video?.formats || ['MP4', 'MOV'],
        canvas: distro.video?.canvas,
        musicVideo: distro.video?.musicVideo,
        notes: distro.video?.notes || []
    };

    return {
        distributor: distro,
        image: imageConstraints,
        audio: audioConstraints,
        metadata: metadataConstraints,
        timeline: timelineConstraints,
        video: videoConstraints,
        isConfigured: true,
        summary: `Configured for ${distro.name}. Cover art: ${minSize.width}x${minSize.height}px min, ${distro.audio.format}, ${distro.pricing.artistPayout} payout.`
    };
}

// --- Convenience Getters ---

/**
 * Get image generation constraints for the current distributor
 */
export function getImageConstraints(profile: UserProfile): ImageConstraints {
    return buildDistributorContext(profile).image;
}

/**
 * Get audio export constraints for the current distributor
 */
export function getAudioConstraints(profile: UserProfile): AudioConstraints {
    return buildDistributorContext(profile).audio;
}

/**
 * Get metadata requirements for the current distributor
 */
export function getMetadataConstraints(profile: UserProfile): MetadataConstraints {
    return buildDistributorContext(profile).metadata;
}

/**
 * Get timeline recommendations for the current distributor
 */
export function getTimelineConstraints(profile: UserProfile): TimelineConstraints {
    return buildDistributorContext(profile).timeline;
}

/**
 * Get video requirements for the current distributor
 */
export function getVideoConstraints(profile: UserProfile): VideoConstraints {
    return buildDistributorContext(profile).video;
}

/**
 * Generate a context string for AI prompts - includes all relevant distributor info
 */
export function getDistributorPromptContext(profile: UserProfile): string {
    const ctx = buildDistributorContext(profile);

    if (!ctx.isConfigured) {
        return `DISTRIBUTOR: Not configured. Use industry-standard specs (3000x3000 cover art, WAV/FLAC audio, 44.1/48kHz).`;
    }

    const distro = ctx.distributor!;

    return `DISTRIBUTOR CONTEXT (${distro.name}):
- Cover Art: ${ctx.image.minWidth}x${ctx.image.minHeight}px minimum, ${ctx.image.maxWidth}x${ctx.image.maxHeight}px maximum
- Format: ${ctx.image.format.join(' or ')}, ${ctx.image.colorMode} color mode
- Audio: ${ctx.audio.format.join(' or ')}, ${ctx.audio.sampleRate.join(' or ')}Hz, ${ctx.audio.bitDepth.join(' or ')}-bit
- Timeline: ${ctx.timeline.minLeadTimeDays} days minimum lead time, ${ctx.timeline.reviewTimeDays} days for review
- Payout: ${distro.pricing.artistPayout}
- ISRC Required: ${ctx.metadata.isrcRequired ? 'Yes' : 'No'}
- UPC Required: ${ctx.metadata.upcRequired ? 'Yes' : 'No'}

IMPORTANT: All generated cover art MUST be exactly ${ctx.image.minWidth}x${ctx.image.minHeight}px (1:1 square) to meet ${distro.name} requirements.`;
}

/**
 * Validate an image against distributor requirements
 */
export function validateImageForDistributor(
    profile: UserProfile,
    imageWidth: number,
    imageHeight: number
): { valid: boolean; errors: string[]; warnings: string[] } {
    const ctx = buildDistributorContext(profile);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check aspect ratio
    if (imageWidth !== imageHeight) {
        errors.push(`Image must be square (1:1). Current: ${imageWidth}x${imageHeight}`);
    }

    // Check minimum size
    if (imageWidth < ctx.image.minWidth || imageHeight < ctx.image.minHeight) {
        errors.push(`Image too small. Minimum: ${ctx.image.minWidth}x${ctx.image.minHeight}px. Current: ${imageWidth}x${imageHeight}px`);
    }

    // Check maximum size
    if (imageWidth > ctx.image.maxWidth || imageHeight > ctx.image.maxHeight) {
        warnings.push(`Image exceeds maximum (${ctx.image.maxWidth}x${ctx.image.maxHeight}px). It may be downscaled.`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Get the recommended canvas size for the current distributor
 */
export function getRecommendedCanvasSize(profile: UserProfile): { width: number; height: number } {
    const ctx = buildDistributorContext(profile);
    return {
        width: ctx.image.minWidth,
        height: ctx.image.minHeight
    };
}
