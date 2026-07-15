/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
/**
 * DistributionTools.ts
 * 
 * Tool implementations for the Direct Distribution Engine.
 * Wired to actual services: IngestionNotificationService, IdentifierService, RoyaltyService.
 */

import { IdentifierService } from '@/services/identity/IdentifierService';
import { ingestionNotificationService, IngestionNotificationService } from '@/services/distribution/proprietary-ingestion/IngestionNotificationService';
import { db, auth, functions } from '@/services/firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { distributionService } from '@/services/distribution/DistributionService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { MusicTools } from './MusicTools';
import { logger } from '@/utils/logger';

/**
 * Prepare a release for distribution using the Industrial Engine (Python/DDEX).
 */
const prepare_release = wrapTool('prepare_release', async (args: {
    title: string;
	    artist: string;
	    upc: string;
	    isrc: string;
	    label: string;
	    genre: string;
	    language: string;
	    releaseDate: string;
	    releaseType?: string;
	}) => {
	    const { title, artist, upc, isrc, label, genre, language, releaseDate, releaseType = 'Single' } = args;
	    if (!label || !genre || !language || !releaseDate) {
	        return toolError('Distribution preparation requires label, genre, language, and release date. No placeholder metadata was generated.', 'MISSING_RELEASE_METADATA');
	    }

    // 1. Try Industrial Engine (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const rawDdex = await window.electronAPI.distribution.generateIngestionNotification({
                releaseId: `rel-${isrc}`,
                title,
                artists: [artist],
                upc,
                tracks: [{
                    // Minimal track payload for metadata-only preflight.
                    title,
                    isrc,
                    duration: 0,
                    resourceId: `res-${isrc}`,
                    artistNames: [artist]
                }],
                label: label,
	                genre
            });

            return toolSuccess({
                engine: 'Industrial (Python)',
                ddex: rawDdex,
            }, 'Industrial DDEX ERN 4.3 generated via Python Engine.');
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Industrial DDEX generation failed, falling back to JS Service:', e);
        }
    }

    // 2. Fallback to JS Service (Web Mode)
    try {
        if (!IdentifierService.validateISRC(isrc)) {
            return toolError(`Invalid ISRC format: ${isrc}`, 'INVALID_ISRC');
        }
        if (!IdentifierService.validateUPC(upc)) {
            return toolError(`Invalid UPC format: ${upc}`, 'INVALID_UPC');
        }

        const metadata: ExtendedGoldenMetadata = {
            id: `release-${Date.now()}`,
            trackTitle: title,
            artistName: artist,
            isrc,
            upc,
	            labelName: label,
	            releaseType: releaseType as 'Single' | 'EP' | 'Album',
	            genre,
	            subGenre: '',
	            language,
	            releaseDate,
            explicit: false,
            tracks: [],
            splits: [],
            pro: 'None',
            publisher: 'Self-Published',
            containsSamples: false,
            samples: [],
            isGolden: false, // Not golden: empty splits and default publisher (ISSUE-795)
            territories: ['Worldwide'],
            distributionChannels: ['streaming', 'download'],
            aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false }
        };

        const ernResult = await ingestionNotificationService.generateERN(metadata, undefined, 'generic', undefined, { isTestMode: false });
        if (!ernResult.success) return toolError(ernResult.error || 'ERN Generation Failed', 'ERN_ERROR');

        // Persist (Mirroring existing logic)
        const userId = auth.currentUser?.uid;
        if (userId) {
            await setDoc(doc(collection(db, 'proprietaryIngestionReleases')), {
                userId, title, artist, upc, isrc, label, releaseType,
                ernXml: ernResult.xml, status: 'STAGED', createdAt: serverTimestamp()
            });
        }

        return {
            engine: 'JS (Web Fallback)',
            ern_version: '4.3',
            message_id: `MSG-${Date.now()}`,
            release: { title, artist, upc, isrc },
            xml_length: ernResult.xml?.length || 0
        };
    } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : 'Unknown error', 'EXECUTION_ERROR');
    }
});

/**
 * Audio QC / Forensics — Electron uses Python layer, Browser returns partial results.
 */
