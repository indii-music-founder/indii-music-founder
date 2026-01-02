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

/**
 * DistroKid Adapter
 * Integration with DistroKid (Simulated Bulk Upload)
 */
// import type { DistroKidPackageBuilder } from '../distrokid/DistroKidPackageBuilder';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';
import { delay } from '@/utils/async';

export class DistroKidAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'distrokid';
    readonly name = 'DistroKid';

    readonly requirements: DistributorRequirements = {
        distributorId: 'distrokid',
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            maxWidth: 6000,
            maxHeight: 6000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 25 * 1024 * 1024,
            colorMode: 'RGB',
        },
        audio: {
            allowedFormats: ['wav', 'flac', 'mp3'],
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
            annualFee: 19.99,
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
            throw new Error('DistroKid requires an API key');
        }
        await delay(500);
        this.apiKey = credentials.apiKey;
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.apiKey = null;
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) throw new Error('Not connected');

        console.log('[DistroKid] Initiating release build:', metadata.trackTitle);
        const releaseId = `DK-${Date.now()}`;

        // Simulate upload delay
        await delay(1500);

        try {
            // 1. Build Package (Simulating Bulk Upload Preparation)
            const { DistroKidPackageBuilder } = await import('../distrokid/DistroKidPackageBuilder');
            const builder = new DistroKidPackageBuilder();
            const { packagePath } = await builder.buildPackage(metadata, assets, releaseId);

            console.log(`[DistroKid] Package created at: ${packagePath}`);
            console.log('[DistroKid] Ready for manual/bulk upload tool.');

            // Persist deployment
            await distributionStore.createDeployment(
                releaseId,
                this.id,
                'delivered',
                {
                    title: metadata.trackTitle,
                    artist: metadata.artistName,
                    coverArtUrl: assets.coverArt.url
                }
            );

            return {
                success: true,
                status: 'delivered', // Using 'delivered' to indicate package is ready on disk
                releaseId: releaseId,
                distributorReleaseId: `INT-DK-${Date.now()}`,
                metadata: {
                    estimatedLiveDate: '2025-01-15',
                    upcAssigned: metadata.upc || 'PENDING_BULK',
                    isrcAssigned: metadata.isrc || 'PENDING_BULK',
                },
            };
        } catch (error) {
            console.error('[DistroKid] Build failed:', error);
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'BUILD_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown Build Error'
                }],
                releaseId
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        console.log(`[DistroKid] Updating release ${releaseId}`);

        const deployments = await distributionStore.getDeploymentsForRelease(releaseId);
        if (deployments.length > 0) {
            await distributionStore.updateDeploymentStatus(deployments[0].id, 'processing');
        }

        return {
            success: true,
            status: 'processing',
            releaseId: releaseId,
            distributorReleaseId: `INT-DK-${Date.now()}`,
            metadata: {
                estimatedLiveDate: '2025-02-01',
                upcAssigned: updates.upc || 'PENDING_DK_BULK'
            },
        };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) throw new Error('Not connected');
        return 'processing';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) throw new Error('Not connected');
        return { success: true, status: 'takedown_requested', distributorReleaseId: releaseId };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        if (!this.connected) throw new Error('Not connected');

        const earnings = await earningsService.getEarnings(this.id, releaseId, period);

        if (!earnings) {
            // Return zeroed structure if no data found (instead of mock data)
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
            throw new Error('Not connected to DistroKid');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        if (!metadata.trackTitle) errors.push({ code: 'MISSING_TITLE', message: 'Title required', field: 'trackTitle', severity: 'error' });
        return { isValid: errors.length === 0, errors, warnings: [] };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const valid = !!assets.audioFile || (assets.audioFiles && assets.audioFiles.length > 0);
        return { isValid: valid, errors: valid ? [] : [{ code: 'NO_AUDIO', message: 'Audio missing', field: 'audio', severity: 'error' }], warnings: [] };
    }
}
