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
        await new Promise((resolve) => setTimeout(resolve, 500));
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
        await new Promise(resolve => setTimeout(resolve, 1500));

        return {
            success: true,
            status: 'processing', // Simulating successful handoff
            releaseId: releaseId,
            distributorReleaseId: `INT-DK-${Date.now()}`,
            metadata: {
                estimatedLiveDate: '2025-02-01',
                upcAssigned: metadata.upc || 'PENDING_DK_BULK'
            },
        };
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) throw new Error('Not connected');
        console.log(`[DistroKid] Updating ${releaseId}`);
        return { success: true, status: 'processing', distributorReleaseId: releaseId };
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

        // PRODUCTION READY: Return 0 unless real API data is available.
        // Data should be fetched from RevenueService in the UI layer.
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

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-id', period)];
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
