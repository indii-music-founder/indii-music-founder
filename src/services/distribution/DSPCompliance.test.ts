import { validateDSPCompliance } from './types/DSPSpecs';
import { describe, it, expect } from 'vitest';

describe('DSP Compliance Coaching', () => {
    it('should flag low LUFS for Spotify', () => {
        const result = validateDSPCompliance('spotify', {
            lufs: -18, // too quiet
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 16
        }, {
            width: 3000,
            height: 3000,
            format: 'jpg'
        });

        expect(result.isCompliant).toBe(true); // Warnings don't block compliance
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.message).toContain('LUFS (-18 LUFS) differs significantly');
    });

    it('should flag wrong art format or size', () => {
        const result = validateDSPCompliance('apple_music', {
            format: 'wav',
            sampleRate: 44100,
            bitDepth: 24
        }, {
            width: 2000, // too small
            height: 2000,
            format: 'gif' // unsupported
        });

        expect(result.isCompliant).toBe(false);
        const errors = result.issues.filter(i => i.severity === 'error');
        expect(errors.length).toBeGreaterThanOrEqual(2);
    });
});
