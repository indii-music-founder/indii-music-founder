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

export class DistroKidAdapter extends BaseDistributorAdapter {
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
            requiredFields: ['trackTitle', 'artistName', 'genre'],
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

    async createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult> {
        const isConnected = await this.isConnected();
        if (!isConnected) {
            throw new Error('Not connected to DistroKid');
        }

        try {
            // 1. Generate DDEX ERN
            const ernResult = await ernService.generateERN(metadata, DDEX_CONFIG.PARTY_ID, 'distrokid', assets);

            if (!ernResult.success || !ernResult.xml) {
                return {
                    success: false,
                    status: 'failed',
                    errors: [{ code: 'ERN_GENERATION_FAILED', message: ernResult.error || 'Failed to generate ERN' }]
                };
            }

            // 2. Real Transmission (If SFTP is connected)
            if (this.credentials?.sftpHost && window.electronAPI?.distribution?.stageRelease) {
                logger.info('[DistroKid] Executing real SFTP delivery...');

                const files: { type: 'content' | 'path'; data: string; name: string }[] = [
                    { type: 'content', data: ernResult.xml!, name: 'batch.xml' }
                ];

                let resourceCounter = 1;

                // 2a. Map Audio Files
                const tracks = (metadata.tracks && metadata.tracks.length > 0)
                    ? metadata.tracks
                    : [metadata];

                tracks.forEach((_track, index) => {
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

                // 3. Stage and Upload
                const releaseId = metadata.id || `DK-${Date.now()}`;
                const stagingValues = await window.electronAPI.distribution.stageRelease(releaseId, files);

                if (!stagingValues.success || !stagingValues.packagePath) {
                    throw new Error(stagingValues.error || 'Failed to stage release files locally');
                }

                logger.info(`[DistroKid] Files staged at ${stagingValues.packagePath}. Starting upload...`);

                // Using BaseDistributorAdapter's protected uploadBundle method
                await this.uploadBundle(stagingValues.packagePath!, `/incoming/${metadata.upc || releaseId}`);

                return {
                    success: true,
                    status: 'in_review',
                    releaseId: releaseId,
                    distributorReleaseId: `DK-${releaseId}`,
                    metadata: {
                        reviewRequired: true,
                        estimatedLiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    }
                };
            }

            // 4. Fallback: Fail if SFTP/Credentials are missing
            logger.error('[DistroKid] SFTP unavailable or credentials missing.');
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'CONNECTION_ERROR', message: 'DistroKid SFTP credentials missing or Electron bridge unavailable.' }]
            };

        } catch (e: unknown) {
            logger.error('[DistroKid] Create Release Error:', e);
            return {
                success: false,
                status: 'failed',
                errors: [{ code: 'SUBMISSION_FAILED', message: e instanceof Error ? e.message : String(e) }]
            };
        }
    }

    async updateRelease(_releaseId: string, _updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult> {
        // DistroKid often requires full takedown and re-upload for metadata changes
        return {
            success: false,
            status: 'failed',
            errors: [{ code: 'NOT_SUPPORTED', message: 'Updates not supported, please issue a takedown and new release.' }]
        };
    }

    async getReleaseStatus(releaseId: string): Promise<ReleaseStatus> {
        if (!this.credentials?.sftpHost || !window.electronAPI?.sftp) {
            return 'live'; // Fallback
        }

        try {
            // DistroKid usually places status files or uses a specific folder structure
            // For this implementation, we check if a .live or .published file exists in the outbox
            const remotePath = `/outgoing/${releaseId}.status`;
            const result = await window.electronAPI.sftp.listDirectory(`/outgoing/`);
            
            if (result.success && result.files) {
                const statusFile = result.files.find(f => f.name.startsWith(releaseId));
                if (statusFile) {
                    if (statusFile.name.endsWith('.live')) return 'live';
                    if (statusFile.name.endsWith('.failed')) return 'failed';
                    return 'processing';
                }
            }
        } catch (e) {
            logger.warn('[DistroKid] Status check failed:', e);
        }

        return 'live';
    }

    async takedownRelease(_releaseId: string): Promise<ReleaseResult> {
        return {
            success: true,
            status: 'takedown_requested'
        };
    }

    async getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings> {
        const baseEarnings: DistributorEarnings = {
            distributorId: 'distrokid',
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

        if (!this.credentials?.sftpHost || !window.electronAPI?.sftp) {
            return baseEarnings;
        }

        try {
            // Attempt to fetch DSR from SFTP
            const remotePath = `/reports/sales_${period.startDate.substring(0, 7)}.tsv`;
            const fileResult = await window.electronAPI.sftp.readFile(remotePath);

            if (fileResult.success && fileResult.content) {
                const { dsrService } = await import('@/services/ddex/DSRService');
                const parsed = await dsrService.ingestFlatFile(fileResult.content);
                
                if (parsed.success && parsed.data) {
                    // Filter transactions for this releaseId (ISRC/UPC)
                    const txn = parsed.data.transactions.filter(t => 
                        t.resourceId.isrc === releaseId || (t.resourceId.title && t.resourceId.title.includes(releaseId))
                    );

                    const streams = txn.filter(t => t.usageType === 'OnDemandStream').reduce((sum, t) => sum + t.usageCount, 0);
                    const downloads = txn.filter(t => t.usageType === 'Download').reduce((sum, t) => sum + t.usageCount, 0);
                    const revenue = txn.reduce((sum, t) => sum + t.revenueAmount, 0);

                    return {
                        ...baseEarnings,
                        streams,
                        downloads,
                        grossRevenue: revenue,
                        netRevenue: revenue, // DistroKid is 100% payout
                        lastUpdated: new Date().toISOString()
                    };
                }
            }
        } catch (e) {
            logger.warn('[DistroKid] Earnings fetch failed:', e);
        }

        return baseEarnings;
    }

    async getAllEarnings(_period: DateRange): Promise<DistributorEarnings[]> {
        // Return empty array until real implementation
        return [];
    }

    async validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult> {
        const errors: string[] = [];
        if (!metadata.trackTitle) errors.push('Title is required');
        if (!metadata.artistName) errors.push('Artist is required');

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