const run_audio_qc = wrapTool('run_audio_qc', async (args: {
    filePath: string;
    checkAtmos?: boolean;
}) => {
    const { filePath, checkAtmos = false } = args;

    // Check if we're in Electron environment
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    if (isElectron) {
        // Create a task for monitoring
        const taskId = await distributionService.createTask('QC', `Audio Forensics: ${filePath.split('/').pop()}`);

        // Execute forensics via service (which handles IPC and progress updates)
        const report = await distributionService.runLocalForensics(taskId, filePath);

        return toolSuccess({
            report
        }, `Audio QC completed for ${filePath}`);
    }

    void checkAtmos;
    return toolError('Audio QC requires the Electron desktop bridge. No browser-only QC report was generated.', 'QC_BRIDGE_REQUIRED');
});

/**
 * Issue an ISRC using the Authority Layer (Python/Registry).
 */
const issue_isrc = wrapTool('issue_isrc', async (args: {
    trackTitle: string;
    artist: string;
    year?: number;
}) => {
    const { trackTitle, artist, year = new Date().getFullYear() } = args;

    // 1. Try Authority Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            // Options must match ISRCGenerationOptions interface
            const result = await window.electronAPI.distribution.generateISRC({
                year: year.toString(),
                trackTitle,
                artistName: artist
                // country/registrant not in interface, assuming handled by backend default logic
            });

            // Register it immediately
            await window.electronAPI.distribution.registerRelease({
                isrc: result.isrc,
                title: trackTitle,
                artist: artist,
                year: year
            });

            return toolSuccess({
                isrc: result.isrc,
                source: 'Authority Layer (Python)',
                registry_status: 'recorded_internal'
            }, `ISRC ${result.isrc} generated and recorded locally for "${trackTitle}". This is an internal identifier; official ISRC registration requires registration with an ISRC agency.`);
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Authority Layer ISRC generation failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS Service — issues from the verified backend pool (ISSUE-781)
    try {
        const isrc = await IdentifierService.nextISRC();

        const userId = auth.currentUser?.uid;
        if (userId) {
            // Best-effort registry record. The backend now enforces release
            // ownership (ISSUE-887), so a synthetic releaseId is rejected —
            // that must not fail the ISRC generation itself.
            try {
                const recordIdentifier = httpsCallable(functions, 'recordDistributionIdentifier');
                await recordIdentifier({
                    type: 'isrc',
                    isrc,
                    releaseId: `generated-${isrc}`,
                    trackTitle,
                    artistName: artist,
                    metadataSnapshot: { year, orgId: 'personal', source: 'DistributionTools.issue_isrc' },
                });
            } catch (recordErr) {
                logger.warn('[DistributionTools] ISRC registry record skipped (no owned release):', recordErr);
            }
        }

        return toolSuccess({
            isrc,
            source: 'JS Service',
            valid: true,
            track_title: trackTitle,
            registry_status: 'generated_local'
        }, `ISRC ${isrc} generated for "${trackTitle}". This is an internal identifier; official ISRC registration requires registration with an ISRC agency.`);
    } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : 'ISRC failed', 'ISRC_ERROR');
    }
});

/**
 * Certify tax profile using the Bank Layer (Python/Compliance).
 */
