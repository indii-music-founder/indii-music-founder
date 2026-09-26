/**
 * Mandatory distributor/DDEX metadata contract — ONE deterministic audit used
 * by both the cloud audit worker (P2) and the renderer readiness harness, so
 * client readiness and server audits can never disagree (plan §1.5).
 *
 * This module is deliberately self-contained (no renderer imports). Identifier
 * format patterns mirror `renderer/src/services/identity/IdentifierService.ts`
 * (ISRC/ISWC) and GTIN-12 checksum validation (UPC). Identifier PRESENCE is
 * audited by the cross-validation engine, not here — this module checks the
 * mandatory descriptive fields and the FORMAT of whatever identifiers exist.
 *
 * Jev never runs here: every check is deterministic by design.
 */

import { z } from 'zod';

export const MANDATORY_METADATA_SOURCE = 'mandatory-metadata.v1';

export const MandatoryMetadataInputSchema = z
    .object({
        /** Parental-advisory explicit flag — must be a declared boolean. */
        explicitFlag: z.boolean().optional(),
        /** ISO date (YYYY-MM-DD) */
        releaseDate: z.string().optional(),
        /** ISO 3166-1 alpha-2 territory codes; empty/missing is blocking. */
        territories: z.array(z.string().min(2).max(2)).optional(),
        /** Base language sub-tag (ISO 639-1/-2), optionally with region/script. */
        language: z.string().optional(),
        /** Recording year (P-Line/C-Line year). */
        recordingYear: z.number().int().optional(),
        /** Track-level artist role codes (e.g. MAIN_ARTIST, FEATURED_ARTIST). */
        artistRoles: z.array(z.string().min(2).max(40)).optional(),
        isrc: z.string().optional(),
        upc: z.string().optional(),
        iswc: z.string().optional(),
    })
    .strict();
export type MandatoryMetadataInput = z.infer<typeof MandatoryMetadataInputSchema>;

export const MetadataFindingSchema = z
    .object({
        field: z.string().min(1).max(120),
        requirement: z.string().min(1).max(300),
        observed: z.string().max(300),
        severity: z.enum(['blocking', 'warning']),
        source: z.literal(MANDATORY_METADATA_SOURCE),
    })
    .strict();
export type MetadataFinding = z.infer<typeof MetadataFindingSchema>;

// Format patterns (kept byte-identical in intent with IdentifierService).
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const ISWC_PATTERN = /^T-\d{9}-\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

/** GTIN-12 (UPC-A) mod-10 check digit validation. */
export function isValidUpcChecksum(upc: string): boolean {
    if (!/^\d{12}$/.test(upc)) return false;
    const digits = upc.split('').map(Number);
    // Positions 1..11 (0-based 0..10), odd positions (1st,3rd,...) weight 3.
    let sum = 0;
    for (let i = 0; i < 11; i += 1) {
        sum += digits[i]! * (i % 2 === 0 ? 3 : 1);
    }
    const check = (10 - (sum % 10)) % 10;
    return check === digits[11];
}

function finding(
    field: string,
    requirement: string,
    observed: string,
    severity: 'blocking' | 'warning' = 'blocking',
): MetadataFinding {
    return { field, requirement, observed, severity, source: MANDATORY_METADATA_SOURCE };
}

/**
 * Pure audit: returns every violation of the mandatory distributor metadata
 * contract. Empty array = audit clean. Deterministic, order-stable.
 */
export function auditMandatoryMetadata(input: MandatoryMetadataInput): MetadataFinding[] {
    const findings: MetadataFinding[] = [];

    if (typeof input.explicitFlag !== 'boolean') {
        findings.push(finding('explicitFlag', 'Explicit flag must be declared (true or false).', String(input.explicitFlag)));
    }

    if (!input.releaseDate) {
        findings.push(finding('releaseDate', 'Release date is mandatory for distribution.', String(input.releaseDate)));
    } else if (!ISO_DATE_PATTERN.test(input.releaseDate)) {
        findings.push(finding('releaseDate', 'Release date must be an ISO YYYY-MM-DD date.', input.releaseDate));
    }

    if (!input.territories || input.territories.length === 0) {
        findings.push(finding('territories', 'At least one territory code is mandatory.', JSON.stringify(input.territories ?? null)));
    } else {
        const invalid = input.territories.filter((code) => !/^[A-Z]{2}$/.test(code));
        if (invalid.length > 0) {
            findings.push(finding('territories', 'Territory codes must be uppercase ISO 3166-1 alpha-2.', invalid.join(',')));
        }
    }

    if (!input.language) {
        findings.push(finding('language', 'Language of performance is mandatory (DDEX LanguageAndScriptCode).', String(input.language)));
    } else if (!LANGUAGE_PATTERN.test(input.language)) {
        findings.push(finding('language', 'Language must be an ISO 639 base tag, optionally with region/script.', input.language));
    }

    if (!Number.isInteger(input.recordingYear)) {
        findings.push(finding('recordingYear', 'Recording year is mandatory (P-Line/C-Line year).', String(input.recordingYear)));
    } else {
        const maxYear = new Date().getUTCFullYear() + 1;
        if (input.recordingYear! < 1900 || input.recordingYear! > maxYear) {
            findings.push(finding('recordingYear', `Recording year must be between 1900 and ${maxYear}.`, String(input.recordingYear)));
        }
    }

    if (!input.artistRoles || input.artistRoles.length === 0) {
        findings.push(finding('artistRoles', 'Track-level artist roles are mandatory (main artist at minimum).', JSON.stringify(input.artistRoles ?? null)));
    }

    if (input.isrc !== undefined && input.isrc !== '' && !ISRC_PATTERN.test(input.isrc)) {
        findings.push(finding('isrc', 'ISRC must match ISO 3901 (e.g. USABC7123456).', input.isrc));
    }
    if (input.upc !== undefined && input.upc !== '' && !isValidUpcChecksum(input.upc)) {
        findings.push(finding('upc', 'UPC must be a 12-digit GTIN-12 with a valid check digit.', input.upc));
    }
    if (input.iswc !== undefined && input.iswc !== '' && !ISWC_PATTERN.test(input.iswc)) {
        findings.push(finding('iswc', 'ISWC must match CISAC format T-NNNNNNNN-C.', input.iswc));
    }

    return findings;
}

/** True when the audit raises nothing at all. */
export function mandatoryMetadataIsClean(input: MandatoryMetadataInput): boolean {
    return auditMandatoryMetadata(input).length === 0;
}
