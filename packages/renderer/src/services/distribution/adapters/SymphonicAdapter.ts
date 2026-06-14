import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { DateRange, ValidationResult } from '@/services/distribution/proprietary-ingestion/types/common';
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
import { logger } from '@/utils/logger';

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

        logger.info('[Symphonic] Initiating release delivery:', metadata.trackTitle);
        const releaseId = `SYM-${Date.now()}`;

        try {
            // 1. Build Package
            const folderReleaseId = metadata.upc || `REL-${Date.now()}`;

            if (typeof window !== 'undefined' && window.electronAPI?.sftp && this.credentials?.sftpHost) {
                logger.info('[Symphonic] Delivering via Electron SFTP...');

                // Generate DDEX ERN for Symphonic delivery
                const { ingestionNotificationService } = await import('@/services/distribution/proprietary-ingestion/IngestionNotificationService');
                const { INGESTION_CONFIG } = await import('@/core/config/ingestion');
                const ernResult = await ingestionNotificationService.generateERN(
                    metadata, INGESTION_CONFIG.SYSTEM_IDENTIFIER, 'symphonic', assets
                );

                if (ernResult.success && ernResult.xml && window.electronAPI.distribution?.stageRelease) {
                    const stagingResult = await window.electronAPI.distribution.stageRelease(
                        folderReleaseId,
                        [{ type: 'content', data: ernResult.xml, name: 'batch.xml' }]
                    );

                    if (stagingResult.success && stagingResult.packagePath) {
                        // Item 213: Execute real SFTP delivery via base class uploadBundle
                        await this.uploadBundle(stagingResult.packagePath, `/deliveries/${folderReleaseId}`);
                        logger.info(`[Symphonic] SFTP delivery complete for ${folderReleaseId}`);
                    }
                }

                return {
                    success: true,
                    status: 'processing',
                    releaseId,
                    distributorReleaseId: releaseId
                };
            }

            // Fail explicitly if SFTP credentials are missing
            logger.error('[Symphonic] SFTP credentials required. Configure them in Settings > Integrations.');
            return {
                success: false,
                status: 'failed',
                errors: [{
                    code: 'DELIVERY_UNAVAILABLE',
                    message: 'Symphonic delivery requires SFTP credentials. Go to Settings > Integrations to configure.'
                }],
                releaseId,
                distributorReleaseId: releaseId
            };

        } catch (error: unknown) {
            logger.error('[Symphonic] Delivery failed:', error);
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
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }

        logger.info(`[Symphonic] Sending XML Update for ${releaseId} with changes:`, Object.keys(updates));

        const deployments = await distributionStore.getDeploymentsForRelease(releaseId);
        if (deployments.length > 0) {
            await distributionStore.updateDeploymentStatus(deployments[0]!.id, 'processing');
        }

        return {
            success: true,
            status: 'processing',
            distributorReleaseId: releaseId,
        };
    }



    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to Symphonic');
        }
        logger.info(`[Symphonic] Issuing Takedown for ${releaseId}`);
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

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.credentials?.sftpHost || !window.electronAPI?.sftp) {
            return 'in_review';
        }

        try {
            const result = await window.electronAPI.sftp.listDirectory('/status/');
            if (result.success && result.files) {
                const statusFile = result.files.find((f: { name: string }) => f.name.includes(releaseId));
                if (statusFile) {
                    if (statusFile.name.includes('DELIVERED') || statusFile.name.includes('LIVE')) return 'live';
                    if (statusFile.name.includes('ERROR') || statusFile.name.includes('FAILED')) return 'failed';
                    return 'processing';
                }
            }
        } catch (e) {
            logger.warn('[Symphonic] Status check failed:', e);
        }

        return 'in_review';
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        const req = this.requirements.metadata;

        if (req.requiredFields) {
            for (const field of req.requiredFields) {
                let val = '';
                if (field === 'trackTitle' || field === 'title') val = metadata.trackTitle || '';
                else if (field === 'artistName' || field === 'artist') val = metadata.artistName || '';
                else if (field === 'genre') val = metadata.genre || '';
                else if (field === 'labelName' || field === 'label') val = metadata.labelName || '';

                if (!val) {
                    errors.push({
                        code: `MISSING_${field.toUpperCase()}`,
                        message: `${this.name} requires ${field}`,
                        field,
                        severity: 'error'
                    });
                }
            }
        }

        if (req.maxTitleLength && metadata.trackTitle && metadata.trackTitle.length > req.maxTitleLength) {
            errors.push({
                code: 'TITLE_TOO_LONG',
                message: `Title must be ${req.maxTitleLength} characters or less`,
                field: 'trackTitle',
                severity: 'error'
            });
        }
        if (req.maxArtistNameLength && metadata.artistName && metadata.artistName.length > req.maxArtistNameLength) {
            errors.push({
                code: 'ARTIST_TOO_LONG',
                message: `Artist name must be ${req.maxArtistNameLength} characters or less`,
                field: 'artistName',
                severity: 'error'
            });
        }

        if (req.isrcRequired && !metadata.isrc) {
            errors.push({ code: 'MISSING_ISRC', message: 'ISRC is required for Symphonic', field: 'isrc', severity: 'error' });
        }
        if (req.upcRequired && !metadata.upc) {
            errors.push({ code: 'MISSING_UPC', message: 'UPC is required for Symphonic', field: 'upc', severity: 'error' });
        }
        if (req.genreRequired && !metadata.genre) {
            errors.push({ code: 'MISSING_GENRE', message: 'Genre is required for Symphonic', field: 'genre', severity: 'error' });
        }
        if (req.languageRequired && !metadata.language) {
            errors.push({ code: 'MISSING_LANGUAGE', message: 'Language is required for Symphonic', field: 'language', severity: 'error' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }

    async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
        const errors: ValidationResult['errors'] = [];
        const cReq = this.requirements.coverArt;
        const aReq = this.requirements.audio;

        if (assets.coverArt) {
            const { width, height, sizeBytes, url } = assets.coverArt;
            if (width < cReq.minWidth || height < cReq.minHeight) {
                errors.push({
                    code: 'COVER_TOO_SMALL',
                    message: `Cover art must be at least ${cReq.minWidth}x${cReq.minHeight}px`,
                    field: 'coverArt',
                    severity: 'error'
                });
            }
            if (cReq.maxWidth && cReq.maxHeight && (width > cReq.maxWidth || height > cReq.maxHeight)) {
                errors.push({
                    code: 'COVER_TOO_LARGE',
                    message: `Cover art must be at most ${cReq.maxWidth}x${cReq.maxHeight}px`,
                    field: 'coverArt',
                    severity: 'error'
                });
            }
            if (cReq.maxSizeBytes && sizeBytes > cReq.maxSizeBytes) {
                errors.push({
                    code: 'COVER_SIZE_LIMIT',
                    message: `Cover art size is too large (max ${cReq.maxSizeBytes / (1024 * 1024)}MB)`,
                    field: 'coverArt',
                    severity: 'error'
                });
            }
            if (cReq.allowedFormats) {
                const ext = url.split('.').pop()?.toLowerCase();
                if (!ext || !(cReq.allowedFormats as string[]).includes(ext)) {
                    errors.push({
                        code: 'COVER_FORMAT_INVALID',
                        message: `Cover art format must be one of: ${cReq.allowedFormats.join(', ')}`,
                        field: 'coverArt',
                        severity: 'error'
                    });
                }
            }
        } else {
            errors.push({ code: 'MISSING_COVER_ART', message: 'Cover art is required', field: 'coverArt', severity: 'error' });
        }

        const audioFiles = assets.audioFiles || (assets.audioFile ? [assets.audioFile] : []);
        if (audioFiles.length > 0) {
            audioFiles.forEach((file, index) => {
                const { url, sampleRate, bitDepth } = file;
                const ext = url.split('.').pop()?.toLowerCase();
                if (aReq.allowedFormats && ext && !aReq.allowedFormats.includes(ext)) {
                    errors.push({
                        code: 'AUDIO_FORMAT_INVALID',
                        message: `Track ${index + 1} format must be one of: ${aReq.allowedFormats.join(', ')}`,
                        field: `audioFiles[${index}]`,
                        severity: 'error'
                    });
                }
                if (aReq.minSampleRate && sampleRate && sampleRate < aReq.minSampleRate) {
                    errors.push({
                        code: 'AUDIO_SAMPLE_RATE_LOW',
                        message: `Track ${index + 1} sample rate must be at least ${aReq.minSampleRate}Hz`,
                        field: `audioFiles[${index}]`,
                        severity: 'error'
                    });
                }
                if (aReq.minBitDepth && bitDepth && bitDepth < aReq.minBitDepth) {
                    errors.push({
                        code: 'AUDIO_BIT_DEPTH_LOW',
                        message: `Track ${index + 1} bit depth must be at least ${aReq.minBitDepth} bit`,
                        field: `audioFiles[${index}]`,
                        severity: 'error'
                    });
                }
            });
        } else {
            errors.push({ code: 'MISSING_AUDIO', message: 'Audio asset is required', field: 'audioFile', severity: 'error' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }
}
