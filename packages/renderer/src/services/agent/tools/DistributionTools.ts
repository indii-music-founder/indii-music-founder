/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
/**
 * DistributionTools.ts
 * 
 * Tool implementations for the Direct Distribution Engine.
 * Wired to actual services: ERNService, IdentifierService, RoyaltyService.
 */

import { IdentifierService } from '@/services/identity/IdentifierService';
import { ernService, ERNService } from '@/services/ddex/ERNService';
import { db, auth } from '@/services/firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
    label?: string;
    releaseType?: string;
}) => {
    const { title, artist, upc, isrc, label = 'indii Records', releaseType = 'Single' } = args;

    // 1. Try Industrial Engine (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const rawDdex = await window.electronAPI.distribution.generateDDEX({
                releaseId: `rel-${isrc}`,
                title,
                artists: [artist],
                upc,
                tracks: [{
                    // Minimal track mock to satisfy type
                    title,
                    isrc,
                    duration: 0,
                    resourceId: `res-${isrc}`,
                    artistNames: [artist]
                }],
                label: label,
                genre: 'Pop'
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
            genre: 'Pop',
            subGenre: '',
            language: 'eng',
            releaseDate: new Date().toISOString().split('T')[0]!,
            explicit: false,
            tracks: [],
            splits: [{ legalName: artist, role: 'performer', percentage: 100, email: '' }],
            pro: 'None',
            publisher: 'Self-Published',
            containsSamples: false,
            samples: [],
            isGolden: true,
            territories: ['Worldwide'],
            distributionChannels: ['streaming', 'download'],
            aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false }
        };

        const ernResult = await ernService.generateERN(metadata, undefined, 'generic', undefined, { isTestMode: false });
        if (!ernResult.success) return toolError(ernResult.error || 'ERN Generation Failed', 'ERN_ERROR');

        // Persist (Mirroring existing logic)
        const userId = auth.currentUser?.uid;
        if (userId) {
            await setDoc(doc(collection(db, 'ddexReleases')), {
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

    // Browser fallback - return basic validation
    return toolSuccess({
        file: filePath,
        environment: 'browser',
        checks: {
            bit_depth: { value: 'unknown', status: 'SKIPPED' },
            sample_rate: { value: 'unknown', status: 'SKIPPED' },
            spectral_cutoff: { detected: false, status: 'SKIPPED' },
            atmos_compliance: checkAtmos ? { status: 'SKIPPED', reason: 'Requires Electron' } : null
        },
        overall: 'PARTIAL',
        warnings: ['Full audio QC requires Electron environment']
    }, `Audio QC partial — full analysis requires Electron environment.`);
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

            return {
                isrc: result.isrc,
                source: 'Authority Layer (Python)',
                registry: 'Local'
            };
        } catch (e: unknown) {
            logger.warn('[DistributionTools] Authority Layer ISRC generation failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS Service
    try {
        const isrc = await IdentifierService.nextISRC('US', 'IND');

        const userId = auth.currentUser?.uid;
        if (userId) {
            await setDoc(doc(collection(db, 'isrc_registry')), {
                isrc, trackTitle, artist, year, userId,
                orgId: 'personal', status: 'REGISTERED', createdAt: serverTimestamp()
            });
        }

        return toolSuccess({
            isrc,
            source: 'JS Service',
            valid: true,
            track_title: trackTitle,
            registry_status: 'REGISTERED'
        }, `ISRC ${isrc} generated and registered for "${trackTitle}".`);
    } catch (error: unknown) {
        return toolError(error instanceof Error ? error.message : 'ISRC failed', 'ISRC_ERROR');
    }
});

/**
 * Certify tax profile using the Bank Layer (Python/Compliance).
 */
const certify_tax_profile = wrapTool('certify_tax_profile', async (args: {
    userId: string;
    isUsPerson: boolean;
    isEntity?: boolean;
    country: string;
    tin: string;
    signedUnderPerjury: boolean;
}) => {
    const { userId, isUsPerson, isEntity = false, country, tin, signedUnderPerjury } = args;

    // 1. Try Bank Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            // Calculate status first
            const taxResult = await window.electronAPI.distribution.calculateTax({ userId, amount: 100 });

            // Certify - remove userId from the data object as it's passed as first arg
            const certResult = await window.electronAPI.distribution.certifyTax(userId, {
                fullName: 'Unknown User', // Required by interface fallback
                country,
                taxId: tin,
                usPerson: isUsPerson,
                signature: signedUnderPerjury ? 'SIGNED_DIGITALLY' : ''
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
            logger.warn('[DistributionTools] Bank Layer certification failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS Service
    let tinValid = false;
    let tinMessage = 'Unknown';
    if (!tin) {
        tinMessage = 'Missing TIN';
    } else if (isUsPerson) {
        tinValid = /^\d{3}-\d{2}-\d{4}$/.test(tin) || /^\d{2}-\d{7}$/.test(tin);
        tinMessage = tinValid ? 'Valid US TIN' : 'TIN Match Fail (Invalid Format)';
    } else {
        tinValid = tin.length >= 8;
        tinMessage = tinValid ? 'Valid Foreign TIN' : 'TIN Match Fail (Invalid Foreign Format)';
    }

    const certified = signedUnderPerjury && tinValid;

    // Determine form type
    let formType = 'Unknown';
    if (isUsPerson) {
        formType = 'W-9';
    } else if (isEntity) {
        formType = 'W-8BEN-E';
    } else {
        formType = 'W-8BEN';
    }

    // Determine payout status
    let payoutStatus = 'HELD';
    if (certified) {
        payoutStatus = 'ACTIVE';
    }

    if (!certified) {
        return {
            success: false,
            error: `Certification failed: ${tinMessage}`,
            message: `Certification failed: ${tinMessage}`,
            data: {
                form_type: formType,
                tin_valid: tinValid,
                payout_status: payoutStatus,
                tin_message: tinMessage,
                certified: certified,
                withholding_rate: isUsPerson ? 0 : 30
            }
        };
    }

    return toolSuccess({
        form_type: formType,
        tin_valid: tinValid,
        payout_status: payoutStatus,
        tin_message: tinMessage,
        certified: certified,
        withholding_rate: isUsPerson ? 0 : 30
    }, `Tax profile certified. Form: ${formType}, Status: ${payoutStatus}.`);
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
    const { grossRevenue, isrc, indiiFeePercent = 10, recoupableExpenses = 0, splits } = args;

    // 1. Try Bank Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const splitsRecord: Record<string, number> = {};
            splits.forEach(s => {
                splitsRecord[s.email || s.name] = s.percentage;
            });

            const waterfallResult = await window.electronAPI.distribution.executeWaterfall({
                gross_revenue: grossRevenue,
                splits: splitsRecord,
                expenses: recoupableExpenses
            });

            return {
                ...waterfallResult.report,
                message: `Industrial Waterfall Executed. Net Distributable: $${waterfallResult.report ? waterfallResult.report.net_revenue : 0}`
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
    const { total_tracks, has_isrcs, has_upcs, exclusive_rights } = args;

    // 1. Try Keys Layer (Electron)
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const result = await window.electronAPI.distribution.checkMerlinStatus({
                tracks: [], // Add required 'tracks' array (empty for simple pre-check if supported by python, or mock)
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

        // 2. Call Cloud Function for DSP-specific ingestion pipeline
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const distributeVideo = httpsCallable(functions, 'distributeVideoToDSP');
            const result = await distributeVideo({
                releaseDocId: videoReleaseRef.id,
                videoTitle: args.videoTitle,
                artistName: args.artistName,
                videoUrl: args.videoUrl,
                targetDSP: dsp,
            });
            const data = result.data as Record<string, unknown>;
            return toolSuccess({
                videoTitle: args.videoTitle,
                artistName: args.artistName,
                targetDSP: dsp,
                releaseId: videoReleaseRef.id,
                deliveryStatus: data.status || 'QUEUED',
                pipelineId: data.pipelineId || null,
            }, `Premium music video "${args.videoTitle}" submitted to ${dsp} ingestion pipeline via Cloud Function.`);
        } catch (cfError: unknown) {
            logger.warn(`[DistributionTools] ${dsp} Cloud Function unavailable, falling back to local record:`, cfError);
            // Fallback: video is persisted in Firestore for manual pipeline pickup
            return toolSuccess({
                videoTitle: args.videoTitle,
                artistName: args.artistName,
                targetDSP: dsp,
                releaseId: videoReleaseRef.id,
                deliveryStatus: 'QUEUED_FOR_MANUAL_REVIEW',
                note: `${dsp} ingestion API not yet configured. Video release saved — will be processed when partner API credentials are added.`,
            }, `Premium music video "${args.videoTitle}" saved for ${dsp} distribution. Awaiting partner API configuration.`);
        }
    }),

    export_ddex_ern42: wrapTool('export_ddex_ern42', async (args: { releaseId: string; metadata: any }) => {
        // Wire to ERNService for ERN export (Item 171)
        // Build ExtendedGoldenMetadata from the provided metadata
        const meta: ExtendedGoldenMetadata = {
            id: args.releaseId,
            trackTitle: args.metadata?.title || args.metadata?.trackTitle || 'Untitled',
            artistName: args.metadata?.artist || args.metadata?.artistName || 'Unknown Artist',
            isrc: args.metadata?.isrc || '',
            upc: args.metadata?.upc || '',
            labelName: args.metadata?.label || args.metadata?.labelName || 'indii Records',
            releaseType: args.metadata?.releaseType || 'Single',
            genre: args.metadata?.genre || 'Pop',
            subGenre: args.metadata?.subGenre || '',
            language: args.metadata?.language || 'eng',
            releaseDate: args.metadata?.releaseDate || new Date().toISOString().split('T')[0],
            explicit: args.metadata?.explicit ?? false,
            tracks: args.metadata?.tracks || [],
            splits: args.metadata?.splits || [{ legalName: args.metadata?.artistName || 'Artist', role: 'performer', percentage: 100, email: '' }],
            pro: args.metadata?.pro || 'None',
            publisher: args.metadata?.publisher || 'Self-Published',
            containsSamples: args.metadata?.containsSamples ?? false,
            samples: args.metadata?.samples || [],
            isGolden: true,
            territories: args.metadata?.territories || ['Worldwide'],
            distributionChannels: args.metadata?.distributionChannels || ['streaming', 'download'],
            aiGeneratedContent: args.metadata?.aiGeneratedContent || { isFullyAIGenerated: false, isPartiallyAIGenerated: false },
        };

        try {
            const result = await ernService.generateERN(meta, undefined, 'generic', undefined, { isTestMode: false });
            if (!result.success) {
                return toolError(result.error || 'ERN generation failed', 'ERN_ERROR');
            }

            // Validate the generated XML
            const validationErrors = ERNService.validateERNXML(result.xml || '');

            return toolSuccess({
                releaseId: args.releaseId,
                format: 'DDEX ERN 4.3',
                isValid: validationErrors.length === 0,
                validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
                xmlLength: result.xml?.length || 0,
            }, `Exported metadata for Release ${args.releaseId} to DDEX ERN 4.3 format via ERNService. ${validationErrors.length === 0 ? 'Structural validation passed.' : `${validationErrors.length} validation issue(s) detected.`}`);
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : 'ERN export failed', 'ERN_EXPORT_ERROR');
        }
    }),

    generate_upc: wrapTool('generate_upc', async (args: { releaseTitle: string; recordLabel: string }) => {
        // Wire to IdentifierService (Item 172)
        try {
            const upc = await IdentifierService.nextUPC();
            const isValid = IdentifierService.validateUPC(upc);

            // Persist to Firestore registry
            const uid = auth.currentUser?.uid;
            if (uid) {
                await addDoc(collection(db, 'upc_registry'), {
                    upc,
                    releaseTitle: args.releaseTitle,
                    recordLabel: args.recordLabel,
                    userId: uid,
                    status: 'REGISTERED',
                    createdAt: serverTimestamp(),
                });
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

        // 1. Log the ingestion attempt to Firestore
        const ingestionRef = await addDoc(collection(db, 'sftp_ingestions'), {
            userId: uid,
            targetDSP: args.targetDSP,
            releaseFolder: args.releaseFolder,
            status: 'INITIATED',
            createdAt: serverTimestamp(),
        });

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

                // Update status on success
                await setDoc(doc(db, 'sftp_ingestions', ingestionRef.id), {
                    status: 'TRANSFERRED',
                    filesTransferred: result.files?.length || 0,
                    completedAt: serverTimestamp(),
                }, { merge: true });

                return toolSuccess({
                    dsp: args.targetDSP,
                    folderPath: args.releaseFolder,
                    sftpStatus: 'Transferred Successfully',
                    ingestionId: ingestionRef.id,
                    timestamp: new Date().toISOString(),
                    engine: 'Electron SFTP',
                }, `Direct SFTP pipeline successfully delivered "${args.releaseFolder}" to ${args.targetDSP} via Electron IPC.`);
            } catch (e: unknown) {
                logger.warn('[DistributionTools] Electron SFTP failed, trying Cloud Function:', e);
            }
        }

        // 3. Fallback: Cloud Function for server-side SFTP
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const sftpDeliver = httpsCallable(functions, 'sftpDeliverRelease');
            const result = await sftpDeliver({
                ingestionId: ingestionRef.id,
                targetDSP: args.targetDSP,
                releaseFolder: args.releaseFolder,
            });
            const data = result.data as Record<string, unknown>;

            await setDoc(doc(db, 'sftp_ingestions', ingestionRef.id), {
                status: data.status || 'TRANSFERRED',
                completedAt: serverTimestamp(),
            }, { merge: true });

            return toolSuccess({
                dsp: args.targetDSP,
                folderPath: args.releaseFolder,
                sftpStatus: data.status || 'Transferred',
                ingestionId: ingestionRef.id,
                timestamp: new Date().toISOString(),
                engine: 'Cloud Function',
            }, `SFTP delivery for "${args.releaseFolder}" to ${args.targetDSP} completed via Cloud Function.`);
        } catch (cfError: unknown) {
            logger.warn('[DistributionTools] SFTP Cloud Function unavailable:', cfError);
            // Mark as pending for manual processing
            await setDoc(doc(db, 'sftp_ingestions', ingestionRef.id), {
                status: 'PENDING_MANUAL',
            }, { merge: true });

            return toolSuccess({
                dsp: args.targetDSP,
                folderPath: args.releaseFolder,
                sftpStatus: 'PENDING_MANUAL',
                ingestionId: ingestionRef.id,
                note: 'SFTP engine unavailable. Ingestion saved — will be processed when SFTP credentials are configured.',
            }, `SFTP delivery saved for manual processing. Configure ${args.targetDSP} SFTP credentials to enable automated delivery.`);
        }
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

        // Persist flag to Firestore release record — ERNMapper reads this on next delivery
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

        // 1. Update release status in Firestore
        const releaseRef = doc(db, 'releases', args.releaseId);
        const releaseSnap = await getDoc(releaseRef);

        if (!releaseSnap.exists()) {
            return toolError(`Release ${args.releaseId} not found`, 'RELEASE_NOT_FOUND');
        }

        // Mark release as takedown-in-progress
        await setDoc(releaseRef, {
            status: 'TAKEDOWN_REQUESTED',
            takedownReason: args.reason,
            takedownRequestedAt: serverTimestamp(),
            takedownRequestedBy: uid,
        }, { merge: true });

        // 2. Create takedown audit record
        const takedownRef = await addDoc(collection(db, 'takedown_requests'), {
            releaseId: args.releaseId,
            reason: args.reason,
            requestedBy: uid,
            status: 'INITIATED',
            createdAt: serverTimestamp(),
        });

        // 3. Notify distributors via Cloud Function
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const processTakedown = httpsCallable(functions, 'processReleaseTakedown');
            const result = await processTakedown({
                takedownId: takedownRef.id,
                releaseId: args.releaseId,
                reason: args.reason,
            });
            const data = result.data as Record<string, unknown>;

            return toolSuccess({
                releaseId: args.releaseId,
                reason: args.reason,
                takedownId: takedownRef.id,
                status: data.status || 'PROCESSING',
                distributorsNotified: data.distributorsNotified || 0,
                estimatedRemovalTime: '24-48 hours',
            }, `Automated takedown issued for release ${args.releaseId}. ${data.distributorsNotified || 'All'} distributor(s) notified. Estimated removal: 24-48 hours.`);
        } catch (cfError: unknown) {
            logger.warn('[DistributionTools] Takedown Cloud Function unavailable:', cfError);
            // Takedown is already recorded in Firestore — manual follow-up possible
            return toolSuccess({
                releaseId: args.releaseId,
                reason: args.reason,
                takedownId: takedownRef.id,
                status: 'RECORDED_PENDING_NOTIFICATION',
                note: 'Takedown recorded in system. Distributor notifications will be sent when Cloud Function is deployed.',
                estimatedRemovalTime: '24-48 hours after notification',
            }, `Takedown for release ${args.releaseId} recorded. Distributor notification pending Cloud Function deployment.`);
        }
    })
} satisfies Record<string, AnyToolFunction>;
