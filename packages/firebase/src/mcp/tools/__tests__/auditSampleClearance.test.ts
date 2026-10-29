import { describe, expect, it } from 'vitest';
import { clearanceTrackOwnerAllowed, parseClearanceTrackId, summarizeSampleDeclarations } from '../sampleClearancePolicy.js';

// Pure policy/declaration regressions. No fabricated auth, database records or
// service responses; handler/database authorization still needs live acceptance.
describe('sample clearance declaration interpretation', () => {
    it('returns DECLARED-BUT-UNVERIFIED when samples are declared but unverified', () => {
        const result = summarizeSampleDeclarations(['declaration'], [], 'unverified');
        expect(result.data.verdict).toBe('DECLARED-BUT-UNVERIFIED');
        expect(result.data.samplesDeclarationCount).toBe(1);
        expect(result.data.fingerprintAnalysisAvailable).toBe(false);
        expect(result.warnings.join(' ')).toContain('CRITICAL');
        expect(result.warnings.join(' ')).not.toMatch(/fingerprint match/i);
    });
    it('returns NONE-DECLARED when no samples or interpolations exist', () => {
        const result = summarizeSampleDeclarations(undefined, undefined, undefined);
        expect(result.data.verdict).toBe('NONE-DECLARED');
        expect(result.data.samplesDeclarationCount).toBe(0);
    });
    it('counts interpolations alongside samples in the declaration count', () => {
        const result = summarizeSampleDeclarations(['a'], ['b', 'c'], 'unverified');
        expect(result.data.verdict).toBe('DECLARED-BUT-UNVERIFIED');
        expect(result.data.samplesDeclarationCount).toBe(3);
    });
    it('fails closed for absent or foreign legacy ownership', () => {
        for (const owner of [undefined, null, '', 'b', {}, true]) {
            expect(clearanceTrackOwnerAllowed('legacy', 'a', owner)).toBe(false);
        }
    });
    it('rejects missing/invalid track IDs before lookup', () => {
        for (const id of [undefined, null, '', ' ', '.', '..', 'a/b', 'a\\b', 'a\0b', 'a'.repeat(201)]) {
            expect(() => parseClearanceTrackId(id)).toThrow(TypeError);
        }
        expect(parseClearanceTrackId(' id ')).toBe('id');
    });
    it('never claims a fingerprint match, including when metadata says verified', () => {
        const result = summarizeSampleDeclarations(['declaration'], [], 'verified');
        expect(result.data.fingerprintAnalysisAvailable).toBe(false);
        expect(result.data.verdict).toBe('DECLARED-BUT-UNVERIFIED');
        expect(JSON.stringify(result)).not.toMatch(/fingerprint match/i);
    });
    it('allows explicit exact legacy ownership, without an admin or release bypass', () => {
        expect(clearanceTrackOwnerAllowed('legacy', 'a', 'a')).toBe(true);
        expect(clearanceTrackOwnerAllowed('legacy', 'a', 'a ')).toBe(false);
        expect(clearanceTrackOwnerAllowed('legacy', '', '')).toBe(false);
    });
    it('uses path ownership for scoped tracks and rejects conflicting stored owners', () => {
        expect(clearanceTrackOwnerAllowed('user', 'a', undefined)).toBe(true);
        expect(clearanceTrackOwnerAllowed('user', 'a', 'a')).toBe(true);
        expect(clearanceTrackOwnerAllowed('user', 'a', 'b')).toBe(false);
        expect(clearanceTrackOwnerAllowed('user', 'a', null)).toBe(false);
    });
    it('ignores non-array declarations without inventing fingerprint evidence', () => {
        const result = summarizeSampleDeclarations('not-an-array', {}, 'unverified');
        expect(result.data.samplesDeclarationCount).toBe(0);
        expect(result.data.fingerprintAnalysisAvailable).toBe(false);
    });
});
