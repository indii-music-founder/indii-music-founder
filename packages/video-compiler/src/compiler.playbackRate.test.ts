import { describe, expect, it } from 'vitest';
import { compileProjectToHyperFrames } from './compiler.js';
describe('source playback speed (pure compiler contract)', () => {
    it('converts a sped-up source trim into timeline seconds', () => {
        const { html } = compileProjectToHyperFrames({ id: 'speed', name: 'Speed', fps: 30, width: 1920, height: 1080, durationInFrames: 30,
            tracks: [{ id: 't1', name: 'Video', type: 'video' }], clips: [{ id: 'speed', type: 'video', src: 'input.mp4', name: 'speed', trackId: 't1', startFrame: 0, durationInFrames: 30, sourceInUs: 1_000_000, sourceOutUs: 3_000_000, playbackRate: 2 }] });
        expect(html).toContain('data-duration="1"'); expect(html).toContain('data-media-start="1"'); expect(html).toContain('data-playback-rate="2.000"');
    });
});
