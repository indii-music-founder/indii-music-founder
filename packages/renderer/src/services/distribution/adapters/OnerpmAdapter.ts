/**
 * OneRPM Distributor Adapter
 *
 * OneRPM is a top-5 independent distributor (Brazil/LATAM-focused, global reach).
 * Delivery uses their REST API with a partner API key.
 *
 * Item 215: Added Onerpm distributor adapter.
 */

import { BaseDistributorAdapter } from './BaseDistributorAdapter';
import { earningsService } from '../EarningsService';
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

const ONERPM_API_BASE = 'https://api.onerpm.com/v2';

export class OnerpmAdapter extends BaseDistributorAdapter {
    readonly id: DistributorId = 'onerpm';
    readonly name = 'OneRPM';
    // Item 413: Pinned API version — bump intentionally on breaking change
    protected readonly apiVersion = 'v2';
    protected readonly apiBaseUrl = ONERPM_API_BASE;

    readonly requirements: DistributorRequirements = {
        distributorId: 'onerpm',
        coverArt: {
            minWidth: 1600,
            minHeight: 1600,
            maxWidth: 5000,
            maxHeight: 5000,
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
            requiredFields: ['trackTitle', 'artistName', 'genre', 'releaseDate'],
            maxTitleLength: 250,
            maxArtistNameLength: 250,
            isrcRequired: false,
            upcRequired: false,
            genreRequired: true,
            languageRequired: true,
        },
        timing: {
            minLeadTimeDays: 7,
            reviewTimeDays: 3,
        },
        pricing: {
            model: 'revenue_share',
            payoutPercentage: 85, // OneRPM standard partner rate
        },
    };

    async connect(credentials: DistributorCredentials): Promise<void> {
        await super.connect(credentials);
        if (credentials.apiKey) {
            try {
                const response = await fetch(`${ONERPM_API_BASE}/version`, {
                    headers: {
                        'Authorization': `Bearer ${credentials.apiKey}`,
                        ...this.getVersionedHeaders(),
                    },
                    signal: AbortSignal.timeout(5000),
                });
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Invalid API key or credentials for OneRPM');
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes('Invalid')) {
                    this.connected = false;
                    this.credentials = undefined;
                    throw err;
                }
                logger.warn('[OneRPM] API connection verification warning:', err);
            }
        }
    }

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) throw new Error('Not connected to OneRPM');

        const releaseId = metadata.id || `ORP-${Date.now()}`;

        try {
            const ernResult = await ingestionNotificationService.generateERN(metadata, INGESTION_CONFIG.SYSTEM_IDENTIFIER, 'onerpm', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false, status: 'failed',
                    errors: [{ code: 'ERN_FAILED', message: ernResult.error || 'ERN generation failed' }]
                };
            }

            if (this.credentials?.apiKey) {
                try {
                    const response = await fetch(`${ONERPM_API_BASE}/releases`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.credentials.apiKey}`,
                            'Content-Type': 'application/json',
                            ...this.getVersionedHeaders(),
                        },
                        body: JSON.stringify({
                            title: metadata.trackTitle,
                            artist: metadata.artistName,
                            genre: metadata.genre,
                            release_date: metadata.releaseDate,
                            label: metadata.labelName || 'Self-Released',
                            isrc: metadata.isrc,
                            upc: metadata.upc,
                        }),
                    });

                    if (!response.ok) {
                        logger.warn(`[OneRPM] API rejected the release (HTTP ${response.status}) — no delivery occurred.`);
                        return {
                            success: false,
                            releaseId,
                            status: 'failed',
                            errors: [{ code: 'DELIVERY_REJECTED', message: `OneRPM API rejected the release (HTTP ${response.status}). Nothing was delivered.` }]
                        };
                    }

                    const data = await response.json();
                    return {
                        success: true,
                        releaseId,
                        distributorReleaseId: data.id || `ORP-${releaseId}`,
                        status: 'pending_review',
                        metadata: {
                            estimatedLiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            reviewRequired: true,
                        }
                    };
                } catch (apiErr: unknown) {
                    logger.warn('[OneRPM] API delivery unavailable — ERN is ready for manual submission, nothing was delivered:', apiErr);
                    return {
                        success: false,
                        releaseId,
                        status: 'ready_for_manual_submission',
                        errors: [{ code: 'DELIVERY_UNAVAILABLE', message: 'OneRPM API delivery failed before acceptance. The DDEX ERN was generated — submit the release manually from your OneRPM account.' }],
                        metadata: {
                            reviewRequired: true,
                            note: 'ERN generated. No delivery to OneRPM occurred.',
                        }
                    };
                }
            }

            // No API key: honest manual handoff — ERN generated, nothing delivered (ISSUE-658)
            return {
                success: false,
                releaseId,
                status: 'ready_for_manual_submission',
                errors: [{ code: 'MANUAL_DELIVERY_REQUIRED', message: 'No OneRPM API key configured — nothing was delivered. Add one in Settings > Integrations for automatic delivery, or submit the generated ERN manually from your OneRPM account.' }],
                metadata: {
                    reviewRequired: true,
                    note: 'ERN generated. No delivery to OneRPM occurred.',
                }
            };
        } catch (e: unknown) {
            return {
                success: false, status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : 'Unknown error' }]
            };
        }
    }

    async updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        if (!this.credentials?.apiKey) {
            return { success: false, status: 'failed', errors: [{ code: 'NO_API_KEY', message: 'OneRPM API key required.' }] };
        }
        const response = await fetch(`${ONERPM_API_BASE}/releases/${releaseId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.credentials.apiKey}`,
                'Content-Type': 'application/json',
                ...this.getVersionedHeaders(),
            },
            body: JSON.stringify(updates),
        });
        return { success: response.ok, status: response.ok ? 'processing' : 'failed', distributorReleaseId: releaseId };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.credentials?.apiKey) return 'in_review';
        try {
            const response = await fetch(`${ONERPM_API_BASE}/releases/${releaseId}/status`, {
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
        return {
            success: false,
            status: 'ready_for_manual_submission',
            distributorReleaseId: releaseId,
            errors: [{
                code: 'TAKEDOWN_MANUAL_REQUIRED',
                message: 'OneRPM takedown automation is not wired. Submit the takedown manually through OneRPM before marking it requested.',
            }],
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        return {
            distributorId: 'onerpm', releaseId, period,
            streams: 0, downloads: 0, grossRevenue: 0, distributorFee: 0, netRevenue: 0,
            currencyCode: 'USD', lastUpdated: new Date().toISOString()
        };
    }

    async getAllEarnings(period: DateRange): Promise<DistributorEarnings[]> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to OneRPM');
        }
        return await earningsService.getAllEarnings(this.id, period);
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
                else if (field === 'releaseDate') val = metadata.releaseDate || '';

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
            errors.push({ code: 'MISSING_ISRC', message: 'ISRC is required for OneRPM', field: 'isrc', severity: 'error' });
        }
        if (req.upcRequired && !metadata.upc) {
            errors.push({ code: 'MISSING_UPC', message: 'UPC is required for OneRPM', field: 'upc', severity: 'error' });
        }
        if (req.genreRequired && !metadata.genre) {
            errors.push({ code: 'MISSING_GENRE', message: 'Genre is required for OneRPM', field: 'genre', severity: 'error' });
        }
        if (req.languageRequired && !metadata.language) {
            errors.push({ code: 'MISSING_LANGUAGE', message: 'Language is required for OneRPM', field: 'language', severity: 'error' });
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
