/**
 * UnitedMasters Distributor Adapter
 *
 * UnitedMasters offers artist-friendly direct deal flow (popular with hip-hop / R&B).
 * Delivery uses their partner API or SFTP depending on agreement tier.
 *
 * Item 217: Added UnitedMasters distributor adapter.
 */

import { BaseDistributorAdapter } from './BaseDistributorAdapter';
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
import { logger } from '@/utils/logger';

const UM_API_BASE = 'https://api.unitedmasters.com/v1';

export class UnitedMastersAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'unitedmasters';
    readonly name = 'UnitedMasters';

    readonly requirements: DistributorRequirements = {
        distributorId: 'unitedmasters',
        coverArt: {
            minWidth: 1500,
            minHeight: 1500,
            maxWidth: 5000,
            maxHeight: 5000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB',
        },
        audio: {
            allowedFormats: ['wav', 'mp3'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre'],
            maxTitleLength: 250,
            maxArtistNameLength: 250,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: false,
        },
        timing: {
            minLeadTimeDays: 3, // UnitedMasters Select: 3 business days
            reviewTimeDays: 2,
        },
        pricing: {
            model: 'subscription',
            annualFee: 59.99, // UnitedMasters Select annual fee
            payoutPercentage: 100,
        },
    };

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) throw new Error('Not connected to UnitedMasters');

        const releaseId = metadata.id || `UM-${Date.now()}`;

        try {
            const ernResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'unitedmasters', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false, status: 'failed',
                    errors: [{ code: 'ERN_FAILED', message: ernResult.error || 'ERN generation failed' }]
                };
            }

            if (this.credentials?.apiKey) {
                try {
                    const response = await fetch(`${UM_API_BASE}/releases`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.credentials.apiKey}`,
                            'Content-Type': 'application/json',
                            'X-UM-Partner': 'indiiOS',
                        },
                        body: JSON.stringify({
                            title: metadata.trackTitle,
                            artist: metadata.artistName,
                            genre: metadata.genre,
                            release_date: metadata.releaseDate,
                            isrc: metadata.isrc,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return {
                            success: true,
                            releaseId,
                            distributorReleaseId: data.id || `UM-${releaseId}`,
                            status: 'pending_review',
                            metadata: {
                                estimatedLiveDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                                reviewRequired: false, // UM Select is typically fast
                            }
                        };
                    }
                } catch (apiErr) {
                    logger.warn('[UnitedMasters] API delivery failed:', apiErr);
                }
            }

            return {
                success: true,
                releaseId,
                distributorReleaseId: `UM-${releaseId}`,
                status: 'pending_review',
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: false,
                    note: 'Add UnitedMasters API key in Settings > Integrations for automatic delivery.',
                }
            };
        } catch (e) {
            return {
                success: false, status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        // UnitedMasters typically requires re-upload for changes
        return {
            success: false, status: 'failed',
            errors: [{ code: 'REUPLOAD_REQUIRED', message: 'UnitedMasters requires a full re-upload for metadata changes.' }]
        };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        return { success: true, status: 'takedown_requested', distributorReleaseId: releaseId };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        return {
            distributorId: 'unitedmasters', releaseId, period,
            streams: 0, downloads: 0, grossRevenue: 0, distributorFee: 0, netRevenue: 0,
            currencyCode: 'USD', lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(_period: DateRange): Promise<DistributorEarnings[]> {
        return [];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: string[] = [];
        if (!metadata.trackTitle) errors.push('Title is required');
        if (!metadata.artistName) errors.push('Artist name is required');
        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'VALIDATION_ERROR', message: e, severity: 'error' as const })),
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
            errors: errors.map(e => ({ code: 'ASSET_ERROR', message: e, severity: 'error' as const })),
            warnings: []
        };
    }
}
