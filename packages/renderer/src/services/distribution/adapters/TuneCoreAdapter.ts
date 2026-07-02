import {
    BaseDistributorAdapter
} from './BaseDistributorAdapter';
import { earningsService } from '../EarningsService';
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
import { ingestionNotificationService } from '@/services/distribution/proprietary-ingestion/IngestionNotificationService';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { logger } from '@/utils/logger';

export class TuneCoreAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'tunecore';
    readonly name = 'TuneCore';
    // Item 413: Pinned API version — bump intentionally on breaking change
    protected readonly apiVersion = 'v1';
    protected readonly apiBaseUrl = 'https://api.tunecore.com/v1';

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
            const ernResult = await ingestionNotificationService.generateERN(metadata, INGESTION_CONFIG.SYSTEM_IDENTIFIER, 'tunecore', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            const releaseId = metadata.id || `TC-${Date.now()}`;

            // 2. Attempt HTTP API delivery when API key is present (Item 211).
            // success:true is reserved for a real accepted delivery (ISSUE-658).
            if (this.credentials?.apiKey) {
                try {
                    const response = await fetch(`${this.apiBaseUrl}/releases`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.credentials.apiKey}`,
                            'Content-Type': 'application/json',
                            ...this.getVersionedHeaders(),
                        },
                        body: JSON.stringify({
                            title: metadata.trackTitle,
                            artist: metadata.artistName,
                            isrc: metadata.isrc,
                            genre: metadata.genre,
                            label: metadata.labelName || 'Self-Released',
                            release_date: metadata.releaseDate,
                            ddex_ern: ernResult.xml,
                        }),
                    });

                    if (!response.ok) {
                        logger.warn(`[TuneCore] API rejected the release (HTTP ${response.status}) — no delivery occurred.`);
                        return {
                            success: false,
                            releaseId,
                            status: 'failed',
                            errors: [{ code: 'DELIVERY_REJECTED', message: `TuneCore API rejected the release (HTTP ${response.status}). Nothing was delivered.` }]
                        };
                    }

                    const data = await response.json();
                    return {
                        success: true,
                        releaseId,
                        distributorReleaseId: data.id || `TC-${releaseId}`,
                        status: 'pending_review',
                        metadata: {
                            estimatedLiveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                            reviewRequired: true,
                            isrcAssigned: data.isrc || metadata.isrc,
                        }
                    };
                } catch (apiErr: unknown) {
                    logger.warn('[TuneCore] API delivery unavailable — ERN is ready for manual submission, nothing was delivered:', apiErr);
                    return {
                        success: false,
                        releaseId,
                        status: 'ready_for_manual_submission',
                        errors: [{ code: 'DELIVERY_UNAVAILABLE', message: 'TuneCore API delivery failed before acceptance. The DDEX ERN was generated — submit the release manually from your TuneCore account.' }],
                        metadata: {
                            reviewRequired: true,
                            isrcAssigned: metadata.isrc,
                            note: 'ERN generated. No delivery to TuneCore occurred.',
                        }
                    };
                }
            }

            // 3. No API key: honest manual handoff — ERN generated, nothing delivered
            return {
                success: false,
                releaseId,
                status: 'ready_for_manual_submission',
                errors: [{ code: 'MANUAL_DELIVERY_REQUIRED', message: 'No TuneCore API key configured — nothing was delivered. Add one in Settings > Integrations for automatic delivery, or submit the generated ERN manually from your TuneCore account.' }],
                metadata: {
                    reviewRequired: true,
                    isrcAssigned: metadata.isrc,
                    note: 'ERN generated. No delivery to TuneCore occurred.',
                }
            };
        } catch (e: unknown) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.credentials?.apiKey) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'NO_API_KEY', message: 'TuneCore API key required for updates. Configure in Settings > Integrations.' }]
            };
        }

        try {
            const response = await fetch(`https://api.tunecore.com/v1/releases/${releaseId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.credentials.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(_updates),
            });

            return {
                success: response.ok,
                status: response.ok ? 'processing' : 'failed',
                distributorReleaseId: releaseId,
                errors: response.ok ? [] : [{ code: 'UPDATE_FAILED', message: `HTTP ${response.status}` }],
            };
        } catch (e: unknown) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'UPDATE_ERROR', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.credentials?.apiKey) {
            return 'in_review';
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/releases/${releaseId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.credentials.apiKey}`,
                    ...this.getVersionedHeaders(),
                },
            });

            if (response.ok) {
                const data = await response.json();
                const statusMap: Record<string, ReleaseStatus> = {
                    'LIVE': 'live',
                    'PENDING': 'pending_review',
                    'REVIEW': 'in_review',
                    'FAILED': 'failed',
                };
                return statusMap[data.status] || 'in_review';
            }
        } catch (e) {
            logger.warn('[TuneCore] Status check failed:', e);
        }

        return 'in_review';
    }

    async takedownRelease(_releaseId: string): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'takedown_requested'
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        const baseEarnings: DistributorEarnings = {
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

        if (!this.credentials?.apiKey) {
            return baseEarnings;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/earnings?release_id=${releaseId}&start=${period.startDate}&end=${period.endDate || ''}`, {
                headers: {
                    'Authorization': `Bearer ${this.credentials.apiKey}`,
                    ...this.getVersionedHeaders(),
                },
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    ...baseEarnings,
                    streams: data.total_streams || 0,
                    downloads: data.total_downloads || 0,
                    grossRevenue: data.gross_revenue || 0,
                    netRevenue: data.net_revenue || 0,
                    lastUpdated: new Date().toISOString()
                };
            }
        } catch (e) {
            logger.warn('[TuneCore] Earnings fetch failed:', e);
        }

        return baseEarnings;
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to TuneCore');
        }
        return await earningsService.getAllEarnings(this.id, period);
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
