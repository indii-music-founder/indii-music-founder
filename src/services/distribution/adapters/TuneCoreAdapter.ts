import {
    IDistributorAdapter,
    DistributorId,
    DistributorRequirements,
    DistributorEarnings,
    ReleaseResult,
    ReleaseStatus,
    ReleaseAssets,
    DistributorCredentials,
    ValidationResult
} from '../types/distributor';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DateRange } from '@/services/ddex/types/common';

/**
 * Adapter for TuneCore
 * Strategy: Simulated REST API Integration
 * Since TuneCore uses a REST API for B2B partners, we simulate HTTP requests.
 */
export class TuneCoreAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'tunecore';
    readonly name: string = 'TuneCore';

    private connected: boolean = false;
    private accessToken: string | null = null;

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
            colorMode: 'RGB'
        },
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo'
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre'],
            maxTitleLength: 255,
            maxArtistNameLength: 255,
            isrcRequired: false, // They can assign
            upcRequired: false,
            genreRequired: true,
            languageRequired: true
        },
        timing: {
            minLeadTimeDays: 7,
            reviewTimeDays: 2
        },
        pricing: {
            model: 'subscription',
            annualFee: 14.99,
            payoutPercentage: 100
        }
    };

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.accessToken && !credentials.apiKey) {
            throw new Error('TuneCore requires Access Token or API Key');
        }

        // Simulate OAuth validation
        this.accessToken = credentials.accessToken || credentials.apiKey || null;
        this.connected = true;

        console.log('[TuneCore] Connected.');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        this.accessToken = null;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }

        console.log(`[TuneCore] Initiating API transmission for: ${metadata.trackTitle}`);

        // 1. Validate
        const validation = await this.validateMetadata(metadata);
        if (!validation.isValid) {
            return {
                success: false,
                status: 'failed',
                errors: validation.errors
            };
        }

        // 2. Build Payload (Simulated)
        const payload = this.buildApiPayload(metadata, assets);

        // 3. Simulate Request
        try {
            await this.simulateApiRequest('POST', '/v1/releases', payload);

            // Success response
            return {
                success: true,
                status: 'delivered', // Delivered to API
                releaseId: `TC-${Date.now()}`,
                metadata: {
                    reviewRequired: true,
                    estimatedLiveDate: this.calculateLiveDate(metadata.releaseDate)
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'API_ERROR',
                    message: errorMessage
                }]
            };
        }
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata, _assets?: ReleaseAssets): Promise<ValidationResult> {
        const errors: { code: string; message: string; field: string; severity: 'error' }[] = [];

        if (!metadata.trackTitle) {
            errors.push({
                code: 'MISSING_TITLE',
                message: 'Track title is required',
                field: 'trackTitle',
                severity: 'error'
            });
        }

        if (!metadata.genre) {
            errors.push({
                code: 'MISSING_GENRE',
                message: 'Genre is required',
                field: 'genre',
                severity: 'error'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }

    async validateAssets(_assets: ReleaseAssets): Promise<ValidationResult> {
        // Basic check
        return { isValid: true, errors: [], warnings: [] };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        // Simulated polling
        return 'in_review';
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        // Simulate PATCH request
        console.log(`[TuneCore] PATCH /v1/releases/${releaseId}`);
        return {
            success: true,
            status: 'processing',
            releaseId: releaseId
        };
    }

    async takedownRelease(_releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to TuneCore');
        }
        // Simulate DELETE request
        console.log(`[TuneCore] DELETE /v1/releases/${_releaseId}`);
        return {
            success: true,
            status: 'takedown_requested',
            releaseId: _releaseId
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        // Mock implementation for now
        return {
            releaseId,
            distributorId: this.id,
            period,
            streams: 0,
            downloads: 0,
            grossRevenue: 0,
            distributorFee: 0,
            netRevenue: 0,
            currencyCode: 'USD',
            breakdown: [],
            lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        // Mock implementation to match getEarnings behavior and ensure consistency
        // This acts as a placeholder for real API integration later.
        return [{
            releaseId: 'mock-release-id',
            distributorId: this.id,
            period,
            streams: 0,
            downloads: 0,
            grossRevenue: 0,
            distributorFee: 0,
            netRevenue: 0,
            currencyCode: 'USD',
            breakdown: [],
            lastUpdated: new Date().toISOString()
        }];
    }

    // --- Private Helpers ---

    private buildApiPayload(metadata: ExtendedGoldenMetadata, _assets: ReleaseAssets): Record<string, unknown> {
        return {
            title: metadata.trackTitle,
            artist: metadata.artistName,
            genre: metadata.genre,
            upc: metadata.upc || 'auto',
            isrc: metadata.isrc || 'auto',
            release_date: metadata.releaseDate,
            territories: metadata.territories,
            // Format assets for "upload"
            assets: [
                { type: 'audio', format: 'wav', size: 10000 },
                { type: 'cover', format: 'jpg', size: 5000 }
            ]
        };
    }

    private async simulateApiRequest(method: string, endpoint: string, body: unknown): Promise<void> {
        console.log(`[TuneCore] ${method} ${endpoint}`, JSON.stringify(body, null, 2).substring(0, 100) + '...');
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 800));

        // Random failure simulation (disabled for reliable tests)
        // if (Math.random() > 0.9) throw new Error('API Timeout');
    }

    private calculateLiveDate(releaseDate?: string): string {
        const d = releaseDate ? new Date(releaseDate) : new Date();
        d.setDate(d.getDate() + 7); // 7 days review
        return d.toISOString().split('T')[0];
    }
}