const certify_tax_profile = wrapTool('certify_tax_profile', async (args: {
    userId: string;
    fullName?: string;
    isUsPerson: boolean;
    isEntity?: boolean;
    country: string;
    tin: string;
    signedUnderPerjury: boolean;
}) => {
    const { userId, fullName, isUsPerson, isEntity, country, tin, signedUnderPerjury } = args;
    if (!fullName?.trim()) {
        return toolError('Legal name is required to certify a tax profile.', 'LEGAL_NAME_REQUIRED');
    }

    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            // Calculate status first
            const taxResult = await window.electronAPI.distribution.calculateTax({ userId, amount: 100 });

            // ISSUE-793: field names must match tax_withholding_engine.py's
            // certify_user() exactly (is_us_person, is_entity, tin,
            // signed_under_perjury) — the previous taxId/usPerson/signature
            // shape silently mismatched and certification could never succeed.
            const certResult = await window.electronAPI.distribution.certifyTax(userId, {
                full_name: fullName.trim(),
                country,
                tin,
                is_us_person: isUsPerson,
                is_entity: isEntity ?? false,
                signed_under_perjury: signedUnderPerjury
            });

            // Use 'certified' boolean and valid properties from TaxReport interface
            if (certResult.report?.certified && taxResult.report) {
                return {
                    status: certResult.report.payout_status, // "status" -> "payout_status"
                    withholding_rate: taxResult.report.withholding_rate,
                    engine: 'Bank Layer (Python)'
                };
            }
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Bank Layer certification failed:', e);
            return toolError('Tax certification failed in the Bank Layer. No certification was recorded.', 'TAX_CERTIFICATION_FAILED');
        }
    }

    void isUsPerson;
    void country;
    void tin;
    void signedUnderPerjury;
    return toolError('Tax certification requires the Electron Bank Layer. No browser-only certification was recorded.', 'TAX_BANK_LAYER_REQUIRED');
});

/**
 * Calculate payout using the Bank Layer (Python/Waterfall).
 */
const calculate_payout = wrapTool('calculate_payout', async (args: {
    grossRevenue: number;
    isrc?: string;
    indiiFeePercent?: number;
    recoupableExpenses?: number;
    splits: { name: string; email?: string; percentage: number; role?: string }[];
}) => {
    const { grossRevenue, isrc: _isrc, indiiFeePercent = 10, recoupableExpenses = 0, splits } = args;

    // 1. Try Bank Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            // Tool schema declares percent units (percentage: 50, indiiFeePercent: 10);
            // waterfall_payout.py requires 0-1 fractions for both (ISSUE-826).
            const splitsRecord: Record<string, number> = {};
            splits.forEach(s => {
                splitsRecord[s.email || s.name] = s.percentage / 100;
            });

            const waterfallResult = await window.electronAPI.distribution.executeWaterfall({
                gross: grossRevenue,
                splits: splitsRecord,
                recoupment: recoupableExpenses,
                indii_fee_percent: indiiFeePercent / 100
            });

            return {
                ...waterfallResult.report,
                message: `Industrial Waterfall Executed. Net Distributable: $${waterfallResult.report ? waterfallResult.report.total_distributed : 0}`
            };
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Bank Layer waterfall failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS (RoyaltyService)
    const indiiFee = grossRevenue * (indiiFeePercent / 100);
    const net = grossRevenue - indiiFee - recoupableExpenses;
    const totalPaid = net > 0 ? net : 0;

    return toolSuccess({
        gross_revenue: grossRevenue,
        indii_fee: indiiFee,
        recouped_expenses: recoupableExpenses,
        net_distributable: totalPaid,
        paid: totalPaid,
        engine: 'JS Service'
    }, `Payout calculated. Net distributable: $${totalPaid.toFixed(2)}.`);
});

/**
 * Run metadata QC using the Brain Layer (Python/Validator).
 */
const run_metadata_qc = wrapTool('run_metadata_qc', async (args: {
    title: string;
    artist: string;
    artworkUrl?: string;
}) => {
    const { title, artist, artworkUrl } = args;

    // 1. Try Brain Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const result = await window.electronAPI.distribution.validateMetadata({
                releaseId: `qc-${Date.now()}`,
                title,
                artists: [artist],
                tracks: [], // Basic validation doesn't always need tracks, but type might require it
                label: 'Indii Records'
            });

            if (result.report) {
                return {
                    ...result.report,
                    message: result.report.valid ? 'QC Passed' : `QC Failed: ${result.report.errors.length} errors`
                };
            }
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Brain Layer QC failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS - Robust Validation to match Python logic
    const errors: string[] = [];
    const warnings: string[] = [];
    let status = 'PASS';

    if (!title) errors.push('Missing Title');
    if (!artist) errors.push('Missing Artist');
    if (!artworkUrl) errors.push('Missing artwork URL - required for distribution');

    if (artist && (artist.toLowerCase() === 'various artists' || artist.toLowerCase() === 'unknown artist')) {
        errors.push('Generic artist name detected - will be rejected by DSPs');
    }

    if (title && title === title.toUpperCase() && /[a-zA-Z]/.test(title)) {
        warnings.push('ALL CAPS title detected - Apple/Spotify recommend Title Case');
        if (status === 'PASS') status = 'WARN';
    }

    if (title && (title.toLowerCase().includes('feat.') || title.toLowerCase().includes('ft.'))) {
        errors.push('Featured artist in title - must be in artist field per DDEX standard');
    }

    if (errors.length > 0) {
        status = 'FAIL';
    }

    const result = {
        status,
        errors,
        warnings,
        engine: 'JS Robust Check'
    };

    if (status === 'FAIL') {
        return {
            success: false,
            error: `QC Failed: ${errors.join(', ')}`,
            message: `QC Failed: ${errors.join(', ')}`,
            data: result,
            metadata: { timestamp: Date.now(), errorCode: 'QC_FAILED' }
        };
    }

    return toolSuccess(result, `Metadata QC ${status}: ${warnings.length} warning(s).`);
});

