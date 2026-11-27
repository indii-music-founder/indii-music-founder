import { describe, expect, it, vi } from 'vitest';
import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';
import {
  DecodedAudioBufferCache,
  NLEPreviewAudio,
  computeAudioSyncAdjustment,
  previewAudioState,
} from '@/services/video/nle/NLEPreviewAudio';

vi.mock('@/services/storage/resolveStorageUrl', () => ({
  resolveStorageUrl: vi.fn(async (src: string) => src),
}));

// Pure timing & scheduler checks (ISSUE-1510).
const clip: IndiiVideoClip = {
  id: 'timing',
  name: 'timing',
  type: 'audio',
  trackId: 'a',
  startFrame: 30,
  durationInFrames: 90,
  sourceInUs: 2_000_000,
  playbackRate: 2,
  volume: 0.6,
};

describe('preview audio timing and sample-accurate scheduling (ISSUE-1510)', () => {
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

  it('keeps <= 5 ms drift locked, applies smooth PLL micro-rate correction in 5-45 ms, and hard-seeks > 45 ms', () => {
    const locked = computeAudioSyncAdjustment(2.003, 2.0, 1.0, false);
    expect(locked.action).toBe('locked');
    expect(locked.targetRate).toBe(1.0);

    // Media running 20 ms ahead -> slightly slow down
    const ahead = computeAudioSyncAdjustment(2.02, 2.0, 1.0, false);
    expect(ahead.action).toBe('pll');
    expect(ahead.targetRate).toBeLessThan(1.0);
    expect(ahead.targetRate).toBeGreaterThanOrEqual(0.97);

    // Media running 20 ms behind -> slightly speed up
    const behind = computeAudioSyncAdjustment(1.98, 2.0, 1.0, false);
    expect(behind.action).toBe('pll');
    expect(behind.targetRate).toBeGreaterThan(1.0);
    expect(behind.targetRate).toBeLessThanOrEqual(1.03);

    // Drift > 45 ms -> immediate hard seek
    const seek = computeAudioSyncAdjustment(2.06, 2.0, 1.0, false);
    expect(seek.action).toBe('seek');
    expect(seek.seekToSeconds).toBeCloseTo(2.0, 6);
  });

  it('enforces bounded LRU eviction on decoded AudioBuffers to keep memory flatline', () => {
    const cache = new DecodedAudioBufferCache(2, 1024);
    const makeBuf = (length: number) => ({ length, numberOfChannels: 1, duration: 1 } as unknown as AudioBuffer);

    cache.set('clip-1', makeBuf(100)); // 400 bytes
    cache.set('clip-2', makeBuf(100)); // 400 bytes
    expect(cache.size).toBe(2);

    // Touch clip-1 so clip-2 becomes LRU
    expect(cache.get('clip-1')).toBeDefined();
    cache.set('clip-3', makeBuf(100));
    expect(cache.size).toBe(2);
    expect(cache.get('clip-1')).toBeDefined();
    expect(cache.get('clip-2')).toBeUndefined();
    expect(cache.get('clip-3')).toBeDefined();
  });

  it('schedules decoded audio clips through AudioBufferSourceNode + GainNode anchored to AudioContext.currentTime', async () => {
    const startSpy = vi.fn();
    const stopSpy = vi.fn();
    const setValueAtTime = vi.fn();
    const setTargetAtTime = vi.fn();
    const decodedBuffer = { length: 48000, numberOfChannels: 2, duration: 10 } as unknown as AudioBuffer;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockSource = {
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: startSpy,
      stop: stopSpy,
    };
    const mockGain = {
      gain: { value: 1, setValueAtTime, setTargetAtTime },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const mockContext = {
      currentTime: 5.25,
      destination: {},
      decodeAudioData: vi.fn().mockResolvedValue(decodedBuffer),
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGain),
    } as unknown as AudioContext;

    const project: IndiiVideoProject = {
      id: 'p1',
      name: 'Sample Accurate',
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
      tracks: [{ id: 'a', name: 'Audio 1', type: 'audio', isMuted: false, isSolo: false }],
      clips: [{ ...clip, src: 'https://cdn.example.com/stem.wav', playbackRate: 1 }],
    } as IndiiVideoProject;

    const onError = vi.fn();
    const engine = new NLEPreviewAudio(project, mockContext, onError);
    engine.sync(45, true, true);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(onError).not.toHaveBeenCalled();
    expect(mockContext.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy.mock.calls[0]![0]).toBeCloseTo(5.25, 6);
    expect(startSpy.mock.calls[0]![1]).toBeCloseTo(2.5, 6);
    expect(setValueAtTime).toHaveBeenCalledWith(0.6, 5.25);

    engine.close();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
