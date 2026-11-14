import type { IndiiVideoProject, TimelineAST, VideoClip } from '@indii/shared';
import {
  projectToTimelineAST,
  isClipActive,
  getSourceOffsetPts,
} from '@indii/video-compiler';
import { NLEVideoSource } from './NLEVideoSource';
import {
  computeTransformMatrix,
  type RenderLayer,
  type WebGL2Compositor,
} from './WebGL2Compositor';

/** Serializes decoding and coalesces scrub requests to the latest playhead. */
export class NLEFrameRenderer {
  private readonly ast: TimelineAST;
  private readonly sources = new Map<string, NLEVideoSource>();
  private readonly sourceUris = new Map<string, string>();
  private pending: bigint | null = null;
  private running = false;
  private closed = false;

  constructor(
    project: IndiiVideoProject,
    private readonly compositor: WebGL2Compositor,
    private readonly onError: (error: unknown) => void
  ) {
    this.ast = projectToTimelineAST(project, 60000);
    for (const clip of project.clips) {
      if (clip.type === 'video' && clip.src) {
        this.sourceUris.set(clip.id, clip.src);
      }
    }
  }

  request(pts: bigint): void {
    if (this.closed) return;
    this.pending = pts;
    if (!this.running) void this.renderPending();
  }

  private async renderPending(): Promise<void> {
    this.running = true;
    try {
      while (!this.closed && this.pending !== null) {
        const pts = this.pending;
        this.pending = null;
        const layers: RenderLayer[] = [];
        try {
          const clips = this.ast.tracks.flatMap((track) =>
            track.type === 'video' && !track.muted
              ? track.clips.filter(
                  (clip): clip is VideoClip =>
                    clip.type === 'video' && isClipActive(pts, clip)
                )
              : []
          );
          const activeIds = new Set(clips.map((clip) => clip.id));
          for (const [id, source] of this.sources) {
            if (!activeIds.has(id)) {
              source.close();
              this.sources.delete(id);
            }
          }
          for (const clip of clips) {
            let source = this.sources.get(clip.id);
            if (!source) {
              const uri = this.sourceUris.get(clip.id);
              if (!uri)
                throw new Error(
                  'This clip has no video source for NLE preview. Use HyperFrames for text and images.'
                );
              source = new NLEVideoSource(uri);
              this.sources.set(clip.id, source);
            }
            const seconds =
              Number(getSourceOffsetPts(pts, clip, 60000)) / 60000;
            const frame = await source.getFrameAt(seconds);
            if (frame) {
              layers.push({
                frame,
                transform: computeTransformMatrix(clip.transform),
                opacity: clip.transform.opacity,
              });
            }
          }
          if (this.closed) {
            for (const layer of layers) (layer.frame as VideoFrame).close();
          } else {
            this.compositor.renderTick(layers.splice(0));
          }
        } catch (error) {
          for (const layer of layers) (layer.frame as VideoFrame).close();
          if (!this.closed) this.onError(error);
          this.close();
        }
      }
    } finally {
      this.running = false;
    }
  }

  close(): void {
    this.closed = true;
    this.pending = null;
    for (const source of this.sources.values()) source.close();
    this.sources.clear();
    this.sourceUris.clear();
  }
}
