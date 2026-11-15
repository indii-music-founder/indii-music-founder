import { describe, expect, it } from 'vitest';
import type { IndiiVideoClip } from '@indii/shared';
import { previewAudioState } from './NLEPreviewAudio';

// Pure timing calculations only; no account, media service, or playback is simulated.
const clip: IndiiVideoClip = { id: 'timing', name: 'timing', type: 'audio', trackId: 'a',
  startFrame: 30, durationInFrames: 90, sourceInUs: 2_000_000, playbackRate: 2, volume: 0.6 };
describe('preview audio timing', () => {
  it('maps offset and speed with half-open timeline boundaries', () => {
    expect(previewAudioState(clip, 29, 30).active).toBe(false);
    expect(previewAudioState(clip, 30, 30)).toMatchObject({ active: true, sourceSeconds: 2, rate: 2, gain: 0.6 });
    expect(previewAudioState(clip, 60, 30).sourceSeconds).toBe(4);
    expect(previewAudioState(clip, 120, 30).active).toBe(false);
  });
  it('stops at the source trim and applies timeline-relative fades', () => {
    expect(previewAudioState({ ...clip, sourceOutUs: 4_000_000 }, 60, 30).active).toBe(false);
    const faded = { ...clip, audioFade: { inSeconds: 1, outSeconds: 1 } };
    expect(previewAudioState(faded, 30, 30).gain).toBe(0);
    expect(previewAudioState(faded, 45, 30).gain).toBeCloseTo(0.3);
    expect(previewAudioState(faded, 105, 30).gain).toBeCloseTo(0.3);
  });
});
