/**
 * WebCodecs VideoTrackDecoder with Frame Ring-Buffer (Issue #413).
 *
 * Implements low-latency per-track decoding inside browser workers or UI threads.
 * Manages GPU surface lifecycle with strict explicit disposal (frame.close()).
 */

export interface VideoFrameLike {
  timestamp: number; // presentation timestamp in microseconds
  duration?: number | null;
  displayWidth: number;
  displayHeight: number;
  close: () => void;
}

export interface VideoDecoderLike {
  state: 'unconfigured' | 'configured' | 'closed';
  decode: (chunk: unknown) => void;
  flush: () => Promise<void>;
  reset: () => void;
  close: () => void;
  configure: (config: {
    codec: string;
    hardwareAcceleration?: 'prefer-hardware' | 'prefer-software';
    optimizeForLatency?: boolean;
  }) => void;
}

export interface VideoDecoderFactory {
  create: (init: {
    output: (frame: VideoFrameLike) => void;
    error: (e: Error | DOMException) => void;
  }) => VideoDecoderLike;
}

/** Global hardware decoder concurrency counter (max 4 concurrent hardware decoders) */
let activeHardwareDecoderCount = 0;
export const MAX_HARDWARE_DECODERS = 4;

export class VideoTrackDecoder {
  private trackId: string;
  private decoder: VideoDecoderLike | null = null;
  private frameRingBuffer: Map<bigint, VideoFrameLike> = new Map();
  private maxBufferedFrames: number;
  private isHardwareAccelerated = false;

  constructor(
    trackId: string,
    factory?: VideoDecoderFactory,
    maxBufferedFrames = 60
  ) {
    this.trackId = trackId;
    this.maxBufferedFrames = maxBufferedFrames;

    if (factory) {
      this.initDecoder(factory);
    }
  }

  private initDecoder(factory: VideoDecoderFactory): void {
    const preferHardware = activeHardwareDecoderCount < MAX_HARDWARE_DECODERS;
    if (preferHardware) {
      activeHardwareDecoderCount++;
      this.isHardwareAccelerated = true;
    }

    this.decoder = factory.create({
      output: (frame: VideoFrameLike) => {
        const pts = BigInt(Math.round(frame.timestamp));
        this.addFrame(pts, frame);
      },
      error: (e) => {
        console.error(`[VideoTrackDecoder:${this.trackId}] Decoder Error:`, e);
      },
    });

    this.decoder.configure({
      codec: 'avc1.640028', // H.264 High Profile Level 4.0
      hardwareAcceleration: preferHardware ? 'prefer-hardware' : 'prefer-software',
      optimizeForLatency: true,
    });
  }

  /**
   * Stores a decoded frame into the ring buffer, evicting oldest if capacity is exceeded.
   */
  public addFrame(ptsUs: bigint, frame: VideoFrameLike): void {
    if (this.frameRingBuffer.size >= this.maxBufferedFrames) {
      const oldestKey = this.frameRingBuffer.keys().next().value;
      if (oldestKey !== undefined) {
        const evicted = this.frameRingBuffer.get(oldestKey);
        evicted?.close();
        this.frameRingBuffer.delete(oldestKey);
      }
    }
    this.frameRingBuffer.set(ptsUs, frame);
  }

  /**
   * Finds the frame whose presentation timestamp is closest to targetPtsUs within tolerance (default 16.6ms / 1/60s).
   */
  public getFrameForPts(targetPtsUs: bigint, toleranceUs = 16666n): VideoFrameLike | null {
    let bestFrame: VideoFrameLike | null = null;
    let minDelta = toleranceUs + 1n;

    for (const [pts, frame] of this.frameRingBuffer.entries()) {
      const delta = pts >= targetPtsUs ? pts - targetPtsUs : targetPtsUs - pts;
      if (delta <= toleranceUs && delta < minDelta) {
        minDelta = delta;
        bestFrame = frame;
      }
    }

    return bestFrame;
  }

  /**
   * Explicitly closes and deletes all frames prior to cutoffPtsUs to free GPU memory surfaces.
   */
  public purgeBefore(cutoffPtsUs: bigint): void {
    for (const [pts, frame] of this.frameRingBuffer.entries()) {
      if (pts < cutoffPtsUs) {
        try {
          frame.close();
        } catch {
          // Frame may already be disposed
        }
        this.frameRingBuffer.delete(pts);
      }
    }
  }

  /**
   * Returns current count of buffered frames.
   */
  public getBufferedCount(): number {
    return this.frameRingBuffer.size;
  }

  /**
   * Shuts down decoder and cleans up all retained GPU textures and surfaces.
   */
  public close(): void {
    for (const frame of this.frameRingBuffer.values()) {
      try {
        frame.close();
      } catch {
        // Ignored
      }
    }
    this.frameRingBuffer.clear();

    if (this.decoder) {
      try {
        this.decoder.close();
      } catch {
        // Ignored
      }
      this.decoder = null;
    }

    if (this.isHardwareAccelerated) {
      activeHardwareDecoderCount = Math.max(0, activeHardwareDecoderCount - 1);
      this.isHardwareAccelerated = false;
    }
  }
}
