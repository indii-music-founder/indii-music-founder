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

// ISRC Registry counter (in production, this would be in Firestore)
let isrcSequence = Math.floor(Math.random() * 90000) + 10000;

/**
 * Prepare a release for distribution by generating DDEX ERN 4.3 XML.
 * Uses the actual ERNService.
 */
async function prepare_release(args: {
    title: string;
    artist: string;
    upc: string;
    isrc: string;
    label?: string;
    releaseType?: string;
}): Promise<string> {
    const { title, artist, upc, isrc, label = 'indii Records', releaseType = 'Single' } = args;

    try {
        // Validate identifiers
        if (!IdentifierService.validateISRC(isrc)) {
            return JSON.stringify({
                success: false,
                error: `Invalid ISRC format: ${isrc}. Expected CC-XXX-YY-NNNNN pattern.`
            });
        }

        if (!IdentifierService.validateUPC(upc)) {
            return JSON.stringify({
                success: false,
                error: `Invalid UPC format: ${upc}. Expected 12-digit GTIN with valid check digit.`
            });
        }

        // Build minimal ExtendedGoldenMetadata for ERN generation
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
            aiGeneratedContent: {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: false
            }
        };

        // Generate ERN using the real service
        const ernResult = await ernService.generateERN(metadata, undefined, 'generic', undefined, { isTestMode: false });

        if (!ernResult.success) {
            return JSON.stringify({
                success: false,
                error: ernResult.error || 'ERN generation failed'
            });
        }

        // Save to Firestore if user is authenticated
        const userId = auth.currentUser?.uid;
        if (userId) {
            const releaseRef = doc(collection(db, 'ddexReleases'));
            await setDoc(releaseRef, {
                userId,
                title,
                artist,
                upc,
                isrc,
                label,
                releaseType,
                ernXml: ernResult.xml,
                status: 'STAGED',
                createdAt: serverTimestamp()
            });
        }

        return JSON.stringify({
            success: true,
            data: {
                ern_version: '4.3',
                message_id: `MSG-${Date.now()}`,
                release: { title, artist, upc, isrc, label, type: releaseType },
                status: 'STAGED',
                xml_length: ernResult.xml?.length || 0,
                next_step: 'Run audio QC before transmission'
            },
            message: `DDEX ERN 4.3 message generated for "${title}" by ${artist}`
        });
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Run audio quality control (spectral analysis, fraud detection).
 * In Electron, this would call the main process via IPC.
 */
async function run_audio_qc(args: {
    filePath: string;
    checkAtmos?: boolean;
}): Promise<string> {
    const { filePath, checkAtmos = false } = args;

    // Check if we're in Electron environment
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    if (isElectron) {
        try {
            // Call Electron main process for actual audio analysis
            const result = await (window as any).electronAPI.audio.analyzeFile(filePath, { checkAtmos });
            return JSON.stringify({
                success: true,
                data: result,
                message: `Audio QC completed for ${filePath}`
            });
        } catch (error) {
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Audio analysis failed'
            });
        }
    }

    // Browser fallback - return basic validation
    return JSON.stringify({
        success: true,
        data: {
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
        },
        message: 'Partial QC - full analysis requires desktop app'
    });
}

/**
 * Issue an ISRC for a new recording.
 * Uses the real IdentifierService and persists to Firestore.
 */
async function issue_isrc(args: {
    trackTitle: string;
    artist: string;
    year?: number;
}): Promise<string> {
    const { trackTitle, artist, year = new Date().getFullYear() } = args;

    try {
        // Generate ISRC using the real service
        const sequence = ++isrcSequence;
        const isrc = IdentifierService.generateISRC(year % 100, sequence, 'US', 'IND');

        // Validate the generated ISRC
        if (!IdentifierService.validateISRC(isrc)) {
            return JSON.stringify({
                success: false,
                error: 'Generated ISRC failed validation'
            });
        }

        // Persist to Firestore if authenticated
        const userId = auth.currentUser?.uid;
        if (userId) {
            const isrcRef = doc(collection(db, 'isrc_registry'));
            await setDoc(isrcRef, {
                isrc,
                trackTitle,
                artist,
                year,
                userId,
                orgId: 'personal', // Will be org-scoped in production
                status: 'REGISTERED',
                createdAt: serverTimestamp()
            });
        }

        return JSON.stringify({
            success: true,
            data: {
                isrc,
                track_title: trackTitle,
                artist,
                year,
                issued_at: new Date().toISOString(),
                registry_status: 'REGISTERED',
                valid: true
            },
            message: `ISRC ${isrc} issued for "${trackTitle}"`
        });
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'ISRC generation failed'
        });
    }
}

