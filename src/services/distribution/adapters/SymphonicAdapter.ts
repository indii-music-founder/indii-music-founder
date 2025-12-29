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
import { SymphonicPackageBuilder } from '../symphonic/SymphonicPackageBuilder';
// import { SFTPTransporter } from '../transport/SFTPTransporter';

/**
 * Symphonic Adapter
 * Integration with Symphonic Distribution API (Stub)
 */
export class SymphonicAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'symphonic';
    readonly name = 'Symphonic Distribution';

    // Specific requirements for Symphonic based on research
    readonly requirements: DistributorRequirements = {
        distributorId: 'symphonic',
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            maxWidth: 10000,
            maxHeight: 10000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg'], // Strictly JPEG
            maxSizeBytes: 50 * 1024 * 1024, // 50MB
            colorMode: 'RGB', // CMYK not allowed
        },
        audio: {
            allowedFormats: ['wav', 'flac', 'aiff'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100, // 44.1 - 192kHz supported
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre', 'labelName', 'pLineYear', 'cLineText'],
            maxTitleLength: 255,
            maxArtistNameLength: 255,
            isrcRequired: true, // Often required by pro-distributors or highly recommended
            upcRequired: false,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 14, // Recommended 2-4 weeks
            reviewTimeDays: 3, // Selective process
        },
        pricing: {
            model: 'revenue_share', // Percentage based usually
            payoutPercentage: 85, // Varies by deal, assuming 85/15 split mock
        },
    };

    private connected = false;
    private apiKey: string | null = null;
    private partnerId: string | null = null;

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.apiKey) {
            throw new Error('Symphonic requires an API Key');
        }

        // Simulate API connection verification
        await new Promise((resolve) => setTimeout(resolve, 600));

        this.apiKey = credentials.apiKey;
        this.partnerId = credentials.accountId || 'mock-partner-id';
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.apiKey = null;
        this.partnerId = null;
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
            const builder = new SymphonicPackageBuilder();
            const { packagePath } = await builder.buildPackage(metadata, assets, releaseId);

            // 2. Transmit via SFTP
            // In a real app, these creds come from secure storage / initialized instance
            console.log('[Symphonic] SFTP Transport disabled in browser. Mocking delivery.');

            // Mock delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            return {
                success: true,
                status: 'delivered',
                releaseId: releaseId,
                distributorReleaseId: `INT-${Date.now()}`,
                metadata: {
                    estimatedLiveDate: '2025-02-15',
                    upcAssigned: metadata.upc || 'PENDING',
                    isrcAssigned: metadata.isrc || 'PENDING',
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

        return {
            success: true,
            status: 'processing',
            distributorReleaseId: releaseId,
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }

        // Mock status - Symphonic reviews content
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to Symphonic');
        }

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

        // Mock earnings response for revenue share model
        const gross = 500.00;
        const fee = gross * 0.15; // 15% hypothetical commission

        return {
            distributorId: this.id,
            releaseId,
            period,
            streams: 65000,
            downloads: 300,
            grossRevenue: gross,
            distributorFee: fee,
            netRevenue: gross - fee,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString(),
            breakdown: [
                { platform: 'Spotify', territoryCode: 'Global', streams: 40000, downloads: 0, revenue: 160.00 },
                { platform: 'Apple Music', territoryCode: 'Global', streams: 15000, downloads: 0, revenue: 150.00 },
                { platform: 'Beatport', territoryCode: 'Global', streams: 0, downloads: 300, revenue: 190.00 },
            ],
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-id', period)];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];

        if (!metadata.trackTitle) {
            errors.push({ code: 'MISSING_TITLE', message: 'Release title is required', field: 'trackTitle', severity: 'error' });
        }

        if (!metadata.artistName) {
            errors.push({ code: 'MISSING_ARTIST', message: 'Primary artist is required', field: 'artistName', severity: 'error' });
        }

        if (!metadata.labelName) {
            errors.push({ code: 'MISSING_LABEL', message: 'Label name is required for Symphonic', field: 'labelName', severity: 'error' });
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
        if (!['wav', 'flac', 'aiff'].includes(assets.audioFile.format)) {
            errors.push({ code: 'INVALID_AUDIO_FORMAT', message: 'Symphonic requires WAV, FLAC, or AIFF', field: 'audioFile', severity: 'error' });
        }

        if (assets.audioFile.bitDepth < 16) {
            errors.push({ code: 'LOW_BIT_DEPTH', message: 'Minimum 16-bit audio required', field: 'audioFile', severity: 'error' });
        }

        // Check Cover Art
        if (assets.coverArt.width < this.requirements.coverArt.minWidth) {
            errors.push({ code: 'IMAGE_TOO_SMALL', message: `Cover art must be at least ${this.requirements.coverArt.minWidth}px`, field: 'coverArt', severity: 'error' });
        }

        if (assets.coverArt.width !== assets.coverArt.height) {
            errors.push({ code: 'INVALID_ASPECT_RATIO', message: 'Cover art must be strictly 1:1', field: 'coverArt', severity: 'error' });
        }

        if (assets.coverArt.mimeType !== 'image/jpeg' && assets.coverArt.mimeType !== 'image/jpg') {
            errors.push({ code: 'INVALID_IMAGE_FORMAT', message: 'Cover art must be JPEG', field: 'coverArt', severity: 'error' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
