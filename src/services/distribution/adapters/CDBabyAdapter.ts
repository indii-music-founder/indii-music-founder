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
import { CDBabyPackageBuilder } from '../cdbaby/CDBabyPackageBuilder';
import { SFTPTransporter } from '../transport/SFTPTransporter';
import * as path from 'path';

/**
 * Adapter for CD Baby
 * Strategy: DDEX with SFTP
 * Uses CDBabyPackageBuilder to generate DDEX ERN and SFTPTransporter for delivery.
 */
export class CDBabyAdapter implements IDistributorAdapter {
    readonly id: DistributorId = 'cdbaby';
    readonly name: string = 'CD Baby';

    private connected: boolean = false;
    private transporter: SFTPTransporter;
    private builder: CDBabyPackageBuilder;
    private credentials?: DistributorCredentials;

    readonly requirements: DistributorRequirements = {
        distributorId: 'cdbaby',
        coverArt: {
            minWidth: 1400,
            minHeight: 1400,
            maxWidth: 3000,
            maxHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB'
        },
        audio: {
            allowedFormats: ['wav', 'flac', 'mp3'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo'
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre'],
            maxTitleLength: 255,
            maxArtistNameLength: 255,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: true
        },
        timing: {
            minLeadTimeDays: 5,
            reviewTimeDays: 2
        },
        pricing: {
            model: 'per_release',
            costPerRelease: 9.99,
            payoutPercentage: 91
        }
    };

    constructor() {
        this.transporter = new SFTPTransporter();
        this.builder = new CDBabyPackageBuilder();
    }

    async isConnected(): Promise<boolean> {
        return this.connected;
    }

    async connect(credentials: DistributorCredentials): Promise<void> {
        if (!credentials.apiKey && !credentials.accessToken) {
            throw new Error('CD Baby requires API Key (for SFTP simulation)');
        }

        this.credentials = credentials;

        // In a real scenario, we might test SFTP connection here
        // For simulation, we assume valid if key is present

        this.connected = true;

        // Use apiKey/accountId as proxy for username/password in simulation
        const username = this.credentials?.accountId || 'simulated_user';

        console.log(`[CD Baby] Connected. Ready to transmit as ${username}.`);
    }

    async disconnect(): Promise<void> {
        if (this.transporter.isConnected()) {
            await this.transporter.disconnect();
        }
        this.connected = false;
        this.credentials = undefined;
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }

        console.log(`[CD Baby] Starting release process for: ${metadata.trackTitle}`);

        // 1. Validate
        // (Simplified for MVP, would normally check strict DDEX reqs)

        // 2. Build DDEX Package
        console.log('[CD Baby] Building DDEX Package...');

        try {
            // Internal release ID for folder naming if UPC is missing
            const releaseId = metadata.upc || `REL-${Date.now()}`;
            // Correct usage of buildPackage based on CDBabyPackageBuilder definition
            const { packagePath, files } = await this.builder.buildPackage(metadata, assets, releaseId);

            // 3. Transmit via SFTP
            // Configure transporter with simulated credentials from connect()
            await this.transporter.connect({
                host: 'sftp.cdbaby.com',
                port: 22,
                username: this.credentials?.accountId || 'simulated_user',
                password: this.credentials?.apiKey || 'simulated_pass'
            });

            // Target directory is usually /upload or /incoming/{partyId}
            const remotePath = `/upload/${metadata.upc || releaseId}`;

            console.log(`[CD Baby] Uploading ${files.length} files from ${packagePath}...`);
            await this.transporter.uploadDirectory(packagePath, remotePath);

            await this.transporter.disconnect();

            return {
                success: true,
                status: 'delivered',  // DDEX Delivered
                releaseId: `IND-${metadata.upc}`, // Internal Reference
                metadata: {
                    reviewRequired: true,
                    estimatedLiveDate: this.calculateLiveDate(metadata.releaseDate)
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during delivery';
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'DELIVERY_ERROR',
                    message: errorMessage
                }]
            };
        }
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata, _assets?: ReleaseAssets): Promise<ValidationResult> {
        // CD Baby specific validations could go here
        return { isValid: true, errors: [], warnings: [] };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }
        // Simulated
        return 'validating';
    }

    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }
        // DDEX Update (New ReleaseMessage with UpdateIndicator)
        console.log(`[CD Baby] Sending Update message for ${releaseId}`);
        return {
            success: true,
            status: 'processing',
            releaseId: releaseId
        };
    }

    async takedownRelease(_releaseId: string): Promise<ReleaseResult> {
        if (!this.connected) {
            throw new Error('Not connected to CD Baby');
        }
        // DDEX Takedown (New ReleaseMessage with TakedownIndicator)
        console.log(`[CD Baby] Sending Takedown message for ${_releaseId}`);
        return {
            success: true,
            status: 'takedown_requested',
            releaseId: _releaseId
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
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

    private calculateLiveDate(releaseDate?: string): string {
        const d = releaseDate ? new Date(releaseDate) : new Date();
        d.setDate(d.getDate() + 5); // 5 days lead time
        return d.toISOString().split('T')[0];
    }
}
