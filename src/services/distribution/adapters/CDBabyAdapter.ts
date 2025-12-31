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
import type { CDBabyPackageBuilder } from '../cdbaby/CDBabyPackageBuilder';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';

/**
 * CD Baby Adapter
 * Integration with CD Baby (Direct/API)
 */
export class CDBabyAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'cdbaby';
    readonly name: string = 'CD Baby';

    private connected: boolean = false;
    private username: string | null = null;
    private transporter: SFTPTransporter;
    private builder: CDBabyPackageBuilder | null = null;

    readonly requirements: DistributorRequirements = {
        distributorId: 'cdbaby',
        coverArt: {
            minWidth: 1400,
            minHeight: 1400,
            maxWidth: 4000,
            maxHeight: 4000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 10 * 1024 * 1024,
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
            minLeadTimeDays: 5,
            reviewTimeDays: 5,
        },
        pricing: {
            model: 'per_release',
            costPerRelease: 9.99,
            payoutPercentage: 91,
        },
    };

    constructor() {
        this.transporter = new SFTPTransporter();
        // Builder is lazy-loaded to avoid bundling fs modules in browser
    }

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.username) {
            throw new Error('CD Baby requires a username');
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
        this.username = credentials.username;
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        if (await this.transporter.isConnected()) {
            await this.transporter.disconnect();
        }
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, _assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }

        console.log(`[CD Baby] Starting release process for: ${metadata.trackTitle}`);
        const releaseId = `CDB-${Date.now()}`;

        try {
            // Internal release ID for folder naming if UPC is missing
            const folderReleaseId = metadata.upc || `REL-${Date.now()}`;

            // Package building via IPC (Hybrid Safety)
            if (typeof window !== 'undefined' && window.electronAPI?.distribution) {
                console.log('[CD Baby] Building package via Main Process...');
                // @ts-ignore - assets might be unused or passed
                const buildResult = await window.electronAPI.distribution.buildPackage('cdbaby', metadata, _assets, folderReleaseId);

                if (!buildResult.success || !buildResult.packagePath) {
                    throw new Error(`Package build failed: ${buildResult.error}`);
                }

                const { packagePath } = buildResult;
                console.log(`[CD Baby] Package built at: ${packagePath}`);
                console.log(`[CD Baby] Delivering via Electron IPC...`);
            } else {
                console.log('[CD Baby] Building package locally...');
                // Dynamic import to avoid browser bundling issues
                const { CDBabyPackageBuilder } = await import('../cdbaby/CDBabyPackageBuilder');
                this.builder = new CDBabyPackageBuilder();
                const { packagePath } = await this.builder.buildPackage(metadata, _assets, folderReleaseId);
                console.log(`[CD Baby] Package built at: ${packagePath}`);
                console.warn('[CD Baby] Client-side SFTP upload is not supported. This step requires a backend function.');
                console.log(`[CD Baby] Mocking upload for ${releaseId}...`);
            }

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Persist
            await distributionStore.createDeployment(releaseId, this.id, 'delivered', {
                title: metadata.trackTitle,
                artist: metadata.artistName,
                coverArtUrl: _assets?.coverArt?.url
            });

            return {
                success: true,
                status: 'delivered',
                releaseId: releaseId,
                distributorReleaseId: `INT-CDB-${Date.now()}`,
                metadata: {
                    estimatedLiveDate: '2025-01-18',
                    upcAssigned: metadata.upc || 'PENDING_CDB',
                    isrcAssigned: metadata.isrc || 'PENDING_CDB',
                },
            };
        } catch (error) {
            console.error('[CD Baby] Submission failed:', error);
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'SUBMISSION_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown Submission Error'
                }],
                releaseId
            };
        }
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }
        console.log(`[CD Baby] Updating ${releaseId}`);

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
            throw new Error('Not connected to CD Baby');
        }
        return 'processing';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
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
            throw new Error('Not connected to CD Baby');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(_metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        return {
            isValid: true, // Simple mock validation
            errors: [],
            warnings: [],
        };
    }

    async validateAssets(_assets: ReleaseAssets): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }
}
