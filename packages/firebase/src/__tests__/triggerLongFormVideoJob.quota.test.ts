import { describe, expect, it } from 'vitest';

import { LongFormVideoJobSchema, validateStartImage } from '../lib/long_form_video';

/**
 * Structural request-contract tests. Server admission, entitlement, Arcjet,
 * and durable cost reservations are exercised in video.test.ts; these tests
 * keep the pure payload boundary deterministic without pretending to be a
 * customer or production-tier test.
 */
describe('triggerLongFormVideoJob request contract', () => {
    it('accepts server-injected identity and bounds each server-rendered segment', () => {
        const parsed = LongFormVideoJobSchema.parse({
            jobId: 'server-job-1',
            userId: 'owner-1',
            prompts: ['Opening scene'],
        });

        expect(parsed.jobId).toBe('server-job-1');
        expect(parsed.userId).toBe('owner-1');
        expect(parsed.prompts).toEqual(['Opening scene']);
    });

    it('rejects an unbounded prompt batch before it can reserve provider spend', () => {
        expect(() => LongFormVideoJobSchema.parse({
            prompts: Array.from({ length: 97 }, () => 'scene'),
        })).toThrow(/at most 96/i);
    });

    it('allows only server-priced Veo tiers and supported resolutions', () => {
        expect(LongFormVideoJobSchema.parse({
            prompts: ['scene'],
            options: { model: 'lite', resolution: '720p' },
        }).options).toMatchObject({ model: 'lite', resolution: '720p' });
        expect(() => LongFormVideoJobSchema.parse({
            prompts: ['scene'],
            options: { model: 'attacker-model' },
        })).toThrow();
        expect(() => LongFormVideoJobSchema.parse({
            prompts: ['scene'],
            options: { resolution: '16k' },
        })).toThrow();
    });

    it('accepts bounded image bytes and rejects remote or unsupported seed sources', () => {
        expect(validateStartImage('data:image/jpeg;base64,aGVsbG8=')).toBe('aGVsbG8=');
        expect(() => validateStartImage('https://169.254.169.254/latest/meta-data/')).toThrow(/Remote URLs/);
        expect(() => validateStartImage('data:image/svg+xml;base64,PHN2Zy8+')).toThrow(/JPEG, PNG, and WebP/);
    });
});
