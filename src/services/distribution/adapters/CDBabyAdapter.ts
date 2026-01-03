import {
    IDistributorAdapter,
    DistributorId,
    DistributorRequirements,
    ReleaseStatus,
    ReleaseResult,
    DistributorCredentials,
    DistributorEarnings,
    ValidationResult,
    ReleaseAssets,
    ExtendedGoldenMetadata,
    DateRange
} from '@/services/distribution/types/distributor';
import { ernService } from '@/services/ddex/ERNService';

export class CDBabyAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'cdbaby';
    readonly name = 'CDBaby';

    private connected = false;
    private credentials?: DistributorCredentials;

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
            colorMode: 'RGB'
        },
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['title', 'artist', 'genre', 'composer'],
            maxTitleLength: 200,
            maxArtistNameLength: 200,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 10,
            reviewTimeDays: 5,
        },
        pricing: {
            model: 'per_release',
            costPerRelease: 9.95,
            payoutPercentage: 91, // CDBaby takes 9%
        }
    };

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (credentials.username && credentials.password) {
            this.credentials = credentials;
            this.connected = true;
        } else {
            throw new Error('Invalid credentials provided for CDBaby');
        }
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        this.credentials = undefined;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CDBaby');
        }

        try {
            const ernResult = await ernService.generateERN(metadata, 'PADPIDA2014022801G', 'cdbaby', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            return {
                success: true,
                releaseId: metadata.id,
                distributorReleaseId: `CDB-${Date.now()}`,
                status: 'validating', // CDBaby has strict upfront validation
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: true,
                }
            };
        } catch (e) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        return {
            success: false,
            status: 'failed',
            errors: [{ code: 'MANUAL_intervention_REQUIRED', message: 'Contact CDBaby support for updates.' }]
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        // Mock status check
        return 'processing';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'takedown_requested'
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        // Mock Earnings Data
        return {
            distributorId: 'cdbaby',
            releaseId: releaseId,
            period: period,
            streams: Math.floor(Math.random() * 10000),
            downloads: Math.floor(Math.random() * 200),
            grossRevenue: 100.00,
            distributorFee: 9.00, // 9%
            netRevenue: 91.00,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-3', period)];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: string[] = [];
        if (!metadata.title) errors.push('Title is required');
        // CDBaby specific checks
        if (!metadata.composers || metadata.composers.length === 0) errors.push('Composer required for CDBaby');

        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'VALIDATION_ERROR', message: e, severity: 'error' }))
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: string[] = [];
        if (assets.coverArt.width < this.requirements.coverArt.minWidth) {
            errors.push(`Cover art must be at least ${this.requirements.coverArt.minWidth}px`);
        }
        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'ASSET_ERROR', message: e, severity: 'error' }))
        };
    }
}
