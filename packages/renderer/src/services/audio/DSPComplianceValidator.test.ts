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

/**
 * ISSUE-1024: DAWIntegrationService.verifyDSPCompliance() used to fabricate
 * -15 LUFS/-1.0 dBTP constants for every DAW project file (no audio stream
 * exists to measure) and validate against them as if measured, producing an
 * identical, content-independent compliance verdict regardless of the
 * actual mix. validateFormatOnly() must never make a loudness/true-peak
 * claim at all.
 */
describe('DSPComplianceValidator.validateFormatOnly (ISSUE-1024)', () => {
    it('never claims a loudness/true-peak measurement', () => {
        const report = DSPComplianceValidator.validateFormatOnly(48000, 24);
        expect(report.measurementMethod).toBe('unavailable');
        expect(report.flags).toContain('Loudness/true-peak compliance not evaluated: project files carry no audio stream to measure.');
        for (const check of Object.values(report.platformChecks)) {
            expect(check.warnings.join(' ')).not.toMatch(/LUFS|dBTP/);
        }
    });

    it('still evaluates the genuinely-parsed sampleRate/bitDepth', () => {
        const compliant = DSPComplianceValidator.validateFormatOnly(48000, 24);
        expect(compliant.isCompliant).toBe(true);

        const subStandard = DSPComplianceValidator.validateFormatOnly(22050, 8);
        expect(subStandard.isCompliant).toBe(false);
        expect(subStandard.flags).toContain('REJECTION RISK: Format below required 44.1kHz threshold.');
    });

    it('defaults bitDepth to 16 when not provided, matching validateAudio()', () => {
        const report = DSPComplianceValidator.validateFormatOnly(44100);
        expect(report.isCompliant).toBe(true);
    });
});
