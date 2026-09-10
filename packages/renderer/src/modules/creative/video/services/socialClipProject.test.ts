import { describe, expect, it } from 'vitest';
import type { IndiiVideoProject } from '@indii/shared';
import { createSocialClipProject } from './socialClipProject';
import { validateMusicVideoDuration } from '../../creativeJourney';
const source = (): IndiiVideoProject => ({ id: 'source', name: 'Announcement', fps: 30, width: 1920, height: 1080, durationInFrames: 900,
    tracks: [{ id: 'v', name: 'Phone', type: 'video' }, { id: 't', name: 'Title', type: 'text' }],
    clips: [
        { id: 'phone', name: 'Recording', type: 'video', trackId: 'v', src: 'recording.mp4', canonicalSourceUri: 'gs://owned/recording.mp4', hasAudio: true, startFrame: 0, durationInFrames: 900, sourceInUs: 2_000_000, sourceOutUs: 32_000_000 },
        { id: 'title', name: 'Release', type: 'text', trackId: 't', text: 'Out Friday', startFrame: 180, durationInFrames: 300 },
    ],
});
describe('social clip timeline transformations (pure structural contract)', () => {
    it('preserves speech and source identity and cuts all tracks without mutating the original', () => {
        const original = source(); const before = structuredClone(original); const copy = createSocialClipProject(original, 300, 600, 'copy');
        expect(copy.clips[0]).toMatchObject({ startFrame: 0, durationInFrames: 300, sourceInUs: 12_000_000, sourceOutUs: 22_000_000, hasAudio: true, canonicalSourceUri: 'gs://owned/recording.mp4' });
        expect(copy.clips[1]).toMatchObject({ startFrame: 0, durationInFrames: 180, text: 'Out Friday' });
        copy.clips[1]!.text = 'Changed'; expect(original).toEqual(before); expect(copy.durationInFrames).toBe(300);
    });
    it.each(['9:16', '4:5'] as const)('fits the complete frame into %s', format => {
        const copy = createSocialClipProject(source(), 0, 900, 'copy', format);
        expect(copy.width).toBe(1080); expect(copy.height).toBe(format === '9:16' ? 1920 : 1350);
        expect(copy.clips[0]!.width).toBe(1); expect(copy.clips[0]!.y).toBeGreaterThan(0);
        expect((copy.clips[0]!.height! * copy.height) / copy.width).toBeCloseTo(1080 / 1920);
    });
    it('moves source trims in media time at double speed', () => {
        const project = source(); project.clips = [{ ...project.clips[0]!, playbackRate: 2, sourceOutUs: 62_000_000 }];
        expect(createSocialClipProject(project, 300, 600, 'copy').clips[0]).toMatchObject({ sourceInUs: 22_000_000, sourceOutUs: 42_000_000, durationInFrames: 300 });
    });
    it('requires rendering before cutting timed effects or copying approved sync', () => {
        const project = source(); project.clips[0]!.keyframes = { opacity: [{ frame: 0, value: 0 }, { frame: 400, value: 1 }] };
        expect(() => createSocialClipProject(project, 300, 600, 'copy')).toThrow('Render animated');
        delete project.clips[0]!.keyframes; project.clips[0]!.syncLock = true;
        expect(() => createSocialClipProject(project, 0, 900, 'copy')).toThrow('approved synced');
    });
    it.each([[-1, 30], [30, 30], [0, 901], [NaN, 30]])('rejects invalid range %s–%s', (start, end) => {
        expect(() => createSocialClipProject(source(), start, end, 'copy')).toThrow();
    });
    it('allows shorter songs and enforces the configured maximum', () => {
        expect(() => validateMusicVideoDuration(60)).not.toThrow(); expect(() => validateMusicVideoDuration(420)).not.toThrow();
        expect(() => validateMusicVideoDuration(421)).toThrow('7 minutes'); expect(() => validateMusicVideoDuration(Infinity)).toThrow();
    });
});
