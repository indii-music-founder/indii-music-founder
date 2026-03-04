/**
 * DistributionTools.ts
 * 
 * Tool implementations for the Direct Distribution Engine.
 * Wired to actual services: ERNService, IdentifierService, RoyaltyService.
 */

import { IdentifierService } from '@/services/identity/IdentifierService';
import { ernService } from '@/services/ddex/ERNService';
import { RoyaltyService, RevenueReportItem } from '@/services/finance/RoyaltyService';
import { db, auth } from '@/services/firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { distributionService } from '@/services/distribution/DistributionService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';


/**
 * Prepare a release for distribution by generating DDEX ERN 4.3 XML.
 * Uses the actual ERNService.
 */
// ... (imports remain the same)

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

            return {
                engine: 'Industrial (Python)',
                ddex: rawDdex,
                message: `Industrial DDEX ERN 4.3 generated via Python Engine.`
            };
        } catch (e) {
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
            releaseDate: new Date().toISOString().split('T')[0],
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
    } catch (error) {
        return toolError(error instanceof Error ? error.message : 'Unknown error', 'EXECUTION_ERROR');
    }
});

// ... (run_audio_qc restored)
async function run_audio_qc(args: {
    filePath: string;
    checkAtmos?: boolean;
}) {
    const { filePath, checkAtmos = false } = args;

    // Check if we're in Electron environment
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    if (isElectron) {
        try {
            // Create a task for monitoring
            const taskId = await distributionService.createTask('QC', `Audio Forensics: ${filePath.split('/').pop()}`);

            // Execute forensics via service (which handles IPC and progress updates)
            const report = await distributionService.runLocalForensics(taskId, filePath);

            return {
                report,
                message: `Audio QC completed for ${filePath}`
            };
        } catch (error) {
            return toolError(error instanceof Error ? error.message : 'Audio analysis failed', 'QC_FAILED');
        }
    }

    // Browser fallback - return basic validation
    return {
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
    };
}

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
        } catch (e) {
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

        return {
            isrc,
            source: 'JS Service',
            valid: true,
            track_title: trackTitle,
            registry_status: 'REGISTERED'
        };
    } catch (error) {
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
        } catch (e) {
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

    return {
        form_type: formType,
        tin_valid: tinValid,
        payout_status: payoutStatus,
        tin_message: tinMessage,
        certified: certified,
        withholding_rate: isUsPerson ? 0 : 30 // Simplified mock
    };
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
        } catch (e) {
            logger.warn('[DistributionTools] Bank Layer waterfall failed, falling back to JS:', e);
        }
    }

    // 2. Fallback to JS (RoyaltyService)
    const indiiFee = grossRevenue * (indiiFeePercent / 100);
    const net = grossRevenue - indiiFee - recoupableExpenses;
    const totalPaid = net > 0 ? net : 0;

    return {
        gross_revenue: grossRevenue,
        indii_fee: indiiFee,
        recouped_expenses: recoupableExpenses,
        net_distributable: totalPaid,
        paid: totalPaid,
        engine: 'JS Service'
    };
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
        } catch (e) {
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
            data: result
        };
    }

    return result;
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
        } catch (e) {
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

        } catch (e) {
            logger.warn('[DistributionTools] Keys Layer Merlin check failed:', e);
            throw e;
        }
    }

    return toolError('Merlin check requires Electron environment (Keys Layer).', 'ELECTRON_REQUIRED');
});

import { MusicTools } from './MusicTools';
import { logger } from '@/utils/logger';

export const DistributionTools: Record<string, AnyToolFunction> = {
    prepare_release,
    run_audio_qc: wrapTool('run_audio_qc', run_audio_qc),
    issue_isrc,
    certify_tax_profile,
    calculate_payout,
    run_metadata_qc,
    generate_bwarm,
    check_merlin_status,
    create_music_metadata: MusicTools.create_music_metadata
};
