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
 * CD Baby Adapter
 * Integration with CD Baby (Direct/API)
 */
// import { CDBabyPackageBuilder } from '../cdbaby/CDBabyPackageBuilder';

export class CDBabyAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'cdbaby';
    readonly name = 'CD Baby';

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
            model: 'pay-per-release',
            feePerRelease: 9.99,
            payoutPercentage: 91,
        },
    };

    private connected = false;
    private username: string | null = null;

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
        this.username = null;
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, _assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }

        console.log(`[CD Baby] Starting release process for: ${metadata.trackTitle}`);
        const releaseId = `CDB-${Date.now()}`;

        try {
            // Mocking package creation process
            console.log('[CD Baby] Package creation simulated.');

            // In browser environment, we can't use fs-based package builder or SFTP directly.
            // This logic should be moved to a backend Cloud Function.
            // For now, we mock the success to unblock the frontend build.

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

        return {
            distributorId: this.id,
            releaseId,
            period,
            streams: 8500,
            downloads: 120,
            grossRevenue: 95.00,
            distributorFee: 8.55, // 9%
            netRevenue: 86.45,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString(),
            breakdown: [],
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-id', period)];
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
