import {
    BaseDistributorAdapter
} from './BaseDistributorAdapter';
import {
    DistributorId,
    DistributorRequirements,
    ReleaseStatus,
    ReleaseResult,
    DistributorEarnings,
    ValidationResult,
    ReleaseAssets,
    ExtendedGoldenMetadata,
    DateRange
} from '@/services/distribution/types/distributor';
import { ernService } from '@/services/ddex/ERNService';
import { DDEX_CONFIG } from '@/core/config/ddex';

export class TuneCoreAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'tunecore';
    readonly name = 'TuneCore';

    readonly requirements: DistributorRequirements = {
        distributorId: 'tunecore',
        coverArt: {
            minWidth: 1600,
            minHeight: 1600,
            maxWidth: 3000,
            maxHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB'
        },
        audio: {
            allowedFormats: ['wav'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['title', 'artist', 'genre', 'label'],
            maxTitleLength: 255,
            maxArtistNameLength: 255,
            isrcRequired: true, // TuneCore typically wants ISRC or generates it during creation flow before specific validation
            upcRequired: false,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 14,
            reviewTimeDays: 3,
        },
        pricing: {
            model: 'per_release',
            costPerRelease: 9.99, // Example single
            payoutPercentage: 100,
        }
    };

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to TuneCore');
        }

        try {
            // 1. Generate DDEX ERN
            const ernResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'tunecore', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            // 2. Return Pending Status
            return {
                success: true,
                releaseId: metadata.id,
                distributorReleaseId: `TC-${Date.now()}`,
                status: 'pending_review',
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: true,
                    isrcAssigned: metadata.isrc || 'US-TC1-25-00001',
                }
            };
        } catch (e) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'processing',
            // Mock update for TuneCore
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'takedown_requested'
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        return {
            distributorId: 'tunecore',
            releaseId: releaseId,
            period: period,
            streams: 0,
            downloads: 0,
            grossRevenue: 0,
            distributorFee: 0,
            netRevenue: 0,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-2', period)];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: string[] = [];
        if (!metadata.trackTitle) errors.push('Title is required');

        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'VALIDATION_ERROR', message: e, severity: 'error' })),
            warnings: []
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: string[] = [];
        if (assets.coverArt.width < this.requirements.coverArt.minWidth) {
            errors.push(`Cover art must be at least ${this.requirements.coverArt.minWidth}px`);
        }
        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'ASSET_ERROR', message: e, severity: 'error' })),
            warnings: []
        };
    }
}
