import { describe, expect, it } from 'vitest';
import { LongFormVideoJobSchema, resolveLongFormSegmentDuration } from './long_form_video';

describe('resolveLongFormSegmentDuration & LongFormVideoJobSchema BPM support', () => {
    it('quantizes 120 BPM (4 bars = 8s) and 160 BPM (4 bars = 6s) and 240 BPM (4 bars = 4s) to legal Veo durations', () => {
        expect(resolveLongFormSegmentDuration({ bpm: 120, promptCount: 4 })).toBe(8);
        expect(resolveLongFormSegmentDuration({ bpm: 160, promptCount: 4 })).toBe(6);
        expect(resolveLongFormSegmentDuration({ bpm: 240, promptCount: 4 })).toBe(4);
    });

    it('forces 8s when daisy-chain frame input is present with BPM', () => {
        expect(resolveLongFormSegmentDuration({ bpm: 160, promptCount: 4, hasFrameInput: true })).toBe(8);
    });

    it('preserves legacy totalDuration and 5s fallback behavior when bpm is omitted', () => {
        expect(resolveLongFormSegmentDuration({ promptCount: 3 })).toBe(5);
        expect(resolveLongFormSegmentDuration({ promptCount: 3, totalDuration: 12 })).toBe(4);
        expect(resolveLongFormSegmentDuration({ promptCount: 3, totalDuration: 18 })).toBe(6);
        expect(resolveLongFormSegmentDuration({ promptCount: 3, totalDuration: 24 })).toBe(8);
    });

    it('parses both legacy no-bpm jobs and new bpm-annotated jobs cleanly', () => {
        const legacy = LongFormVideoJobSchema.parse({ prompts: ['Scene 1', 'Scene 2'] });
        expect(legacy.bpm).toBeUndefined();

        const withBpm = LongFormVideoJobSchema.parse({
            prompts: ['Scene 1', 'Scene 2'],
            bpm: 128,
            options: { bpm: 128, model: 'pro', resolution: '1080p' },
        });
        expect(withBpm.bpm).toBe(128);
        expect(withBpm.options.bpm).toBe(128);
    });
});
