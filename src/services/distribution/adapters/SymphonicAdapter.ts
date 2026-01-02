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
import { SFTPTransporter } from '../transport/SFTPTransporter';
import type { SymphonicPackageBuilder } from '../symphonic/SymphonicPackageBuilder';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';
import { delay } from '@/utils/async';

/**
 * Symphonic Adapter
 * Integration with Symphonic Distribution (DDEX/SFTP)
 */
// import { SymphonicPackageBuilder } from '../symphonic/SymphonicPackageBuilder';
// import { SFTPTransporter } from '../transporters/SFTPTransporter'; // Disabled for browser compatibility

export class SymphonicAdapter implements IDistributorAdapter {
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
            model: 'revenue_share', // Actually percentage usually
            payoutPercentage: 85,
        },
    };

    private connected = false;
    private username: string | null = null;

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.username || !credentials.password) {
            throw new Error('Symphonic requires username and password');
        }
        await delay(800);
        this.username = credentials.username;
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.username = null;
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }

        console.log('[Symphonic] Initiating release delivery:', metadata.trackTitle);
        const releaseId = `SYM-${Date.now()}`;

        try {
            // 1. Build Package
            const folderReleaseId = metadata.upc || `REL-${Date.now()}`;

            if (typeof window !== 'undefined' && window.electronAPI?.distribution) {
                console.log('[Symphonic] Delivering via Electron IPC...');
                const buildResult = await window.electronAPI.distribution.buildPackage('symphonic', metadata, assets, folderReleaseId);

                if (!buildResult.success || !buildResult.packagePath) {
                    throw new Error(`Package build failed: ${buildResult.error}`);
                }

                const { packagePath } = buildResult;
                console.log(`[Symphonic] DDEX Package built at: ${packagePath}`);
            } else {
                console.log('[Symphonic] Building package locally...');
                // Dynamic import for browser safety
                const { SymphonicPackageBuilder } = await import('../symphonic/SymphonicPackageBuilder');
                const builder = new SymphonicPackageBuilder();
                const { packagePath } = await builder.buildPackage(metadata, assets, folderReleaseId);
                console.log(`[Symphonic] DDEX Package built at: ${packagePath}`);

                // 2. Deliver via SFTP (Disabled for Browser/Mock)
                console.warn('[Symphonic] Client-side SFTP upload is not supported. This step requires a backend function.');
                console.log(`[Symphonic] Mocking upload for ${releaseId}...`);
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
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }

        console.log(`[Symphonic] Sending XML Update for ${releaseId} with changes:`, Object.keys(updates));

        const deployments = await distributionStore.getDeploymentsForRelease(releaseId);
        if (deployments.length > 0) {
            await distributionStore.updateDeploymentStatus(deployments[0].id, 'processing');
        }

        // In reality: Generate new ERN with MessageControlType=UpdateMessage
        return {
            success: true,
            status: 'processing',
            distributorReleaseId: releaseId,
        };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }
        // Mock polling
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }
        console.log(`[Symphonic] Issuing Takedown for ${releaseId}`);
        // Generate Takedown ERN
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        if (!this.connected) {
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
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        // Symphonic requires ISRC/UPC upfront
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
