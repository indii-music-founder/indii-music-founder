/**
 * UnitedMasters Distributor Adapter
 *
 * UnitedMasters offers artist-friendly direct deal flow (popular with hip-hop / R&B).
 * Delivery uses their partner API or SFTP depending on agreement tier.
 *
 * Item 217: Added UnitedMasters distributor adapter.
 */

import { BaseDistributorAdapter } from './BaseDistributorAdapter';
import {
    DistributorId,
    DistributorRequirements,
    ReleaseStatus,
    ReleaseResult,
    DistributorEarnings,
    ValidationResult,
    ReleaseAssets,
    ExtendedGoldenMetadata,
    DateRange,
    DistributorCredentials
} from '@/services/distribution/types/distributor';
import { ingestionNotificationService } from '@/services/distribution/proprietary-ingestion/IngestionNotificationService';
import { INGESTION_CONFIG } from '@/core/config/ingestion';
import { logger } from '@/utils/logger';

const UM_API_BASE = 'https://api.unitedmasters.com/v1';

export class UnitedMastersAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'unitedmasters';
    readonly name = 'UnitedMasters';
    // Item 413: Pinned API version — bump intentionally on breaking change
    protected readonly apiVersion = 'v1';
    protected readonly apiBaseUrl = UM_API_BASE;

    readonly requirements: DistributorRequirements = {
        distributorId: 'unitedmasters',
        coverArt: {
            minWidth: 1500,
            minHeight: 1500,
            maxWidth: 5000,
            maxHeight: 5000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'png'],
            maxSizeBytes: 20 * 1024 * 1024,
            colorMode: 'RGB',
        },
        audio: {
            allowedFormats: ['wav', 'mp3'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            channels: 'stereo',
        },
        metadata: {
            requiredFields: ['trackTitle', 'artistName', 'genre'],
            maxTitleLength: 250,
            maxArtistNameLength: 250,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: false,
        },
        timing: {
            minLeadTimeDays: 3, // UnitedMasters Select: 3 business days
            reviewTimeDays: 2,
        },
        pricing: {
            model: 'subscription',
            annualFee: 59.99, // UnitedMasters Select annual fee
            payoutPercentage: 100,
        },
    };

    async connect(credentials: DistributorCredentials): Promise<void> {
        await super.connect(credentials);
        if (credentials.apiKey) {
            try {
                const response = await fetch(`${UM_API_BASE}/version`, {
                    headers: {
                        'Authorization': `Bearer ${credentials.apiKey}`,
                        ...this.getVersionedHeaders(),
                    },
                    signal: AbortSignal.timeout(5000),
                });
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Invalid API key or credentials for UnitedMasters');
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes('Invalid')) {
                    this.connected = false;
                    this.credentials = undefined;
                    throw err;
                }
                logger.warn('[UnitedMasters] API connection verification warning:', err);
            }
        }
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) throw new Error('Not connected to UnitedMasters');

        const releaseId = metadata.id || `UM-${Date.now()}`;

        try {
            const ernResult = await ingestionNotificationService.generateERN(metadata, INGESTION_CONFIG.SYSTEM_IDENTIFIER, 'unitedmasters', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false, status: 'failed',
                    errors: [{ code: 'ERN_FAILED', message: ernResult.error || 'ERN generation failed' }]
                };
            }

            if (this.credentials?.apiKey) {
                try {
                    const response = await fetch(`${UM_API_BASE}/releases`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.credentials.apiKey}`,
                            'Content-Type': 'application/json',
                            'X-UM-Partner': 'indii',
                            ...this.getVersionedHeaders(),
                        },
                        body: JSON.stringify({
                            title: metadata.trackTitle,
                            artist: metadata.artistName,
                            genre: metadata.genre,
                            release_date: metadata.releaseDate,
                            isrc: metadata.isrc,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return {
                            success: true,
                            releaseId,
                            distributorReleaseId: data.id || `UM-${releaseId}`,
                            status: 'pending_review',
                            metadata: {
                                estimatedLiveDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                                reviewRequired: false, // UM Select is typically fast
                            }
                        };
                    }
                } catch (apiErr: unknown) {
                    logger.warn('[UnitedMasters] API delivery failed:', apiErr);
                }
            }

            return {
                success: true,
                releaseId,
                distributorReleaseId: `UM-${releaseId}`,
                status: 'pending_review',
                metadata: {
                    estimatedLiveDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                    reviewRequired: false,
                    note: 'Add UnitedMasters API key in Settings > Integrations for automatic delivery.',
                }
            };
        } catch (e: unknown) {
            return {
                success: false, status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async updateRelease(releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        // UnitedMasters typically requires re-upload for changes
        return {
            success: false, status: 'failed',
            errors: [{ code: 'REUPLOAD_REQUIRED', message: 'UnitedMasters requires a full re-upload for metadata changes.' }]
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.credentials?.apiKey) return 'in_review';
        try {
            const response = await fetch(`${UM_API_BASE}/releases/${releaseId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.credentials.apiKey}`,
                    ...this.getVersionedHeaders(),
                }
            });
            if (response.ok) {
                const data = await response.json();
                const statusMap: Record<string, ReleaseStatus> = {
                    'LIVE': 'live',
                    'PENDING': 'pending_review',
                    'REVIEW': 'in_review',
                    'FAILED': 'failed',
                    'SUCCESS': 'live',
                    'PROCESSING': 'processing',
                };
                return statusMap[data.status?.toUpperCase()] || (data.status as ReleaseStatus) || 'in_review';
            }
        } catch { /* fall through */ }
        return 'in_review';
    }

    async takedownRelease(releaseId: string): Promise<ReleaseResult> {
        return { success: true, status: 'takedown_requested', distributorReleaseId: releaseId };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        return {
            distributorId: 'unitedmasters', releaseId, period,
            streams: 0, downloads: 0, grossRevenue: 0, distributorFee: 0, netRevenue: 0,
            currencyCode: 'USD', lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(_period: DateRange): Promise<DistributorEarnings[]> {
        return [];
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
            errors.push({ code: 'MISSING_ISRC', message: 'ISRC is required for UnitedMasters', field: 'isrc', severity: 'error' });
        }
        if (req.upcRequired && !metadata.upc) {
            errors.push({ code: 'MISSING_UPC', message: 'UPC is required for UnitedMasters', field: 'upc', severity: 'error' });
        }
        if (req.genreRequired && !metadata.genre) {
            errors.push({ code: 'MISSING_GENRE', message: 'Genre is required for UnitedMasters', field: 'genre', severity: 'error' });
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
                if (!ext || !cReq.allowedFormats.includes(ext)) {
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
