import { describe, it, expect } from 'vitest';
import { DSPComplianceValidator } from './DSPComplianceValidator';

/**
 * ISSUE-997: neither the browser (RMS-derived loudness, unweighted peak) nor
 * the DAW-project (hardcoded -15 LUFS/-1.0 dBTP) input path performs a real
 * BS.1770 measurement. Every report must self-identify as an estimate so
 * downstream UI/consumers can never present `isCompliant` as a certified
 * distribution-compliance pass.
 */
describe('DSPComplianceValidator.validateAudio (ISSUE-997)', () => {
    it('always marks the report as an estimate, never a certified measurement', () => {
        const report = DSPComplianceValidator.validateAudio(-14, -1.0, 44100, 16);
        expect(report.measurementMethod).toBe('estimated');
    });

    it('marks the report as an estimate even when it reports full compliance', () => {
        // -15.5 LUFS sits inside both Spotify's (-16, -13] and Apple Music's
        // (-18, -15] tolerance windows simultaneously.
        const report = DSPComplianceValidator.validateAudio(-15.5, -1.5, 44100, 24);
        expect(report.isCompliant).toBe(true);
        expect(report.measurementMethod).toBe('estimated');
    });

    it('marks the report as an estimate even when it reports failures', () => {
        const report = DSPComplianceValidator.validateAudio(-5, 0, 22050, 8);
        expect(report.isCompliant).toBe(false);
        expect(report.measurementMethod).toBe('estimated');
    });
});
