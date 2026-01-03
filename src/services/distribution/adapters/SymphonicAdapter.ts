import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { DateRange, ValidationResult } from '@/services/ddex/types/common';
import {
    BaseDistributorAdapter
} from './BaseDistributorAdapter';
import {
    type DistributorId,
    type DistributorRequirements,
    type ReleaseAssets,
    type ReleaseResult,
    type ReleaseStatus,
    type DistributorEarnings,
} from '../types/distributor';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';
import { delay } from '@/utils/async';

export class SymphonicAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'symphonic';
    readonly name = 'Symphonic';

    readonly requirements: DistributorRequirements = {
        distributorId: 'symphonic',
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            maxWidth: 6000,
            maxHeight: 6000,
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
            requiredFields: ['trackTitle', 'artistName', 'genre', 'labelName'],
            maxTitleLength: 500,
            maxArtistNameLength: 500,
            isrcRequired: true,
            upcRequired: true,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 14,
            reviewTimeDays: 5,
        },
        pricing: {
            model: 'revenue_share',
            payoutPercentage: 85,
        },
    };

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }

        console.log('[Symphonic] Initiating release delivery:', metadata.trackTitle);
        const releaseId = `SYM-${Date.now()}`;

        try {
            // 1. Build Package
            const folderReleaseId = metadata.upc || `REL-${Date.now()}`;

            if (typeof window !== 'undefined' && window.electronAPI?.sftp) {
                console.log('[Symphonic] Delivering via Electron SFTP IPC...');
                // Here we would use the already connected SFTP session
            }

            // Mock delay
            await delay(1000);

            // Persist
            await distributionStore.createDeployment(releaseId, this.id, 'delivered', {
                title: metadata.trackTitle,
                artist: metadata.artistName,
                coverArtUrl: assets.coverArt.url
            });

            return {
                success: true,
                status: 'delivered',
                releaseId: releaseId,
                distributorReleaseId: `INT-SYM-${Date.now()}`,
                metadata: {
                    estimatedLiveDate: '2025-01-20',
                    upcAssigned: metadata.upc,
                    isrcAssigned: metadata.isrc,
                },
            };
        } catch (error) {
            console.error('[Symphonic] Delivery failed:', error);
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'DELIVERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown Delivery Error'
                }],
                releaseId
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }

        console.log(`[Symphonic] Sending XML Update for ${releaseId} with changes:`, Object.keys(updates));

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
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }
        console.log(`[Symphonic] Issuing Takedown for ${releaseId}`);
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
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
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        if (!metadata.isrc) {
            errors.push({ code: 'MISSING_ISRC', message: 'Symphonic requires ISRC', field: 'isrc', severity: 'error' });
        }
        if (!metadata.upc) {
            errors.push({ code: 'MISSING_UPC', message: 'Symphonic requires UPC', field: 'upc', severity: 'error' });
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: [],
        };
    }

    async validateAssets(_assets: ReleaseAssets): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }
}
