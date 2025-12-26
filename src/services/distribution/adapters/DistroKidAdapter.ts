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
import { DistroKidPackageBuilder } from '../distrokid/DistroKidPackageBuilder';

export class DistroKidAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'distrokid';
    readonly name = 'DistroKid';

    // Specific requirements for DistroKid
    readonly requirements: DistributorRequirements = {
        distributorId: 'distrokid',
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            maxWidth: 6000,
            maxHeight: 6000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 25 * 1024 * 1024, // 25MB
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
            isrcRequired: false, // DistroKid assigns if missing
            upcRequired: false, // DistroKid assigns if missing
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

        // Simulate API connection verification
        await new Promise((resolve) => setTimeout(resolve, 500));

        this.apiKey = credentials.apiKey;
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.apiKey = null;
        this.connected = false;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        console.log('[DistroKid] Initiating release build:', metadata.trackTitle);
        const releaseId = `DK-${Date.now()}`;

        try {
            // 1. Build Package (Simulating Bulk Upload Preparation)
            const builder = new DistroKidPackageBuilder();
            const { packagePath } = await builder.buildPackage(metadata, assets, releaseId);

            console.log(`[DistroKid] Package created at: ${packagePath}`);
            console.log('[DistroKid] Ready for manual/bulk upload tool.');

            // In a fully automated "Robot" scenario, we would now launch a browser to upload this.
            // For now, we stop at "Package Ready" and mark as Delivered (to user's local disk).

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
        return {
            success: true,
            status: 'processing',
            distributorReleaseId: releaseId,
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        // Mock status check
        // Mock status check
        return 'processing';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        console.log(`[DistroKid] Requesting takedown for ${releaseId}`);
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        // Mock earnings response
        return {
            distributorId: this.id,
            releaseId,
            period,
            streams: 15420,
            downloads: 45,
            grossRevenue: 125.50,
            distributorFee: 0, // 100% payout
            netRevenue: 125.50,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString(),
            breakdown: [
                { platform: 'Spotify', territoryCode: 'US', streams: 10000, downloads: 0, revenue: 40.00 },
                { platform: 'Apple Music', territoryCode: 'US', streams: 5000, downloads: 0, revenue: 80.00 },
                { platform: 'iTunes', territoryCode: 'US', streams: 0, downloads: 45, revenue: 5.50 },
            ],
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-id', period)];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];

        // Basic validation based on DistroKid requirements
        if (!metadata.trackTitle) {
            errors.push({ code: 'MISSING_TITLE', message: 'Release title (trackTitle) is required', field: 'trackTitle', severity: 'error' });
        }

        if (!metadata.artistName) {
            errors.push({ code: 'MISSING_ARTIST', message: 'Primary artist is required', field: 'artistName', severity: 'error' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];

        // Check Audio
        if (assets.audioFile.sizeBytes > 500 * 1024 * 1024) { // 500MB limit for example
            errors.push({ code: 'FILE_TOO_LARGE', message: 'Audio file exceeds maximum size', field: 'audioFile', severity: 'error' });
        }

        // Check Cover Art
        if (assets.coverArt.width < this.requirements.coverArt.minWidth || assets.coverArt.height < this.requirements.coverArt.minHeight) {
            errors.push({ code: 'IMAGE_TOO_SMALL', message: `Cover art must be at least ${this.requirements.coverArt.minWidth}x${this.requirements.coverArt.minHeight}`, field: 'coverArt', severity: 'error' });
        }

        if (assets.coverArt.width !== assets.coverArt.height) {
            errors.push({ code: 'INVALID_ASPECT_RATIO', message: 'Cover art must be perfectly square (1:1)', field: 'coverArt', severity: 'error' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