/**
 * Generate (The MLC) BWARM CSV via Keys Layer.
 */
const generate_bwarm = wrapTool('generate_bwarm', async (args: {
    works: Array<{ title: string; writer_last: string; writer_first: string; writer_ipi?: string }>;
}) => {
    const { works } = args;

    // 1. Try Keys Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const mappedWorks = works.map(w => ({
                title: w.title,
                writers: [`${w.writer_first} ${w.writer_last}`.trim()],
                isrc: '', // Optional/Unknown
            }));

            const result = await window.electronAPI.distribution.generateBWARM({ works: mappedWorks });

            return {
                csv: result.csv, // Raw CSV string
                report: result.report,
                engine: 'Keys Layer (Python)'
            };
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Keys Layer BWARM generation failed:', e);
            throw e;
        }
    }

    return toolError('BWARM generation requires Electron environment (Keys Layer).', 'ELECTRON_REQUIRED');
});

/**
 * Check Merlin Network compliance via Keys Layer.
 */
const check_merlin_status = wrapTool('check_merlin_status', async (args: {
    total_tracks: number;
    has_isrcs: boolean;
    has_upcs: boolean;
    exclusive_rights: boolean;
}) => {
    const { total_tracks: _total_tracks, has_isrcs: _has_isrcs, has_upcs: _has_upcs, exclusive_rights: _exclusive_rights } = args;

    // 1. Try Keys Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const result = await window.electronAPI.distribution.checkMerlinStatus({
                tracks: [],
                ...args
            });

            if (result.report) {
                return result.report;
            }
            throw new Error("No report returned");

        } catch (e: unknown) {
            logger.warn('[DistributionTools] Keys Layer Merlin check failed:', e);
            throw e;
        }
    }

    return toolError('Merlin check requires Electron environment (Keys Layer).', 'ELECTRON_REQUIRED');
});

