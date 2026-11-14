import type { Input, VideoSample, VideoSampleSink } from 'mediabunny';

/** One lazily opened media file. The caller owns each returned VideoFrame. */
export class NLEVideoSource {
  private static hardwareReaders = 0;
  private ownsHardwareSlot = false;
  private input: Input | null = null;
  private sink: Promise<VideoSampleSink> | null = null;
  private closed = false;
  private orientationCanvas: OffscreenCanvas | null = null;
  private samples: AsyncGenerator<VideoSample, void, unknown> | null = null;
  private current: VideoSample | null = null;
  private next: VideoSample | null = null;

  constructor(private readonly uri: string) {}

  private async open(): Promise<VideoSampleSink> {
    const { Input, ALL_FORMATS, UrlSource, VideoSampleSink } =
      await import('mediabunny');
    const url = this.uri.startsWith('gs://')
      ? await (
          await import('@/services/storage/resolveStorageUrl')
        ).resolveStorageUrl(this.uri)
      : this.uri;
    if (this.closed) throw new Error('Video source was closed.');
    const input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(url, {
        maxCacheSize: 8 * 1024 * 1024,
        getRetryDelay: (attempt) => (attempt < 2 ? 0.5 : null),
      }),
    });
    this.input = input;
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) {
      throw new Error('This video cannot be decoded by this browser.');
    }
    if (this.closed) throw new Error('Video source was closed.');
    this.ownsHardwareSlot = NLEVideoSource.hardwareReaders < 4;
    if (this.ownsHardwareSlot) NLEVideoSource.hardwareReaders++;
    return new VideoSampleSink(track, {
      hardwareAcceleration: this.ownsHardwareSlot
        ? 'prefer-hardware'
        : 'prefer-software',
      optimizeForLatency: true,
    });
  }

  async getFrameAt(seconds: number): Promise<VideoFrame | null> {
    if (this.closed) return null;
    const sink = await (this.sink ??= this.open());
    if (this.closed) return null;
    if (
      !this.samples ||
      seconds < (this.current?.timestamp ?? -Infinity) ||
      seconds > (this.current?.timestamp ?? 0) + 0.5
    ) {
      this.current?.close();
      this.next?.close();
      this.current = null;
      this.next = null;
      await this.samples?.return();
      if (this.closed) return null;
      this.samples = sink.samples(seconds);
    }
    this.current ??= await this.readSample();
    this.next ??= await this.readSample();
    while (this.next && this.next.timestamp <= seconds) {
      this.current?.close();
      this.current = this.next;
      this.next = await this.readSample();
    }
    if (this.closed || !this.current) return null;
    if (!this.current.rotation && !this.current.flip)
      return this.current.toVideoFrame();
    const sample = this.current;
    const canvas = (this.orientationCanvas ??= new OffscreenCanvas(
      sample.displayWidth,
      sample.displayHeight
    ));
    canvas.width = sample.displayWidth;
    canvas.height = sample.displayHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Video orientation could not be rendered.');
    sample.draw(context, 0, 0);
    return new VideoFrame(canvas, { timestamp: sample.microsecondTimestamp });
  }

  private async readSample(): Promise<VideoSample | null> {
    const result = await this.samples?.next();
    if (!result?.value) return null;
    const sample = result.value;
    if (this.closed) {
      sample?.close();
      return null;
    }
    return sample;
  }

  close(): void {
    this.closed = true;
    this.current?.close();
    this.next?.close();
    this.current = null;
    this.next = null;
    this.input?.dispose();
    void this.samples?.return().catch(() => {});
    this.samples = null;
    if (this.orientationCanvas) {
      this.orientationCanvas.width = 0;
      this.orientationCanvas.height = 0;
      this.orientationCanvas = null;
    }
    this.input = null;
    if (this.ownsHardwareSlot) {
      NLEVideoSource.hardwareReaders--;
      this.ownsHardwareSlot = false;
    }
  }
}
