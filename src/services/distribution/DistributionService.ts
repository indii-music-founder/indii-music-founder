import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { DistributionTaskDocument, TaxProfileDocument } from '@/types/firestore';
import { isrcService } from './ISRCService';
import { taxService } from './TaxService';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import {
    MerlinCheckData, MerlinReport,
    BWarmData,
    DDEXMetadata,
    ContentIdData,
    ISRCGenerationOptions,
    UPCGenerationOptions,
    TaxCertificationData,
    WaterfallData,
    WaterfallReport,
    TaxReport,
    ValidationReport,
    SFTPConfig,
    SFTPReport,
    ForensicsReport
} from '@/types/distribution';

export type { DistributionTaskDocument as DistributionTask };

class DistributionService extends FirestoreService<DistributionTaskDocument> {
    constructor() {
        super('distribution_tasks');
    }

    /**
     * Track a new distribution task in Firestore
     */
    async createTask(type: DistributionTaskDocument['type'], title: string, metadata: Record<string, unknown> = {}): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated');

        return this.add({
            userId,
            type,
            status: 'PENDING',
            progress: 0,
            title,
            metadata
        });
    }

    /**
     * Update task progress and status
     */
    async updateTask(taskId: string, updates: Partial<Pick<DistributionTaskDocument, 'status' | 'progress' | 'subtext' | 'error' | 'metadata'>>) {
        await this.update(taskId, updates);
    }

    /**
     * Subscribe to active distribution tasks for the current user
     */
    subscribeTasks(callback: (tasks: DistributionTaskDocument[]) => void, onError?: (error: Error) => void) {
        const userId = auth.currentUser?.uid;
        if (!userId) return () => { };

        return this.subscribe(
            [this.where('userId', '==', userId), this.orderBy('createdAt', 'desc')],
            callback,
            (error) => {
                logger.warn('[DistributionService] Subscription error:', error);
                if (onError) onError(error);
            }
        );
    }

    /**
     * Execute local audio forensics via Electron IPC
     */
    async runLocalForensics(taskId: string, filePath: string): Promise<ForensicsReport> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for forensics');
        }

        await this.updateTask(taskId, { status: 'RUNNING', subtext: 'Initializing spectral analysis...' });

        try {
            const result = await window.electronAPI.distribution.runForensics(filePath);

            if (!result.success) {
                await this.updateTask(taskId, { status: 'FAILED', error: result.error });
                throw new Error(result.error || 'Forensics failed');
            }

            if (!result.report) {
                await this.updateTask(taskId, { status: 'FAILED', error: 'Forensics report was not generated' });
                throw new Error('Forensics report was not generated');
            }

            const status = result.report.status === 'PASS' ? 'COMPLETED' : 'FAILED';
            await this.updateTask(taskId, {
                status,
                progress: 100,
                subtext: result.report.status,
                metadata: { report: result.report }
            });

            if (window.electronAPI) {
                window.electronAPI.showNotification(
                    status === 'COMPLETED' ? 'Forensics Pass' : 'Forensics Audit Required',
                    `Spectral analysis for ${this.getBasename(filePath)} is complete.`
                );
            }

            return result.report;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown forensics error';
            await this.updateTask(taskId, { status: 'FAILED', error: errorMsg });

            if (window.electronAPI) {
                window.electronAPI.showNotification(
                    'Forensics Error',
                    `Failed to analyze ${this.getBasename(filePath)}: ${errorMsg}`
                );
            }
            throw error;
        }
    }

    private getBasename(path: string): string {
        return path.split(/[\\/]/).pop() || path;
    }

    /**
     * Calculate tax withholding via Electron IPC (uses Python engine)
     */
    async calculateWithholding(userId: string, amount: number): Promise<TaxReport> {
        if (!window.electronAPI) {
            logger.warn('[Distribution] Electron API missing for tax calculation');
            throw new Error('Electron environment required for tax calculations');
        }

        try {
            // Updated to pass object as single argument matching new IPC signature
            const result = await window.electronAPI.distribution.calculateTax({ userId, amount });
            if (!result.success || !result.report) {
                logger.error('[Distribution] Tax calculation failed:', result.error);
                throw new Error(result.error || 'Tax calculation failed');
            }
            return result.report;
        } catch (error) {
            logger.error('[Distribution] Unexpected tax engine error:', error);
            throw error;
        }
    }

    /**
     * Certify user tax status via Electron IPC and persist to Firestore
     */
    async certifyTax(userId: string, data: TaxCertificationData): Promise<TaxProfileDocument> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for tax certification');
        }

        try {
            const result = await window.electronAPI.distribution.certifyTax(userId, data);
            if (!result.success || !result.report) {
                throw new Error(result.error || 'Tax certification failed');
            }

            const report = result.report;

            // Map Python report keys to Firestore schema
            await taxService.saveProfile(userId, {
                userId,
                formType: report.form_type as 'W-9' | 'W-8BEN' | 'W-8BEN-E',
                country: report.country,
                tinMasked: report.tin_masked,
                tinValid: report.tin_valid,
                certified: report.certified,
                payoutStatus: (report.payout_status === 'BLOCKED' || report.payout_status === 'HOLD') ? 'HELD' : 'ACTIVE',
                certTimestamp: report.cert_timestamp ? Timestamp.fromDate(new Date(report.cert_timestamp)) : null,
                metadata: { ...data, rawReport: report }
            });

            return (await taxService.getProfile(userId))!;
        } catch (error) {
            logger.error('[Distribution] Tax certification error:', error);
            throw error;
        }
    }

    /**
     * Execute revenue waterfall via Electron IPC
     */
    async executeWaterfall(data: WaterfallData): Promise<WaterfallReport> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for waterfall execution');
        }

        try {
            const result = await window.electronAPI.distribution.executeWaterfall(data);
            if (!result.success || !result.report) {
                throw new Error(result.error || 'Waterfall execution failed');
            }
            return result.report;
        } catch (error) {
            logger.error('[Distribution] Waterfall engine error:', error);
            throw error;
        }
    }

    /**
     * Validate release metadata via Electron IPC
     */
    async validateReleaseMetadata(metadata: DDEXMetadata): Promise<ValidationReport> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for metadata validation');
        }

        try {
            const result = await window.electronAPI.distribution.validateMetadata(metadata);
            if (!result.success) {
                logger.warn('[Distribution] Metadata validation failed:', result.report);
                // Don't throw error if validation fails, just return report so UI can show errors
                // Unless it's an execution error
                if (result.error) throw new Error(result.error);
            }
            return result.report || { valid: false, errors: ['Unknown validation error'] };
        } catch (error) {
            logger.error('[Distribution] Validation engine error:', error);
            throw error;
        }
    }

    /**
     * Generate Content ID CSV Assets
     */
    async generateContentIdAssets(data: ContentIdData): Promise<string> {
        if (!window.electronAPI) {
            logger.warn('[Distribution] Electron API missing for Content ID generation');
            throw new Error('Electron environment required for Content ID generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateContentIdCSV(data);
            if (!result.success || (!result.csvData && !result.report)) {
                logger.error('[Distribution] Content ID generation failed:', result.error);
                throw new Error(result.error || 'Content ID generation failed');
            }
            return result.csvData || JSON.stringify(result.report);
        } catch (error) {
            logger.error('[Distribution] Content ID engine error:', error);
            throw error;
        }
    }

    /**
     * Generate a new ISRC via Python engine
     */
    async assignISRCs(options?: ISRCGenerationOptions): Promise<string> {
        if (!window.electronAPI) {
            logger.warn('[Distribution] Electron API missing for ISRC generation');
            throw new Error('Electron environment required for ISRC generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateISRC(options);
            if (!result.success || !result.isrc) {
                logger.error('[Distribution] ISRC Generation failed:', result.error);
                throw new Error(result.error || 'ISRC Generation failed');
            }

            // Persist assignment if options contain metadata (e.g. for a specific track)
            if (options?.releaseId && options?.trackTitle) {
                const userId = auth.currentUser?.uid;
                if (!userId) throw new Error('User must be authenticated to record ISRC assignment');

                await isrcService.recordAssignment({
                    isrc: result.isrc,
                    releaseId: options.releaseId,
                    userId,
                    trackTitle: options.trackTitle,
                    artistName: options.artistName || 'Unknown Artist',
                    assignedAt: Timestamp.now(),
                    metadataSnapshot: { ...options } as Record<string, unknown>
                });
            }

            return result.isrc;
        } catch (error) {
            logger.error('[Distribution] ISRC engine error:', error);
            throw error;
        }
    }

    /**
     * Generate a new UPC via Python engine
     */
    async generateUPC(options?: UPCGenerationOptions): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for UPC generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateUPC(options);
            if (!result.success || !result.upc) {
                throw new Error(result.error || 'UPC Generation failed');
            }
            return result.upc;
        } catch (error) {
            logger.error('[Distribution] UPC engine error:', error);
            throw error;
        }
    }

    /**
     * Generate DDEX ERN 4.3 XML via Python engine
     */
    async generateDDEX(metadata: DDEXMetadata): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for DDEX generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateDDEX(metadata);
            if (!result.success || !result.xml) {
                throw new Error(result.error || 'DDEX Generation failed');
            }
            return result.xml;
        } catch (error) {
            logger.error('[Distribution] DDEX engine error:', error);
            throw error;
        }
    }

    /**
     * Check Merlin Network compliance status
     */
    async checkMerlinStatus(data: MerlinCheckData): Promise<MerlinReport> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for Merlin check');
        }

        try {
            const result = await window.electronAPI.distribution.checkMerlinStatus(data);
            if (!result.success || !result.report) {
                throw new Error(result.error || 'Merlin status check failed');
            }
            return result.report;
        } catch (error) {
            logger.error('[Distribution] Merlin engine error:', error);
            throw error;
        }
    }

    /**
     * Generate BWARM CSV report
     */
    async generateBWARM(data: BWarmData): Promise<string> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for BWARM generation');
        }

        try {
            const result = await window.electronAPI.distribution.generateBWARM(data);
            if (!result.success || (!result.csv && !result.report)) {
                throw new Error(result.error || 'BWARM generation failed');
            }
            return result.csv || JSON.stringify(result.report);
        } catch (error) {
            logger.error('[Distribution] BWARM engine error:', error);
            throw error;
        }
    }

    /**
     * Transmit a release package via SFTP
     */
    async transmit(config: SFTPConfig): Promise<SFTPReport> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for transmission');
        }

        try {
            const result = await window.electronAPI.distribution.transmit(config);
            if (!result.success || !result.report) {
                throw new Error(result.error || 'Transmission failed');
            }
            return result.report;
        } catch (error) {
            logger.error('[Distribution] Transmission engine error:', error);
            throw error;
        }
    }

    private releasesService = new FirestoreService<any>('ddexReleases');

    /**
     * Stage a new release for distribution
     */
    async stageRelease(data: {
        title: string;
        artist: string;
        orgId: string;
        releaseDate?: string;
        coverArtUrl?: string;
        assets: Array<{ id: string; type: string; url: string; role: string }>;
        metadata?: Record<string, unknown>;
    }): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated');

        return this.releasesService.add({
            ...data,
            userId,
            status: 'validating',
            lastCheckedAt: Timestamp.now(),
            submittedAt: null
        });
    }

    /**
     * Get all releases for the current user/org
     */
    async getReleases(orgId?: string): Promise<any[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];

        const constraints = orgId
            ? [this.where('orgId', '==', orgId)]
            : [this.where('userId', '==', userId)];

        return this.releasesService.list([...constraints, this.orderBy('createdAt', 'desc')]);
    }

    /**
     * End-to-end release submission pipeline:
     * QC validate → assign ISRCs → build DDEX ERN 4.3 XML → SFTP upload
     *
     * @param releaseData  Full release metadata including optional sftpConfig
     * @param onProgress   Optional callback for step-by-step progress events
     */
    async submitRelease(
        releaseData: DDEXMetadata & { sftpConfig?: SFTPConfig },
        onProgress?: (event: { step?: string; status?: string; progress?: number; detail?: string; log?: string }) => void
    ): Promise<{ status: string; xml?: string; xml_path?: string; tracks?: unknown[] }> {
        if (!window.electronAPI) {
            throw new Error('Electron environment required for release submission');
        }

        const taskId = await this.createTask('ddex_delivery', `Submit: ${releaseData.title}`);
        await this.updateTask(taskId, { status: 'RUNNING', subtext: 'Starting pipeline…' });

        let cleanup: (() => void) | undefined;
        if (onProgress) {
            cleanup = (window.electronAPI.distribution as any).onSubmitProgress(onProgress);
        }

        try {
            const result = await (window.electronAPI.distribution as any).submitRelease(releaseData);

            if (!result.success) {
                await this.updateTask(taskId, { status: 'FAILED', error: result.error });
                throw new Error(result.error || 'Release submission failed');
            }

            await this.updateTask(taskId, {
                status: 'COMPLETED',
                progress: 100,
                subtext: result.report?.sftp_skipped ? 'DDEX built (SFTP skipped)' : 'Delivered to distributor',
                metadata: { report: result.report },
            });

            if (window.electronAPI) {
                window.electronAPI.showNotification(
                    'Release Submitted',
                    `${releaseData.title} has been delivered to your distributor.`
                );
            }

            return result.report;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown submission error';
            await this.updateTask(taskId, { status: 'FAILED', error: msg });
            throw error;
        } finally {
            cleanup?.();
        }
    }

    /**
     * Subscribe to releases
     */
    subscribeReleases(callback: (releases: any[]) => void, orgId?: string) {
        const userId = auth.currentUser?.uid;
        if (!userId) return () => { };

        const constraints = orgId
            ? [this.where('orgId', '==', orgId)]
            : [this.where('userId', '==', userId)];

        return this.releasesService.subscribe([...constraints, this.orderBy('createdAt', 'desc')], callback);
    }
}

export const distributionService = new DistributionService();
