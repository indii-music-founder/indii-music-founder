import { describe, expect, it } from 'vitest';
import {
    MANDATORY_METADATA_SOURCE,
    auditMandatoryMetadata,
    isValidUpcChecksum,
    mandatoryMetadataIsClean,
} from './mandatoryMetadata.js';

const CLEAN = {
    explicitFlag: false,
    releaseDate: '2026-11-06',
    territories: ['US', 'GB', 'DE'],
    language: 'en',
    recordingYear: 2026,
    artistRoles: ['MAIN_ARTIST', 'FEATURED_ARTIST'],
    isrc: 'USABC7123456',
    upc: '036000291452',
    iswc: 'T-034524680-1',
};

describe('auditMandatoryMetadata', () => {
    it('passes a fully populated release', () => {
        expect(auditMandatoryMetadata(CLEAN)).toEqual([]);
        expect(mandatoryMetadataIsClean(CLEAN)).toBe(true);
    });

    it('blocks a missing explicit flag even when false-ish values are present', () => {
        const findings = auditMandatoryMetadata({ ...CLEAN, explicitFlag: undefined });
        expect(findings.map((f) => f.field)).toContain('explicitFlag');
        expect(findings.every((f) => f.source === MANDATORY_METADATA_SOURCE)).toBe(true);
    });

    it('blocks missing release date, territories, language, year, and artist roles', () => {
        const findings = auditMandatoryMetadata({}).map((f) => f.field);
        expect(findings).toEqual(expect.arrayContaining([
            'explicitFlag', 'releaseDate', 'territories', 'language', 'recordingYear', 'artistRoles',
        ]));
        expect(findings).not.toContain('isrc'); // presence audited elsewhere; format audited here
    });

    it('flags malformed dates, territories, and languages as blocking', () => {
        const findings = auditMandatoryMetadata({
            ...CLEAN,
            releaseDate: '11/06/2026',
            territories: ['usa', 'GB'],
            language: 'english',
        });
        const fields = findings.filter((f) => f.severity === 'blocking').map((f) => f.field);
        expect(fields).toEqual(expect.arrayContaining(['releaseDate', 'territories', 'language']));
    });

    it('bounds the recording year (1900..currentYear+1)', () => {
        expect(auditMandatoryMetadata({ ...CLEAN, recordingYear: 1899 }).map((f) => f.field)).toContain('recordingYear');
        expect(auditMandatoryMetadata({ ...CLEAN, recordingYear: new Date().getUTCFullYear() + 2 }).map((f) => f.field)).toContain('recordingYear');
        expect(auditMandatoryMetadata({ ...CLEAN, recordingYear: 1999 }).map((f) => f.field)).not.toContain('recordingYear');
    });

    it('audits identifier FORMAT when present and stays silent when absent', () => {
        expect(auditMandatoryMetadata({ ...CLEAN, isrc: 'usabc7123456' }).map((f) => f.field)).toContain('isrc');
        expect(auditMandatoryMetadata({ ...CLEAN, iswc: 'T-03452468-1' }).map((f) => f.field)).toContain('iswc');
        expect(auditMandatoryMetadata({ ...CLEAN, upc: '036000291453' }).map((f) => f.field)).toContain('upc');
        expect(auditMandatoryMetadata({ ...CLEAN, isrc: undefined, upc: undefined, iswc: undefined })).toEqual([]);
    });

    it('is deterministic and order-stable', () => {
        expect(auditMandatoryMetadata({})).toEqual(auditMandatoryMetadata({}));
    });
});

describe('isValidUpcChecksum (GTIN-12)', () => {
    it('accepts a canonical valid UPC', () => {
        expect(isValidUpcChecksum('036000291452')).toBe(true);
        expect(isValidUpcChecksum('012345678905')).toBe(true);
    });

    it('rejects bad check digits and malformed strings', () => {
        expect(isValidUpcChecksum('036000291453')).toBe(false);
        expect(isValidUpcChecksum('03600029145')).toBe(false);
        expect(isValidUpcChecksum('03600029145A')).toBe(false);
    });
});
