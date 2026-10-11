import { describe, it, expect } from 'vitest';
import { MasterAudioClock } from './MasterAudioClock';

describe('MasterAudioClock - Hardware Audio Clock Sync', () => {
  it('computes current timeline PTS from audio context elapsed time', () => {
    let mockCurrentTime = 10.0;
    const mockAudioCtx = {
      get currentTime() {
        return mockCurrentTime;
      },
      state: 'running' as AudioContextState,
    };

    const clock = new MasterAudioClock(mockAudioCtx, 60000);

    // Initial state before play
    expect(clock.getCurrentPts()).toBe(0n);
    expect(clock.getIsRunning()).toBe(false);

    // Start playback from PTS = 60000n (1.0s)
    clock.play(60000n);
    expect(clock.getIsRunning()).toBe(true);
    expect(clock.getCurrentPts()).toBe(60000n);

    // Advance mock audio clock by 0.5s
    mockCurrentTime = 10.5;
    expect(clock.getCurrentPts()).toBe(90000n); // 60000 + (0.5 * 60000)

    // Advance mock audio clock by another 1.25s
    mockCurrentTime = 11.75;
    expect(clock.getCurrentPts()).toBe(165000n); // 60000 + (1.75 * 60000)

    // Pause playback
    const pausedPts = clock.pause();
    expect(pausedPts).toBe(165000n);
    expect(clock.getIsRunning()).toBe(false);

    // Advancing audio clock after pause should not advance timeline PTS
    mockCurrentTime = 20.0;
    expect(clock.getCurrentPts()).toBe(165000n);
  });

  it('supports seek while running and paused', () => {
    let mockCurrentTime = 5.0;
    const mockAudioCtx = {
      get currentTime() {
        return mockCurrentTime;
      },
      state: 'running' as AudioContextState,
    };

    const clock = new MasterAudioClock(mockAudioCtx, 60000);
    clock.seek(30000n);
    expect(clock.getCurrentPts()).toBe(30000n);

    clock.play(30000n);
    mockCurrentTime = 6.0;
    expect(clock.getCurrentPts()).toBe(90000n);

    clock.seek(0n);
    expect(clock.getCurrentPts()).toBe(0n);
    mockCurrentTime = 7.0;
    expect(clock.getCurrentPts()).toBe(60000n);
  });
});