/**
 * Certify a user's tax profile (W-8BEN/W-9 wizard).
 * Persists to Firestore for compliance record-keeping.
 */
async function certify_tax_profile(args: {
    userId: string;
    isUsPerson: boolean;
    isEntity?: boolean;
    country: string;
    tin: string;
    signedUnderPerjury: boolean;
}): Promise<string> {
    const { userId, isUsPerson, isEntity = false, country, tin, signedUnderPerjury } = args;

    // Determine form type
    let formType = 'W-9';
    if (!isUsPerson) {
        formType = isEntity ? 'W-8BEN-E' : 'W-8BEN';
    }

    // TIN validation with specific error messages
    let tinValid = false;
    let tinMessage = 'Unknown format';

    if (!tin || tin.trim() === '') {
        tinValid = false;
        tinMessage = 'TIN Match Fail: Missing Tax Identification Number';
    } else if (isUsPerson) {
        const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
        const einPattern = /^\d{2}-\d{7}$/;
        if (ssnPattern.test(tin)) {
            tinValid = true;
            tinMessage = 'Valid US SSN Format';
        } else if (einPattern.test(tin)) {
            tinValid = true;
            tinMessage = 'Valid US EIN Format';
        } else {
            tinMessage = 'TIN Match Fail: Invalid US SSN/EIN format. Expected XXX-XX-XXXX or XX-XXXXXXX';
        }
    } else {
        // Foreign TIN validation (country-specific)
        const minLength = country === 'UK' ? 10 : 8;
        if (tin.length >= minLength && /^[A-Z0-9]+$/i.test(tin)) {
            tinValid = true;
            tinMessage = `Valid ${country} FTIN Format`;
        } else {
            tinMessage = `TIN Match Fail: Invalid Foreign FTIN format for ${country}`;
        }
    }

    const certified = signedUnderPerjury && tinValid;
    const payoutStatus = certified ? 'ACTIVE' : 'HELD';

    // Persist to Firestore
    try {
        const currentUser = auth.currentUser?.uid;
        if (currentUser) {
            const taxProfileRef = doc(db, 'tax_profiles', userId);
            await setDoc(taxProfileRef, {
                userId,
                formType,
                country,
                tinValid,
                tinMessage,
                certified,
                payoutStatus,
                isUsPerson,
                isEntity,
                certifiedBy: currentUser,
                certTimestamp: certified ? serverTimestamp() : null,
                updatedAt: serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error('[DistributionTools] Failed to persist tax profile:', error);
    }

    return JSON.stringify({
        success: certified,
        data: {
            user_id: userId,
            form_type: formType,
            country,
            tin_valid: tinValid,
            tin_message: tinMessage,
            certified,
            payout_status: payoutStatus,
            cert_timestamp: certified ? new Date().toISOString() : null
        },
        message: certified
            ? `Tax profile certified. Payouts are ${payoutStatus}.`
            : `Certification failed: ${tinMessage}. Payouts are HELD.`
    });
}

/**
 * Calculate royalty payout using the real RoyaltyService.
 */
async function calculate_payout(args: {
    grossRevenue: number;
    isrc?: string;
    indiiFeePercent?: number;
    recoupableExpenses?: number;
    splits: { name: string; email?: string; percentage: number; role?: string }[];
}): Promise<string> {
    const { grossRevenue, isrc = 'USIND0000001', indiiFeePercent = 10, recoupableExpenses = 0, splits } = args;

    try {
        // Step 1: Deduct indii platform fee
        const indiiFee = grossRevenue * (indiiFeePercent / 100);
        let netAfterFee = grossRevenue - indiiFee;

        // Step 2: Recoup expenses (if any)
        const recouped = Math.min(recoupableExpenses, netAfterFee);
        netAfterFee -= recouped;

        // Step 3: Build metadata and revenue items for RoyaltyService
        const metadata: ExtendedGoldenMetadata = {
            id: `calc-${Date.now()}`,
            trackTitle: 'Payout Calculation',
            artistName: 'Various',
            isrc,
            upc: '000000000000',
            labelName: 'indii Records',
            releaseType: 'Single',
            genre: 'Various',
            explicit: false,
            releaseDate: new Date().toISOString().split('T')[0],
            splits: splits.map(s => ({
                legalName: s.name,
                email: s.email || `${s.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
                percentage: s.percentage,
                role: (s.role || 'other') as 'songwriter' | 'producer' | 'performer' | 'other'
            })),
            pro: 'None',
            publisher: 'Self-Published',
            containsSamples: false,
            samples: [],
            isGolden: true,
            territories: ['Worldwide'],
            distributionChannels: ['streaming'],
            aiGeneratedContent: {
                isFullyAIGenerated: false,
                isPartiallyAIGenerated: false
            }
        };

        const revenueItems: RevenueReportItem[] = [{
            transactionId: `TXN-${Date.now()}`,
            isrc,
            platform: 'indii',
            territory: 'WW',
            grossRevenue: netAfterFee,
            currency: 'USD'
        }];

        // Calculate splits using the real service
        const payouts = RoyaltyService.calculateSplits(revenueItems, { [isrc]: metadata });

        const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);

        // Persist payout record to Firestore
        const userId = auth.currentUser?.uid;
        if (userId) {
            await addDoc(collection(db, 'royaltyPayments'), {
                userId,
                orgId: 'personal',
                grossRevenue,
                indiiFee,
                recouped,
                netDistributable: netAfterFee,
                payouts: payouts.map(p => ({
                    userId: p.userId,
                    amount: p.amount,
                    role: p.role
                })),
                totalPaid,
                currency: 'USD',
                createdAt: serverTimestamp()
            });
        }

        return JSON.stringify({
            success: true,
            data: {
                gross_revenue: grossRevenue,
                indii_fee: indiiFee,
                recouped_expenses: recouped,
                net_distributable: netAfterFee,
                payouts: payouts.map(p => ({
                    name: p.userId.split('@')[0],
                    email: p.userId,
                    amount: p.amount,
                    role: p.role
                })),
                total_paid: totalPaid
            },
            message: `Waterfall complete. $${totalPaid.toFixed(2)} distributed across ${payouts.length} parties.`
        });
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Payout calculation failed'
        });
    }
}

/**
 * Run metadata QC against style guides (Apple/Spotify).
 */
async function run_metadata_qc(args: {
    title: string;
    artist: string;
    artworkUrl?: string;
}): Promise<string> {
    const { title, artist, artworkUrl } = args;
    const warnings: string[] = [];
    const errors: string[] = [];

    // Title checks
    if (title === title.toUpperCase() && title.length > 3) {
        warnings.push('ALL CAPS title detected - Apple/Spotify recommend Title Case');
    }
    if (/\(feat\.|ft\.|featuring/i.test(title)) {
        errors.push('Featured artist in title - must be in artist field per DDEX standard');
    }
    if (/\(remix\)|remix$/i.test(title) && !/\s-\s/.test(title)) {
        warnings.push('Remix detected - consider format: "Track Title - Artist Name Remix"');
    }
    if (title.length > 100) {
        warnings.push('Title exceeds 100 characters - may be truncated on some platforms');
    }

    // Artist checks
    const genericArtists = ['various', 'unknown', 'artist', 'va', 'various artists', 'n/a'];
    if (genericArtists.includes(artist.toLowerCase())) {
        errors.push('Generic artist name detected - will be rejected by DSPs');
    }
    if (artist.includes(',') && !artist.includes('feat')) {
        warnings.push('Multiple artists without "feat." - consider using proper featuring syntax');
    }

    // Artwork check
    if (!artworkUrl) {
        errors.push('Missing artwork URL - required for distribution');
    } else if (!artworkUrl.startsWith('http')) {
        errors.push('Artwork URL must be a valid HTTP(S) URL');
    }

    const status = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

    return JSON.stringify({
        success: errors.length === 0,
        data: {
            title,
            artist,
            status,
            errors,
            warnings,
            compliant: errors.length === 0,
            ready_for_distribution: errors.length === 0 && warnings.length === 0
        },
        message: `Metadata QC ${status}: ${errors.length} errors, ${warnings.length} warnings`
    });
}

export const DistributionTools: Record<string, (args: any) => Promise<string>> = {
    prepare_release,
    run_audio_qc,
    issue_isrc,
    certify_tax_profile,
    calculate_payout,
    run_metadata_qc
};
