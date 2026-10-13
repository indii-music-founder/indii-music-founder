/**
 * rightsRegistration.ts
 *
 * Foundational schema and contract definitions for ISSUE-1511:
 * Assisted Rights Registration Engine — Screen Control & Browser Copilot
 * for Official Music Rights Infrastructure (US Copyright Office eCO, The MLC, PROs, SoundExchange, HFA).
 *
 * Bridges Artist Passport diagnostic findings directly into official royalty collection registration.
 */
/**
 * Validates the core integrity of a RightsRegistrationManifest.
 * Ensures legal name, target portals, and splits balance out to 100%.
 */
export function validateRegistrationManifest(manifest) {
    const errors = [];
    if (!manifest.artistLegalName || manifest.artistLegalName.trim().length === 0) {
        errors.push('Artist legal name is required for official copyright and royalty filings');
    }
    if (!manifest.targetPortals || manifest.targetPortals.length === 0) {
        errors.push('At least one target portal (e.g. loc_copyright, the_mlc) must be specified');
    }
    if (!manifest.work || !manifest.work.title || manifest.work.title.trim().length === 0) {
        errors.push('Work title is required');
    }
    if (manifest.work && (manifest.work.yearOfCreation < 1900 || manifest.work.yearOfCreation > new Date().getFullYear() + 1)) {
        errors.push('Year of creation must be a valid four-digit year');
    }
    if (manifest.splits && manifest.splits.length > 0) {
        const writerSplits = manifest.splits.filter((s) => s.role === 'writer_composer' || s.role === 'lyricist');
        if (writerSplits.length > 0) {
            const totalWriterShare = writerSplits.reduce((sum, s) => sum + s.sharePercentage, 0);
            if (Math.abs(totalWriterShare - 100) > 0.01) {
                errors.push(`Writer splits must total exactly 100% (currently ${totalWriterShare}%)`);
            }
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Validates a deposit asset prior to Library of Congress upload.
 */
export function validateDepositAsset(asset) {
    const errors = [];
    if (!asset.filename || asset.filename.trim().length === 0) {
        errors.push('Deposit filename is required');
    }
    if (asset.fileSizeBytes <= 0) {
        errors.push('Deposit file size must be greater than zero bytes');
    }
    if (!asset.sha256Checksum || !/^[a-f0-9]{64}$/i.test(asset.sha256Checksum)) {
        errors.push('Deposit asset requires a valid 64-character SHA-256 hexadecimal checksum');
    }
    const validMimes = ['audio/wav', 'audio/mpeg', 'audio/flac', 'application/pdf'];
    if (!validMimes.includes(asset.mimeType)) {
        errors.push(`Unsupported deposit MIME type: ${asset.mimeType}`);
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Builds a default structured Copilot Action sequence for a given portal target.
 */
export function generateCopilotActionPlan(manifest, target) {
    const actions = [];
    const primarySplit = manifest.splits[0];
    const formType = manifest.copyrightFormType || 'Form_SR';
    if (target === 'loc_copyright') {
        actions.push({
            id: 'loc-1',
            type: 'navigate',
            description: 'Navigate to US Copyright Office eCO Authentication Portal',
            value: 'https://eco.copyright.gov/ecoms/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'loc-2',
            type: 'pause_for_user_auth',
            description: 'User enters eCO login credentials and completes CAPTCHA authentication',
            requiresUserAction: true,
        });
        actions.push({
            id: 'loc-form',
            type: 'select_option',
            description: `Select Copyright Registration Application Type: ${formType.replace('_', ' ')}`,
            targetSelector: 'select#typeOfWork',
            targetFieldKey: 'copyrightFormType',
            value: formType,
            requiresUserAction: false,
        });
        actions.push({
            id: 'loc-3',
            type: 'autofill_input',
            description: `Populate Title of Work: "${manifest.work.title}"`,
            targetSelector: 'input#workTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        actions.push({
            id: 'loc-4',
            type: 'autofill_input',
            description: `Populate Year of Creation: ${manifest.work.yearOfCreation}`,
            targetSelector: 'input#creationYear',
            targetFieldKey: 'work.yearOfCreation',
            value: manifest.work.yearOfCreation,
            requiresUserAction: false,
        });
        actions.push({
            id: 'loc-5',
            type: 'autofill_input',
            description: `Populate Author / Claimant Legal Name: "${manifest.artistLegalName}"`,
            targetSelector: 'input#claimantName',
            targetFieldKey: 'artistLegalName',
            value: manifest.artistLegalName,
            requiresUserAction: false,
        });
        if (manifest.depositAssets.length > 0) {
            actions.push({
                id: 'loc-6',
                type: 'stage_deposit_upload',
                description: `Stage deposit copy for upload: ${manifest.depositAssets[0].filename} (SHA-256: ${manifest.depositAssets[0].sha256Checksum.slice(0, 8)}...)`,
                value: manifest.depositAssets[0].filename,
                requiresUserAction: false,
            });
        }
        actions.push({
            id: 'loc-7',
            type: 'pause_for_user_payment',
            description: 'User reviews official filing fee and enters payment details securely on Pay.gov',
            requiresUserAction: true,
        });
        actions.push({
            id: 'loc-8',
            type: 'extract_confirmation',
            description: 'Extract and record official Service Request (SR) number and timestamp',
            targetSelector: '.confirmation-number, #serviceRequestNumber',
            requiresUserAction: false,
        });
    }
    else if (target === 'the_mlc') {
        actions.push({
            id: 'mlc-1',
            type: 'navigate',
            description: 'Navigate to The MLC Portal',
            value: 'https://portal.themlc.com/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'mlc-2',
            type: 'pause_for_user_auth',
            description: 'User enters MLC Portal credentials',
            requiresUserAction: true,
        });
        actions.push({
            id: 'mlc-3',
            type: 'autofill_input',
            description: `Register Musical Work: "${manifest.work.title}"`,
            targetSelector: 'input#mlcWorkTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        if (manifest.work.iswc) {
            actions.push({
                id: 'mlc-4',
                type: 'autofill_input',
                description: `Enter ISWC: ${manifest.work.iswc}`,
                targetSelector: 'input#iswc',
                targetFieldKey: 'work.iswc',
                value: manifest.work.iswc,
                requiresUserAction: false,
            });
        }
        if (primarySplit) {
            actions.push({
                id: 'mlc-writer',
                type: 'autofill_input',
                description: `Populate Writer Share: ${primarySplit.legalName} (${primarySplit.sharePercentage}%)`,
                targetSelector: 'input#mlcWriterShare',
                targetFieldKey: 'splits.0.sharePercentage',
                value: primarySplit.sharePercentage,
                requiresUserAction: false,
            });
        }
        actions.push({
            id: 'mlc-5',
            type: 'extract_confirmation',
            description: 'Extract The MLC Work Registration ID',
            targetSelector: '#workRegistrationId',
            requiresUserAction: false,
        });
    }
    else if (target === 'bmi') {
        actions.push({
            id: 'bmi-1',
            type: 'navigate',
            description: 'Navigate to BMI Online Services Work Registration Portal',
            value: 'https://online.bmi.com/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'bmi-2',
            type: 'pause_for_user_auth',
            description: 'User signs into BMI Online Services account',
            requiresUserAction: true,
        });
        actions.push({
            id: 'bmi-3',
            type: 'autofill_input',
            description: `Populate BMI Work Title: "${manifest.work.title}"`,
            targetSelector: 'input#bmiWorkTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        actions.push({
            id: 'bmi-4',
            type: 'autofill_input',
            description: `Populate Writer Legal Name & Share: "${primarySplit?.legalName || manifest.artistLegalName}" (${primarySplit?.sharePercentage ?? 100}%)`,
            targetSelector: 'input#bmiWriterShare',
            targetFieldKey: 'splits.0.sharePercentage',
            value: primarySplit?.sharePercentage ?? 100,
            requiresUserAction: false,
        });
        if (manifest.work.isrc) {
            actions.push({
                id: 'bmi-5',
                type: 'autofill_input',
                description: `Populate Recording ISRC: ${manifest.work.isrc}`,
                targetSelector: 'input#bmiIsrc',
                targetFieldKey: 'work.isrc',
                value: manifest.work.isrc,
                requiresUserAction: false,
            });
        }
        actions.push({
            id: 'bmi-6',
            type: 'extract_confirmation',
            description: 'Extract BMI Work Registration Number',
            targetSelector: '#bmiWorkNumber, .bmi-confirmation-id',
            requiresUserAction: false,
        });
    }
    else if (target === 'ascap') {
        actions.push({
            id: 'ascap-1',
            type: 'navigate',
            description: 'Navigate to ASCAP Member Access Portal',
            value: 'https://members.ascap.com/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'ascap-2',
            type: 'pause_for_user_auth',
            description: 'User signs into ASCAP Member Access',
            requiresUserAction: true,
        });
        actions.push({
            id: 'ascap-3',
            type: 'autofill_input',
            description: `Populate ASCAP Title of Work: "${manifest.work.title}"`,
            targetSelector: 'input#ascapWorkTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        actions.push({
            id: 'ascap-4',
            type: 'autofill_input',
            description: `Populate Writer Share Percentage: ${primarySplit?.sharePercentage ?? 100}%`,
            targetSelector: 'input#ascapWriterShare',
            targetFieldKey: 'splits.0.sharePercentage',
            value: primarySplit?.sharePercentage ?? 100,
            requiresUserAction: false,
        });
        actions.push({
            id: 'ascap-5',
            type: 'extract_confirmation',
            description: 'Extract ASCAP Work ID Confirmation',
            targetSelector: '#ascapWorkId, .ascap-work-id',
            requiresUserAction: false,
        });
    }
    else if (target === 'soundexchange') {
        actions.push({
            id: 'sx-1',
            type: 'navigate',
            description: 'Navigate to SoundExchange Direct Portal',
            value: 'https://sportal.soundexchange.com/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'sx-2',
            type: 'pause_for_user_auth',
            description: 'User signs into SoundExchange Direct account',
            requiresUserAction: true,
        });
        actions.push({
            id: 'sx-3',
            type: 'autofill_input',
            description: `Populate Sound Recording Title: "${manifest.work.title}"`,
            targetSelector: 'input#sxRecordingTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        if (manifest.work.isrc) {
            actions.push({
                id: 'sx-4',
                type: 'autofill_input',
                description: `Populate Sound Recording ISRC: ${manifest.work.isrc}`,
                targetSelector: 'input#sxIsrc',
                targetFieldKey: 'work.isrc',
                value: manifest.work.isrc,
                requiresUserAction: false,
            });
        }
        actions.push({
            id: 'sx-5',
            type: 'autofill_input',
            description: `Populate Featured Artist / Rights Owner Name: "${manifest.artistLegalName}"`,
            targetSelector: 'input#sxClaimantName',
            targetFieldKey: 'artistLegalName',
            value: manifest.artistLegalName,
            requiresUserAction: false,
        });
        actions.push({
            id: 'sx-6',
            type: 'extract_confirmation',
            description: 'Extract SoundExchange Repertoire Submission ID',
            targetSelector: '#sxConfirmationId, .sx-submission-id',
            requiresUserAction: false,
        });
    }
    else if (target === 'hfa') {
        actions.push({
            id: 'hfa-1',
            type: 'navigate',
            description: 'Navigate to Harry Fox Agency / Songfile Portal',
            value: 'https://www.songfile.com/',
            requiresUserAction: false,
        });
        actions.push({
            id: 'hfa-2',
            type: 'pause_for_user_auth',
            description: 'User signs into HFA / Songfile account',
            requiresUserAction: true,
        });
        actions.push({
            id: 'hfa-3',
            type: 'autofill_input',
            description: `Populate Composition Title: "${manifest.work.title}"`,
            targetSelector: 'input#hfaSongTitle',
            targetFieldKey: 'work.title',
            value: manifest.work.title,
            requiresUserAction: false,
        });
        actions.push({
            id: 'hfa-4',
            type: 'autofill_input',
            description: `Populate Writer / Publisher Claimant: "${manifest.artistLegalName}"`,
            targetSelector: 'input#hfaWriterName',
            targetFieldKey: 'artistLegalName',
            value: manifest.artistLegalName,
            requiresUserAction: false,
        });
        actions.push({
            id: 'hfa-5',
            type: 'extract_confirmation',
            description: 'Extract HFA Song Code Confirmation',
            targetSelector: '#hfaSongCode, .hfa-confirmation-code',
            requiresUserAction: false,
        });
    }
    return actions;
}
/**
 * Constructs an immutable Provenance & Audit Trail filing record once an official submission
 * confirmation number or Service Request (SR) ID is captured from the portal.
 */
export function createRegistrationFilingRecord(manifest, portalTarget, confirmation) {
    const trimmedConfirmation = confirmation.confirmationNumber.trim();
    if (!trimmedConfirmation) {
        throw new Error('Official confirmation number is required to record a verified filing receipt');
    }
    const nowMs = Date.now();
    const filingDate = confirmation.officialFilingDate || new Date(nowMs).toISOString().split('T')[0];
    return {
        id: `filing_${portalTarget}_${manifest.manifestId}_${nowMs}`,
        artistId: manifest.artistId,
        portalTarget,
        workTitle: manifest.work.title,
        isrc: manifest.work.isrc,
        iswc: manifest.work.iswc,
        status: 'confirmed',
        confirmationNumber: trimmedConfirmation,
        serviceRequestId: confirmation.serviceRequestId?.trim() || undefined,
        officialFilingDate: filingDate,
        depositChecksum: manifest.depositAssets[0]?.sha256Checksum,
        filingFeeUsd: confirmation.filingFeeUsd,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
    };
}
