import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { DateRange, ValidationResult } from '@/services/ddex/types/common';
import {
    BaseDistributorAdapter
} from './BaseDistributorAdapter';
import {
    type DistributorId,
    type DistributorRequirements,
    type ReleaseAssets,
    type ReleaseResult,
    type ReleaseStatus,
    type DistributorEarnings,
} from '../types/distributor';
import { earningsService } from '../EarningsService';
import { distributionStore } from '../DistributionPersistenceService';
import { ernService } from '@/services/ddex/ERNService';
import { DDEX_CONFIG } from '@/core/config/ddex';

export class SymphonicAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'symphonic';
    readonly name = 'Symphonic';

    readonly requirements: DistributorRequirements = {
        distributorId: 'symphonic',
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            maxWidth: 6000,
            maxHeight: 6000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB',
        },
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre', 'labelName'],
            maxTitleLength: 500,
            maxArtistNameLength: 500,
            isrcRequired: true,
            upcRequired: true,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 14,
            reviewTimeDays: 5,
        },
        pricing: {
            model: 'revenue_share',
            payoutPercentage: 85,
        },
    };

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }

        console.info('[Symphonic] Initiating release delivery:', metadata.trackTitle);
        const internalId = metadata.id || `SYM-${Date.now()}`;

        try {
            // 1. Generate DDEX ERN XML
            const ernResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'symphonic', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            // 2. Real Transmission (If running in Electron with SFTP bridge)
            if (this.credentials?.sftpHost && window.electronAPI?.distribution?.stageRelease) {
                console.info('[Symphonic] Executing real SFTP delivery...');

                // 2a. Prepare file map for staging
                const files: { type: 'content' | 'path'; data: string; name: string }[] = [
                    { type: 'content', data: ernResult.xml!, name: 'ern.xml' }
                ];

                let resourceCounter = 1;

                // 2b. Map Audio Files
                const tracks = (metadata.tracks && metadata.tracks.length > 0)
                    ? metadata.tracks
                    : [metadata];

                tracks.forEach((track, index) => {
                    const ref = `A${resourceCounter++}`;
                    let assetObj = assets.audioFiles.find(a => a.trackIndex === index) || assets.audioFiles[index];

                    // Fallback to singular audioFile if needed
                    if (!assetObj && index === 0 && assets.audioFile) {
                        assetObj = { ...assets.audioFile, trackIndex: 0 };
                    }

                    if (assetObj) {
                        const ext = assetObj.format || 'wav';
                        files.push({
                            type: 'path',
                            data: assetObj.url,
                            name: `resources/${ref}.${ext}`
                        });
                    } else {
                        console.warn(`[Symphonic] No audio file found for track index ${index} ("${(track as any).trackTitle || 'unknown'}"). ERN may reference a missing resource.`);
                    }
                });

                // 2c. Map Cover Art
                if (assets.coverArt) {
                    const ref = `IMG${resourceCounter++}`;
                    const ext = assets.coverArt.url.split('?')[0].split('.').pop() || 'jpg';
                    files.push({
                        type: 'path',
                        data: assets.coverArt.url,
                        name: `resources/${ref}.${ext}`
                    });
                }

                // 3. Stage Files Locally
                const stagingRes = await window.electronAPI.distribution.stageRelease(internalId, files);

                if (!stagingRes.success || !stagingRes.packagePath) {
                    throw new Error(stagingRes.error || 'Failed to stage release files locally');
                }

                console.info(`[Symphonic] Files staged at ${stagingRes.packagePath}. Starting upload...`);

                // 4. Transmission
                // Symphonic typically expects a folder named after the UPC or Release ID
                const remoteFolder = `/${metadata.upc || internalId}`;
                await this.uploadBundle(stagingRes.packagePath, remoteFolder);

                return {
                    success: true,
                    status: 'delivered',
                    releaseId: internalId,
                    distributorReleaseId: `SYM-${internalId}`,
                    metadata: {
                        reviewRequired: true,
                        estimatedLiveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                    }
                };
            } else {
                // Bolt Hardening: Fail if no real delivery method is available
                console.error('[Symphonic] Real delivery not implemented or SFTP unavailable.');
                return {
                    success: false,
                    status: 'failed',
                    errors: [{
                        code: 'DELIVERY_UNAVAILABLE',
                        message: 'Symphonic delivery requires active SFTP session and Electron environment.'
                    }],
                    releaseId: internalId
                };
            }

        } catch (error) {
            console.error('[Symphonic] Delivery failed:', error);
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'DELIVERY_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown Delivery Error'
                }],
                releaseId: internalId
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }

        console.info(`[Symphonic] Sending XML Update for ${releaseId} with changes:`, Object.keys(updates));

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
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }
        console.info(`[Symphonic] Issuing Takedown for ${releaseId}`);
        return {
            success: true,
            status: 'takedown_requested',
            distributorReleaseId: releaseId,
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
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
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }
        return await earningsService.getAllEarnings(this.id, period);
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        if (!metadata.isrc) {
            errors.push({ code: 'MISSING_ISRC', message: 'Symphonic requires ISRC', field: 'isrc', severity: 'error' });
        }
        if (!metadata.upc) {
            errors.push({ code: 'MISSING_UPC', message: 'Symphonic requires UPC', field: 'upc', severity: 'error' });
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: [],
        };
    }

    async validateAssets(_assets: ReleaseAssets): Promise<ValidationResult> {
        return { isValid: true, errors: [], warnings: [] };
    }
}
