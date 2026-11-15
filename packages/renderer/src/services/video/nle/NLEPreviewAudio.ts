import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

/** Timeline-to-source mapping shared by startup, seek and steady playback. */
export function previewAudioState(clip: IndiiVideoClip, frame: number, fps: number) {
  const rate = Math.max(0.25, Math.min(4, clip.playbackRate ?? 1));
  const localSeconds = (frame - clip.startFrame) / fps;
  const duration = clip.durationInFrames / fps;
  const sourceSeconds = (clip.sourceInUs ?? 0) / 1_000_000 + localSeconds * rate;
  const sourceEnd = clip.sourceOutUs === undefined ? Infinity : clip.sourceOutUs / 1_000_000;
  const active = localSeconds >= 0 && localSeconds < duration && sourceSeconds < sourceEnd;
  const fadeIn = clip.audioFade?.inSeconds ?? 0;
  const fadeOut = clip.audioFade?.outSeconds ?? 0;
  const fade = Math.min(1, fadeIn > 0 ? localSeconds / fadeIn : 1,
    fadeOut > 0 ? (duration - localSeconds) / fadeOut : 1);
  return { active, sourceSeconds, rate, gain: Math.max(0, Math.min(1, (clip.volume ?? 1) * fade)) };
}

/** Bounded active-clip media readers. Browser pitch preservation stays enabled. */
export class NLEPreviewAudio {
  private entries = new Map<string, { media: HTMLAudioElement; node: MediaElementAudioSourceNode; pending: boolean }>();
  private opening = new Set<string>();
  private generation = 0;
  private closed = false;
  private playing = false;
  private frame = 0;
  private forceSeek = false;

  constructor(private readonly project: IndiiVideoProject, private readonly context: AudioContext,
    private readonly onError: (error: unknown) => void) {}

  sync(frame: number, playing: boolean, seek = false): void {
    if (this.closed) return;
    this.frame = frame;
    this.playing = playing;
    this.forceSeek = seek;
    const solo = this.project.tracks.some(track => track.isSolo);
    const active = this.project.clips.filter(clip => {
      const track = this.project.tracks.find(candidate => candidate.id === clip.trackId);
      return clip.src && (clip.type === 'audio' || clip.type === 'video' && clip.hasAudio === true)
        && !track?.isMuted && (!solo || track?.isSolo)
        && previewAudioState(clip, frame, this.project.fps).active;
    });
    const ids = new Set(active.map(clip => clip.id));
    for (const [id, entry] of this.entries) {
      if (!ids.has(id)) {
        this.release(entry);
        this.entries.delete(id);
      }
    }
    for (const clip of active) {
      const entry = this.entries.get(clip.id);
      if (entry) this.update(clip, entry);
      else if (playing && !this.opening.has(clip.id)) void this.open(clip);
    }
  }

  private async open(clip: IndiiVideoClip): Promise<void> {
    const generation = this.generation;
    this.opening.add(clip.id);
    try {
      const url = await resolveStorageUrl(clip.src!);
      if (this.closed || generation !== this.generation || !this.playing
        || !previewAudioState(clip, this.frame, this.project.fps).active) return;
      const media = new Audio();
      media.crossOrigin = 'anonymous';
      media.preload = 'auto';
      media.preservesPitch = true;
      media.src = url;
      const node = this.context.createMediaElementSource(media);
      node.connect(this.context.destination);
      const entry = { media, node, pending: false };
      this.entries.set(clip.id, entry);
      media.onerror = () => { if (!this.closed) this.onError(new Error(`Audio preview could not load ${clip.name}.`)); };
      this.update(clip, entry, true);
    } catch (error) {
      if (!this.closed && generation === this.generation) this.onError(error);
    } finally {
      this.opening.delete(clip.id);
    }
  }

  private update(clip: IndiiVideoClip, entry: { media: HTMLAudioElement; pending: boolean }, initial = false): void {
    const state = previewAudioState(clip, this.frame, this.project.fps);
    const media = entry.media;
    media.volume = state.gain;
    media.playbackRate = state.rate;
    if (initial || this.forceSeek || Math.abs(media.currentTime - state.sourceSeconds) > 0.08) {
      media.currentTime = Math.max(0, state.sourceSeconds);
    }
    if (!this.playing) media.pause();
    else if (media.paused && !entry.pending) {
      entry.pending = true;
      void media.play().catch(error => {
        if (!this.closed && this.playing && this.entries.get(clip.id) === entry
          && !(error instanceof DOMException && error.name === 'AbortError')) this.onError(error);
      }).finally(() => { entry.pending = false; if (!this.playing || this.closed || this.entries.get(clip.id) !== entry) media.pause(); });
    }
  }

  pause(): void {
    this.playing = false;
    this.generation++;
    for (const entry of this.entries.values()) entry.media.pause();
  }

  private release(entry: { media: HTMLAudioElement; node: MediaElementAudioSourceNode }): void {
    entry.media.onerror = null;
    entry.media.pause();
    entry.node.disconnect();
    entry.media.removeAttribute('src');
    entry.media.load();
  }

  close(): void {
    this.closed = true;
    this.pause();
    for (const entry of this.entries.values()) this.release(entry);
    this.entries.clear();
  }
}
