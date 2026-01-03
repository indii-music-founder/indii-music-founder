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

export class DistroKidAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'distrokid';
    readonly name = 'DistroKid';

    private connected = false;
    private credentials?: DistributorCredentials;

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
            colorMode: 'RGB'
        },
        audio: {
            allowedFormats: ['wav'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['title', 'artist', 'genre'],
            maxTitleLength: 200,
            maxArtistNameLength: 100,
            isrcRequired: false, // DistroKid assigns ISRCs
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
        }
    };

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        // Mock connection - in reality would validate API key if available, or SFTP creds
        if (credentials.apiKey || credentials.sftpHost) {
            this.credentials = credentials;
            this.connected = true;
        } else {
            throw new Error('Invalid credentials provided for DistroKid');
        }
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        this.credentials = undefined;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to DistroKid');
        }

        try {
            // 1. Generate DDEX ERN
            const ernResult = await ernService.generateERN(metadata, 'PADPIDA2014022801G', 'distrokid', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            // 2. Mock Transmission (SFTP Upload)
            // console.log('[DistroKid] Uploading ERN to SFTP...', ernResult.xml.substring(0, 100) + '...');
            // console.log('[DistroKid] Uploading Assets...', assets.audioFiles.length, 'audio files');

            // 3. Return Pending Status
            return {
                success: true,
                releaseId: metadata.id, // Internal ID
                distributorReleaseId: `DK-${Date.now()}`,
                status: 'processing',
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: false,
                    isrcAssigned: 'US-DK1-25-00001', // Mock
                    upcAssigned: '123456789012', // Mock
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
        // DistroKid often requires full takedown and re-upload for metadata changes, specific logic here
        return {
            success: false,
            status: 'failed',
            errors: [{ code: 'NOT_SUPPORTED', message: 'Updates not supported, please issue a takedown and new release.' }]
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        // Mock status check
        return 'live';
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
            distributorId: 'distrokid',
            releaseId: releaseId,
            period: period,
            streams: Math.floor(Math.random() * 50000),
            downloads: Math.floor(Math.random() * 100),
            grossRevenue: 150.00,
            distributorFee: 0, // 100% Payout
            netRevenue: 150.00,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        return [await this.getEarnings('mock-release-1', period)];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        // Basic validation against requirements
        const errors: string[] = [];
        if (!metadata.title) errors.push('Title is required');
        if (!metadata.primaryArtist) errors.push('Artist is required');

        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'VALIDATION_ERROR', message: e, severity: 'error' }))
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: string[] = [];
        // Check Cover Art
        if (assets.coverArt.width < this.requirements.coverArt.minWidth) {
            errors.push(`Cover art must be at least ${this.requirements.coverArt.minWidth}px`);
        }
        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'ASSET_ERROR', message: e, severity: 'error' }))
        };
    }
}
