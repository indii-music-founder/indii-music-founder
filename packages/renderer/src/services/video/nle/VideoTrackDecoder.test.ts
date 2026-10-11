import { describe, it, expect, vi } from 'vitest';
import {
  VideoTrackDecoder,
  type VideoFrameLike,
  type VideoDecoderFactory,
  type VideoDecoderLike,
} from './VideoTrackDecoder';

describe('VideoTrackDecoder - Ring-Buffered WebCodecs Decoder', () => {
  const createMockFrame = (timestampUs: number): VideoFrameLike => {
    return {
      timestamp: timestampUs,
      displayWidth: 1920,
      displayHeight: 1080,
      close: vi.fn(),
    };
  };

  it('buffers frames, finds frame by target PTS within tolerance, and purges older frames', () => {
    const decoder = new VideoTrackDecoder('test-track');

    const f1 = createMockFrame(0);
    const f2 = createMockFrame(33333); // ~30fps frame 1
    const f3 = createMockFrame(66666); // ~30fps frame 2

    decoder.addFrame(0n, f1);
    decoder.addFrame(33333n, f2);
    decoder.addFrame(66666n, f3);

    expect(decoder.getBufferedCount()).toBe(3);

    // Exact PTS match
    const exact = decoder.getFrameForPts(33333n);
    expect(exact).toBe(f2);

    // Approximate PTS match within 16666us tolerance
    const approx = decoder.getFrameForPts(35000n, 16666n);
    expect(approx).toBe(f2);

    // Far PTS should return null
    const far = decoder.getFrameForPts(200000n, 16666n);
    expect(far).toBeNull();

    // Purge frames before 33333n
    decoder.purgeBefore(33333n);
    expect(decoder.getBufferedCount()).toBe(2);
    expect(f1.close).toHaveBeenCalled();
    expect(f2.close).not.toHaveBeenCalled();

    // Full shutdown
    decoder.close();
    expect(decoder.getBufferedCount()).toBe(0);
    expect(f2.close).toHaveBeenCalled();
    expect(f3.close).toHaveBeenCalled();
  });

  it('evicts oldest frames when ring buffer capacity is exceeded', () => {
    const capacity = 2;
    const decoder = new VideoTrackDecoder('capacity-track', undefined, capacity);

    const f1 = createMockFrame(1000);
    const f2 = createMockFrame(2000);
    const f3 = createMockFrame(3000);

    decoder.addFrame(1000n, f1);
    decoder.addFrame(2000n, f2);
    expect(decoder.getBufferedCount()).toBe(2);

    // Adding 3rd frame should evict oldest (f1)
    decoder.addFrame(3000n, f3);
    expect(decoder.getBufferedCount()).toBe(2);
    expect(f1.close).toHaveBeenCalled();
    expect(decoder.getFrameForPts(1000n, 100n)).toBeNull();
    expect(decoder.getFrameForPts(3000n, 100n)).toBe(f3);
  });

  it('configures hardware acceleration via factory and releases pool slot on close', () => {
    let capturedConfig: unknown = null;
    const mockDecoderInstance: VideoDecoderLike = {
      state: 'configured',
      decode: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      close: vi.fn(),
      configure: (conf) => {
        capturedConfig = conf;
      },
    };

    const mockFactory: VideoDecoderFactory = {
      create: () => mockDecoderInstance,
    };

    const decoder = new VideoTrackDecoder('pool-track', mockFactory);
    expect(capturedConfig).toBeDefined();
    expect((capturedConfig as { hardwareAcceleration: string }).hardwareAcceleration).toBe('prefer-hardware');

    decoder.close();
    expect(mockDecoderInstance.close).toHaveBeenCalled();
  });
});
