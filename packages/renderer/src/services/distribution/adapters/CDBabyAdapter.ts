import {
    BaseDistributorAdapter
} from './BaseDistributorAdapter';
import {
    DistributorId,
    DistributorRequirements,
    ReleaseStatus,
    ReleaseResult,
    DistributorEarnings,
    ValidationResult,
    ReleaseAssets,
    ExtendedGoldenMetadata,
    DateRange
} from '@/services/distribution/types/distributor';
import { ernService } from '@/services/ddex/ERNService';
import { DDEX_CONFIG } from '@/core/config/ddex';
import { logger } from '@/utils/logger';

export class CDBabyAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'cdbaby';
    readonly name = 'CDBaby';

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
            requiredFields: ['trackTitle', 'artistName', 'genre', 'composer'],
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

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to CDBaby');
        }

        try {
            // 1. Generate DDEX ERN
            const ernResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'cdbaby', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            // 2. Map Files for Staging
            if (window.electronAPI?.distribution?.stageRelease) {
                logger.info('[CDBaby] Staging release files...');

                const files: { type: 'content' | 'path'; data: string; name: string }[] = [
                    { type: 'content', data: ernResult.xml!, name: 'batch.xml' }
                ];

                let resourceCounter = 1;

                // 2a. Map Audio
                const tracks = (metadata.tracks && metadata.tracks.length > 0) ? metadata.tracks : [metadata];
                tracks.forEach((track, index) => {
                    const ref = `A${resourceCounter++}`;
                    let assetObj = assets.audioFiles.find(a => a.trackIndex === index) || assets.audioFiles[index];
                    if (!assetObj && index === 0 && assets.audioFile) {
                        assetObj = { ...assets.audioFile, trackIndex: 0 };
                    }

                    if (assetObj) {
                        const ext = assetObj.format || 'wav';
                        files.push({
                            type: 'path',
                            data: assetObj.url,
                            name: `${ref}.${ext}`
                        });
                    }
                });

                // 2b. Map Cover Art
                if (assets.coverArt) {
                    const ref = `IMG${resourceCounter++}`;
                    const ext = assets.coverArt.url.split('.').pop() || 'jpg';
                    files.push({
                        type: 'path',
                        data: assets.coverArt.url,
                        name: `${ref}.${ext}`
                    });
                }

                // 3. Stage Files
                const releaseId = metadata.id || `CDB-${Date.now()}`;
                const stagingValues = await window.electronAPI.distribution.stageRelease(releaseId, files);

                if (!stagingValues.success || !stagingValues.packagePath) {
                    throw new Error(stagingValues.error || 'Failed to stage CDBaby release locally');
                }

                logger.info(`[CDBaby] Files staged at ${stagingValues.packagePath}.`);

                // 4. Transmission (Simulation for now, or real if SFTP credentials exist)
                if (this.credentials?.sftpHost) {
                    await this.uploadBundle(stagingValues.packagePath, `/upload/${releaseId}`);
                }

                return {
                    success: true,
                    releaseId: releaseId,
                    distributorReleaseId: `CDB-${releaseId}`,
                    status: 'validating',
                    metadata: {
                        estimatedLiveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                        reviewRequired: true,
                        packagePath: stagingValues.packagePath
                    }
                };
            }

            // Fallback for non-Electron environment
            return {
                success: true,
                releaseId: metadata.id,
                distributorReleaseId: `CDB-${Date.now()}`,
                status: 'validating',
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: true,
                }
            };
        } catch (e: unknown) {
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(_releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        return {
            success: false,
            status: 'failed',
            errors: [{ code: 'MANUAL_INTERVENTION_REQUIRED', message: 'Contact CDBaby support for updates.' }]
        };
    }

    async getReleaseStatus(_releaseId: string): Promise<ReleaseStatus> {
        return 'processing';
    }

    async takedownRelease(_releaseId: string): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'takedown_requested'
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        return {
            distributorId: 'cdbaby',
            releaseId: releaseId,
            period: period,
            streams: 0,
            downloads: 0,
            grossRevenue: 0,
            distributorFee: 0,
            netRevenue: 0,
            currencyCode: 'USD',
            lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(_period: DateRange): Promise<DistributorEarnings[]> {
        return [];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: string[] = [];
        if (!metadata.trackTitle) errors.push('Title is required');
        // CDBaby specific checks
        if (!metadata.splits || metadata.splits.length === 0) errors.push('Royalty split information required for CDBaby');

        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'VALIDATION_ERROR', message: e, severity: 'error' })),
            warnings: []
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: string[] = [];
        if (assets.coverArt.width < this.requirements.coverArt.minWidth) {
            errors.push(`Cover art must be at least ${this.requirements.coverArt.minWidth}px`);
        }
        return {
            isValid: errors.length === 0,
            errors: errors.map(e => ({ code: 'ASSET_ERROR', message: e, severity: 'error' })),
            warnings: []
        };
    }
}