export const DistributionTools = {
    prepare_release,
    run_audio_qc,
    issue_isrc,
    certify_tax_profile,
    calculate_payout,
    run_metadata_qc,
    generate_bwarm,
    check_merlin_status,
    create_music_metadata: MusicTools.create_music_metadata,

    distribute_premium_video: wrapTool('distribute_premium_video', async (args: { videoTitle: string; artistName: string; videoUrl: string; targetDSP: 'VEVO' | 'Apple Music Video' }) => {
        const dsp = args.targetDSP || 'VEVO';
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        // 1. Persist video release record to Firestore
        const videoReleaseRef = await addDoc(collection(db, 'video_releases'), {
            userId: uid,
            videoTitle: args.videoTitle,
            artistName: args.artistName,
            videoUrl: args.videoUrl,
            targetDSP: dsp,
            status: 'QUEUED',
            createdAt: serverTimestamp(),
        });

        return toolSuccess({
            videoTitle: args.videoTitle,
            artistName: args.artistName,
            targetDSP: dsp,
            releaseId: videoReleaseRef.id,
            deliveryStatus: 'QUEUED_FOR_MANUAL_REVIEW',
            note: `${dsp} ingestion is not automated in this build. Video release saved for manual processing.`,
        }, `Premium music video "${args.videoTitle}" saved for ${dsp} distribution. Manual processing is required because the DSP worker is not deployed.`);
    }),

    export_ddex_ern42: wrapTool('export_ddex_ern42', async (args: { releaseId: string; metadata: any }) => {
        // Wire to IngestionNotificationService for ERN export (Item 171)
        const trackTitle = args.metadata?.title || args.metadata?.trackTitle;
        const artistName = args.metadata?.artist || args.metadata?.artistName;
        const labelName = args.metadata?.label || args.metadata?.labelName;
        if (!trackTitle || !artistName || !args.metadata?.isrc || !args.metadata?.upc || !labelName || !args.metadata?.genre || !args.metadata?.releaseDate || !args.metadata?.language) {
            return toolError('ERN export requires track title, artist name, ISRC, UPC, label name, genre, release date, and language. No placeholder metadata was generated.', 'MISSING_RELEASE_METADATA');
        }

        // Build ExtendedGoldenMetadata from the provided metadata
        const meta: ExtendedGoldenMetadata = {
            id: args.releaseId,
            trackTitle,
            artistName,
            isrc: args.metadata.isrc,
            territories: [],
            distributionChannels: [],
            isGolden: false,
            upc: args.metadata.upc,
            labelName,
            releaseType: args.metadata?.releaseType || 'Single',
            genre: args.metadata.genre,
            subGenre: args.metadata?.subGenre || '',
            language: args.metadata.language,
            releaseDate: args.metadata.releaseDate,
            explicit: args.metadata?.explicit ?? false,
            tracks: args.metadata?.tracks || [],
            splits: args.metadata?.splits || [],
            pro: args.metadata?.pro || 'None',
            publisher: args.metadata?.publisher || 'Self-Published',
            containsSamples: args.metadata?.containsSamples ?? false,
            samples: args.metadata?.samples || [],
            aiGeneratedContent: args.metadata?.aiGeneratedContent || { isFullyAIGenerated: false, isPartiallyAIGenerated: false },
        };

        // Compute golden status based on actual requirements (ISSUE-795)
        const { MetadataOrchestrator } = await import('@/services/metadata/MetadataOrchestrator');
        meta.isGolden = MetadataOrchestrator.computeGoldenStatus(meta);

        try {
            const result = await ingestionNotificationService.generateERN(meta, undefined, 'generic', undefined, { isTestMode: false });
            if (!result.success) {
                return toolError(result.error || 'ERN generation failed', 'ERN_ERROR');
            }

            // Validate the generated XML (ISSUE-862: structural lint only, not XSD)
            const validationErrors = IngestionNotificationService.validateERNXML(result.xml || '');

            return toolSuccess({
                releaseId: args.releaseId,
                format: 'DDEX ERN 4.3',
                structuralLintPassed: validationErrors.length === 0,
                xsdValidated: false,
                validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
                xmlLength: result.xml?.length || 0,
            }, `Exported metadata for Release ${args.releaseId} to DDEX ERN 4.3 format via IngestionNotificationService. ${validationErrors.length === 0 ? 'Structural lint passed (required tags present) — NOT XSD/schema validated.' : `${validationErrors.length} structural validation issue(s) detected.`}`);
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : 'ERN export failed', 'ERN_EXPORT_ERROR');
        }
    }),

    generate_upc: wrapTool('generate_upc', async (args: { releaseTitle: string; recordLabel: string }) => {
        // Wire to IdentifierService (Item 172)
        try {
            const upc = await IdentifierService.nextUPC();
            const isValid = IdentifierService.validateUPC(upc);

            // Best-effort registry record — backend rejects synthetic release IDs
            // (ISSUE-887 ownership gate); that must not fail UPC generation.
            const uid = auth.currentUser?.uid;
            if (uid) {
                try {
                    const recordIdentifier = httpsCallable(functions, 'recordDistributionIdentifier');
                    await recordIdentifier({
                        type: 'upc',
                        upc,
                        releaseId: `generated-${upc}`,
                        releaseTitle: args.releaseTitle,
                        metadataSnapshot: {
                            recordLabel: args.recordLabel,
                            source: 'DistributionTools.generate_upc',
                        },
                    });
                } catch (recordErr) {
                    logger.warn('[DistributionTools] UPC registry record skipped (no owned release):', recordErr);
                }
            }

            return toolSuccess({
                releaseTitle: args.releaseTitle,
                recordLabel: args.recordLabel,
                upc,
                checksumValid: isValid,
                status: 'REGISTERED',
            }, `UPC generated (${upc}) via IdentifierService for release "${args.releaseTitle}". GTIN-12 checksum: ${isValid ? 'VALID' : 'INVALID'}.`);
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : 'UPC generation failed', 'UPC_ERROR');
        }
    }),

    sftp_direct_ingestion: wrapTool('sftp_direct_ingestion', async (args: { targetDSP: string; releaseFolder: string }) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        const createSftpIngestion = httpsCallable(functions, 'createSftpIngestionRecord');
        const updateSftpIngestion = httpsCallable(functions, 'updateSftpIngestionRecord');
        const ingestionResult = await createSftpIngestion({
            targetDSP: args.targetDSP,
            releaseFolder: args.releaseFolder,
        });
        const ingestionData = ingestionResult.data as { ingestionId?: string };
        const ingestionId = ingestionData.ingestionId;
        if (!ingestionId) {
            return toolError('SFTP ingestion did not return a server id.', 'SFTP_RECORD_ERROR');
        }

        // 2. Try Electron IPC for actual SFTP transfer
        if (typeof window !== 'undefined' && window.electronAPI) {
            try {
                // Use the sftp.uploadDirectory IPC channel for actual SFTP delivery
                const result = await window.electronAPI.sftp.uploadDirectory(
                    args.releaseFolder,
                    `/${args.targetDSP.toLowerCase().replace(/\s+/g, '_')}/releases/`,
                );

                if (!result.success) {
                    throw new Error(result.error || 'SFTP upload failed');
                }

                await updateSftpIngestion({
                    ingestionId,
                    status: 'TRANSFERRED',
                    filesTransferred: result.files?.length || 0,
                });

                return toolSuccess({
                    dsp: args.targetDSP,
                    folderPath: args.releaseFolder,
                    sftpStatus: 'Transferred Successfully',
                    ingestionId,
                    timestamp: new Date().toISOString(),
                    engine: 'Electron SFTP',
                }, `Direct SFTP pipeline successfully delivered "${args.releaseFolder}" to ${args.targetDSP} via Electron IPC.`);
            } catch (e: unknown) {
                logger.warn('[DistributionTools] Electron SFTP failed, trying Cloud Function:', e);
            }
        }

        // Manual fallback: the server-side SFTP worker is not deployed in this build.
        await updateSftpIngestion({
            ingestionId,
            status: 'PENDING_MANUAL',
        });

        return toolSuccess({
            dsp: args.targetDSP,
            folderPath: args.releaseFolder,
            sftpStatus: 'PENDING_MANUAL',
            ingestionId,
            note: 'Server-side SFTP delivery is unavailable in this build. Manual processing is required.',
        }, `SFTP delivery saved for manual processing. Configure ${args.targetDSP} SFTP delivery in a deployed worker to automate this path.`);
    }),

    toggle_content_id: wrapTool('toggle_content_id', async (args: {
        trackId: string;
        optIn: boolean;
        policy?: 'monetize' | 'track' | 'block';
        boundaries?: string[];
    }) => {
        // Item 233: Wire YouTube Content ID opt-in flag into release metadata / DDEX blob
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        const policy = args.policy || 'monetize';
        const releaseRef = doc(db, 'releases', args.trackId);
        const snap = await getDoc(releaseRef);

        if (!snap.exists()) {
            return toolError(`Release ${args.trackId} not found`);
        }

        // Persist flag to Firestore release record — IngestionNotificationMapper reads this on next delivery
        await setDoc(releaseRef, {
            'metadata.youtubeContentIdOptIn': args.optIn,
            'metadata.youtubeContentIdPolicy': args.optIn ? policy : null,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        return toolSuccess({
            trackId: args.trackId,
            contentIdStatus: args.optIn ? 'OPTED_IN' : 'OPTED_OUT',
            policy: args.optIn ? policy : null,
            boundaries: args.boundaries || ['Worldwide'],
            ddexDealIncluded: args.optIn,
        }, `Content ID delivery parameters saved for release ${args.trackId}. ` +
        `Status: ${args.optIn ? `Opted In (${policy})` : 'Opted Out'}. ` +
        `DDEX ERN will include UserMakeAvailableLabelProvided deal on next delivery.`);
    }),

    issue_automated_takedown: wrapTool('issue_automated_takedown', async (args: { releaseId: string; reason: string }) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        const releaseRef = doc(db, 'releases', args.releaseId);
        const releaseSnap = await getDoc(releaseRef);

        if (!releaseSnap.exists()) {
            return toolError(`Release ${args.releaseId} not found`, 'RELEASE_NOT_FOUND');
        }

        const requestTakedown = httpsCallable(functions, 'requestDistributionTakedown');
        const takedownResult = await requestTakedown({
            releaseId: args.releaseId,
            reason: args.reason,
        });
        const takedownData = takedownResult.data as { takedownId?: string };
        const takedownId = takedownData.takedownId;
        if (!takedownId) {
            return toolError('Takedown request did not return a server id.', 'TAKEDOWN_ERROR');
        }

        return toolSuccess({
            releaseId: args.releaseId,
            reason: args.reason,
            takedownId,
            status: 'RECORDED_PENDING_NOTIFICATION',
            note: 'Takedown recorded for manual follow-up. No distributor notification worker is deployed in this build.',
            estimatedRemovalTime: 'Unavailable until distributor notification is confirmed',
        }, `Takedown for release ${args.releaseId} recorded for manual follow-up. Distributor notification has not been sent.`);
    }),

    check_dsp_delivery_status: wrapTool('check_dsp_delivery_status', async (args: { releaseId: string; dspName?: string }) => {
        const { releaseId, dspName } = args;
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        try {
            const releaseRef = doc(db, 'releases', releaseId);
            const snap = await getDoc(releaseRef);

            if (!snap.exists()) {
                return toolError(`Release ${releaseId} not found`, 'RELEASE_NOT_FOUND');
            }

            const data = snap.data();
            const deliveryStatus = data.deliveryStatus || {};
            
            if (dspName) {
                const status = deliveryStatus[dspName] || 'NOT_DELIVERED';
                return toolSuccess({
                    releaseId,
                    dsp: dspName,
                    status
                }, `Delivery status for release ${releaseId} to ${dspName} is ${status}.`);
            } else {
                return toolSuccess({
                    releaseId,
                    statuses: deliveryStatus
                }, `Delivery statuses for release ${releaseId} retrieved successfully.`);
            }
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : 'Failed to check DSP delivery status', 'DSP_STATUS_ERROR');
        }
    }),

    validate_metadata_readiness: wrapTool('validate_metadata_readiness', async (args: { releaseId: string }) => {
        const { releaseId } = args;
        const uid = auth.currentUser?.uid;
        if (!uid) return toolError('User not authenticated');

        try {
            const releaseRef = doc(db, 'releases', releaseId);
            const snap = await getDoc(releaseRef);

            if (!snap.exists()) {
                return toolError(`Release ${releaseId} not found`, 'RELEASE_NOT_FOUND');
            }

            const data = snap.data();
            const metadata = data.metadata || {};
            
            const missingFields: string[] = [];
            if (!metadata.title && !data.title) missingFields.push('title');
            if (!metadata.artist && !data.artist) missingFields.push('artist');
            if (!metadata.genre && !data.genre) missingFields.push('genre');
            if (!metadata.isrc && !data.isrc) missingFields.push('isrc');

            const isReady = missingFields.length === 0;

            return toolSuccess({
                releaseId,
                isReady,
                missingFields
            }, isReady ? `Metadata for release ${releaseId} is ready for distribution.` : `Metadata for release ${releaseId} is incomplete. Missing fields: ${missingFields.join(', ')}.`);
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : 'Failed to validate metadata readiness', 'METADATA_VALIDATION_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
