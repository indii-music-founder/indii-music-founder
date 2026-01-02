import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { DateRange, ValidationResult } from '@/services/ddex/types/common';
import {
    type IDistributorAdapter,
    type DistributorId,
    type DistributorRequirements,
    type DistributorCredentials,
    type ReleaseAssets,
    type ReleaseResult,
    type ReleaseStatus,
    type DistributorEarnings,
} from '../types/distributor';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';
import { delay } from '@/utils/async';

/**
 * TuneCore Adapter
 * Integration with TuneCore (API Based)
 */

export class TuneCoreAdapter implements IDistributorAdapter {
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
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB',
        },
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre'],
            maxTitleLength: 255,
            maxArtistNameLength: 255,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 7,
            reviewTimeDays: 2,
        },
        pricing: {
            model: 'subscription',
            annualFee: 14.99,
            payoutPercentage: 100,
        },
    };

    private connected = false;
    private apiKey: string | null = null;

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.apiKey) {
            throw new Error('TuneCore requires an API key');
        }
        await delay(500);
        this.apiKey = credentials.apiKey;
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.apiKey = null;
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, _assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }

        console.log(`[TuneCore] Initiating API transmission for: ${metadata.trackTitle}`);
        const releaseId = `TC-${Date.now()}`;

        try {
            // Mock API call
            console.log('[TuneCore] API payload sent.');

            // Persist
            await distributionStore.createDeployment(releaseId, this.id, 'processing', {
                title: metadata.trackTitle,
                artist: metadata.artistName,
                coverArtUrl: _assets?.coverArt?.url
            });

            return {
                success: true,
                status: 'processing',
                releaseId: releaseId,
                distributorReleaseId: `INT-TC-${Date.now()}`,
                metadata: {
                    estimatedLiveDate: '2025-01-22',
                    upcAssigned: metadata.upc || 'PENDING_TC',
                    isrcAssigned: metadata.isrc || 'PENDING_TC',
                },
            };
        } catch (error) {
            console.error('[TuneCore] API call failed:', error);
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'API_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown API Error'
                }],
                releaseId
            };
        }
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        console.log(`[TuneCore] Updating release ${releaseId}`);

        const deployments = await distributionStore.getDeploymentsForRelease(releaseId);
        if (deployments.length > 0) {
            await distributionStore.updateDeploymentStatus(deployments[0].id, 'processing');
        }

        return {
            success: true,
            status: 'processing',
            distributorReleaseId: releaseId,
        };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        return 'processing';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }

        const earnings = await earningsService.getEarnings(this.id, releaseId, period);

        if (!earnings) {
            return {
                distributorId: this.id,
                releaseId,
                period,
                streams: 0,
                downloads: 0,
                grossRevenue: 0,
                distributorFee: 0,
                netRevenue: 0,
                currencyCode: 'USD',
                lastUpdated: new Date().toISOString(),
                breakdown: [],
            };
        }
        return earnings;
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(_metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        return {
            isValid: true,
            errors: [],
            warnings: [],
        };
    }

    async validateAssets(_assets: ReleaseAssets): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }
}
