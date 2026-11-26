import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

export const NLE_AUDIO_LOCK_THRESHOLD_SECONDS = 0.005; // <= 5 ms target sync lock
export const NLE_AUDIO_HARD_SEEK_THRESHOLD_SECONDS = 0.045; // > 45 ms hard resync
export const NLE_AUDIO_MAX_PLL_ADJUSTMENT = 0.03; // ±3% micro-rate pull-in
const MAX_DECODED_BUFFERS = 16;
const MAX_DECODED_BYTES = 128 * 1024 * 1024; // 128 MiB memory ceiling

export interface AudioSyncAdjustment {
  action: 'locked' | 'pll' | 'seek';
  driftSeconds: number;
  targetRate: number;
  seekToSeconds?: number;
}

/**
 * Pure two-tier A/V sync controller (ISSUE-1510):
 * - <= 5 ms drift: stay locked at nominal playbackRate
 * - 5 ms .. 45 ms drift: smooth micro-rate PLL nudge (no audible seek stutter)
 * - > 45 ms drift (or explicit seek): hard seek to exact sourceSeconds
 */
export function computeAudioSyncAdjustment(
  actualSeconds: number,
  expectedSeconds: number,
  nominalRate: number,
  forceSeek = false,
): AudioSyncAdjustment {
  const driftSeconds = actualSeconds - expectedSeconds;
  if (forceSeek || Math.abs(driftSeconds) > NLE_AUDIO_HARD_SEEK_THRESHOLD_SECONDS) {
    return {
      action: 'seek',
      driftSeconds,
      targetRate: nominalRate,
      seekToSeconds: Math.max(0, expectedSeconds),
    };
  }
  if (Math.abs(driftSeconds) <= NLE_AUDIO_LOCK_THRESHOLD_SECONDS) {
    return {
      action: 'locked',
      driftSeconds,
      targetRate: nominalRate,
    };
  }
  // If media is ahead (drift > 0), slow down slightly; if behind (drift < 0), speed up slightly.
  const proportional = Math.min(
    NLE_AUDIO_MAX_PLL_ADJUSTMENT,
    (Math.abs(driftSeconds) / NLE_AUDIO_HARD_SEEK_THRESHOLD_SECONDS) * NLE_AUDIO_MAX_PLL_ADJUSTMENT,
  );
  const factor = driftSeconds > 0 ? 1 - proportional : 1 + proportional;
  return {
    action: 'pll',
    driftSeconds,
    targetRate: Math.max(0.25, Math.min(4, nominalRate * factor)),
  };
}

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
  const fade = Math.min(
    1,
    fadeIn > 0 ? localSeconds / fadeIn : 1,
    fadeOut > 0 ? (duration - localSeconds) / fadeOut : 1,
  );
  const remainingTimelineSeconds = Math.max(0, duration - localSeconds);
  const remainingSourceSeconds = Number.isFinite(sourceEnd)
    ? Math.max(0, (sourceEnd - sourceSeconds) / rate)
    : remainingTimelineSeconds;
  return {
    active,
    sourceSeconds,
    rate,
    gain: Math.max(0, Math.min(1, (clip.volume ?? 1) * fade)),
    remainingSeconds: Math.min(remainingTimelineSeconds, remainingSourceSeconds),
  };
}

interface DecodedCacheEntry {
  buffer: AudioBuffer;
  bytes: number;
}

/** Memory-bounded LRU cache for decoded AudioBuffers so long looping playback stays flatline. */
export class DecodedAudioBufferCache {
  private entries = new Map<string, DecodedCacheEntry>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries = MAX_DECODED_BUFFERS,
    private readonly maxBytes = MAX_DECODED_BYTES,
  ) {}

  get(key: string): AudioBuffer | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Refresh LRU order
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.buffer;
  }

  set(key: string, buffer: AudioBuffer): void {
    const bytes = Math.max(
      1,
      (buffer.length || 0) * Math.max(1, buffer.numberOfChannels || 1) * 4,
    );
    const existing = this.entries.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entries.delete(key);
    }
    this.entries.set(key, { buffer, bytes });
    this.totalBytes += bytes;
    this.evictIfNeeded();
  }

  get size(): number {
    return this.entries.size;
  }

  get bytesUsed(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries || (this.totalBytes > this.maxBytes && this.entries.size > 1)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.entries.get(oldestKey);
      if (oldest) this.totalBytes -= oldest.bytes;
      this.entries.delete(oldestKey);
    }
  }
}

type BufferEntry = {
  kind: 'buffer';
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startedAtContextTime: number;
  startSourceSeconds: number;
  rate: number;
};

type MediaElementEntry = {
  kind: 'media';
  media: HTMLAudioElement;
  node: MediaElementAudioSourceNode;
  gainNode: GainNode;
  pending: boolean;
};

type ActiveAudioEntry = BufferEntry | MediaElementEntry;

/**
 * Sample-accurate Web Audio preview engine (ISSUE-1510):
 * - Prefers decoded AudioBufferSourceNode + GainNode scheduling anchored to AudioContext.currentTime
 *   with an LRU memory-bounded buffer cache.
 * - Falls back cleanly to GainNode-routed MediaElementAudioSourceNode with <= 5 ms PLL drift lock.
 */
export class NLEPreviewAudio {
  private entries = new Map<string, ActiveAudioEntry>();
  private opening = new Set<string>();
  private generation = 0;
  private closed = false;
  private playing = false;
  private frame = 0;
  private forceSeek = false;
  private readonly bufferCache = new DecodedAudioBufferCache();

  constructor(
    private readonly project: IndiiVideoProject,
    private readonly context: AudioContext,
    private readonly onError: (error: unknown) => void,
  ) {}

  sync(frame: number, playing: boolean, seek = false): void {
    if (this.closed) return;
    this.frame = frame;
    this.playing = playing;
    this.forceSeek = seek;
    const solo = this.project.tracks.some(track => track.isSolo);
    const active = this.project.clips.filter(clip => {
      const track = this.project.tracks.find(candidate => candidate.id === clip.trackId);
      return clip.src && (clip.type === 'audio' || (clip.type === 'video' && clip.hasAudio === true))
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

  private canUseSampleAccurateBuffers(): boolean {
    return typeof this.context.decodeAudioData === 'function'
      && typeof this.context.createBufferSource === 'function'
      && typeof this.context.createGain === 'function'
      && typeof fetch === 'function';
  }

  private applyGain(gainNode: GainNode, targetGain: number): void {
    const now = this.context.currentTime ?? 0;
    if (typeof gainNode.gain?.setTargetAtTime === 'function') {
      gainNode.gain.setTargetAtTime(targetGain, now, 0.012);
    } else if (gainNode.gain) {
      gainNode.gain.value = targetGain;
    }
  }

  private startBufferEntry(clip: IndiiVideoClip, buffer: AudioBuffer): BufferEntry {
    const state = previewAudioState(clip, this.frame, this.project.fps);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = state.rate;

    const gainNode = this.context.createGain();
    const now = this.context.currentTime ?? 0;
    if (typeof gainNode.gain?.setValueAtTime === 'function') {
      gainNode.gain.setValueAtTime(state.gain, now);
    } else if (gainNode.gain) {
      gainNode.gain.value = state.gain;
    }

    source.connect(gainNode);
    gainNode.connect(this.context.destination);

    const offset = Math.max(0, Math.min(state.sourceSeconds, Math.max(0, buffer.duration - 0.001)));
    const playableDuration = Math.max(0.001, Math.min(state.remainingSeconds * state.rate, buffer.duration - offset));
    source.start(now, offset, playableDuration);

    return {
      kind: 'buffer',
      source,
      gainNode,
      startedAtContextTime: now,
      startSourceSeconds: offset,
      rate: state.rate,
    };
  }

  private async open(clip: IndiiVideoClip): Promise<void> {
    const generation = this.generation;
    this.opening.add(clip.id);
    try {
      const url = await resolveStorageUrl(clip.src!);
      if (this.closed || generation !== this.generation || !this.playing
        || !previewAudioState(clip, this.frame, this.project.fps).active) return;

      // Prefer sample-accurate Web Audio AudioBufferSourceNode scheduling for audio clips.
      if (clip.type === 'audio' && this.canUseSampleAccurateBuffers()) {
        try {
          let buffer = this.bufferCache.get(url);
          if (!buffer) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
            this.bufferCache.set(url, buffer);
          }
          if (this.closed || generation !== this.generation || !this.playing
            || !previewAudioState(clip, this.frame, this.project.fps).active) return;
          const bufferEntry = this.startBufferEntry(clip, buffer);
          this.entries.set(clip.id, bufferEntry);
          return;
        } catch {
          // Fall back cleanly to GainNode-routed HTMLAudioElement transport if fetch/decode fails.
        }
      }

      const media = new Audio();
      media.crossOrigin = 'anonymous';
      media.preload = 'auto';
      media.preservesPitch = true;
      media.src = url;
      const node = this.context.createMediaElementSource(media);
      const gainNode = typeof this.context.createGain === 'function' ? this.context.createGain() : null;
      if (gainNode) {
        node.connect(gainNode);
        gainNode.connect(this.context.destination);
      } else {
        node.connect(this.context.destination);
      }
      const entry: MediaElementEntry = {
        kind: 'media',
        media,
        node,
        gainNode: gainNode as GainNode,
        pending: false,
      };
      this.entries.set(clip.id, entry);
      media.onerror = () => { if (!this.closed) this.onError(new Error(`Audio preview could not load ${clip.name}.`)); };
      this.update(clip, entry, true);
    } catch (error) {
      if (!this.closed && generation === this.generation) this.onError(error);
    } finally {
      this.opening.delete(clip.id);
    }
  }

  private update(clip: IndiiVideoClip, entry: ActiveAudioEntry, initial = false): void {
    const state = previewAudioState(clip, this.frame, this.project.fps);

    if (entry.kind === 'buffer') {
      if (!this.playing) {
        this.release(entry);
        this.entries.delete(clip.id);
        return;
      }
      this.applyGain(entry.gainNode, state.gain);
      const now = this.context.currentTime ?? 0;
      const currentSourcePos = entry.startSourceSeconds + (now - entry.startedAtContextTime) * entry.rate;
      const adjustment = computeAudioSyncAdjustment(currentSourcePos, state.sourceSeconds, state.rate, this.forceSeek);
      if (adjustment.action === 'seek') {
        const buffer = entry.source.buffer;
        this.release(entry);
        this.entries.delete(clip.id);
        if (buffer) {
          this.entries.set(clip.id, this.startBufferEntry(clip, buffer));
        }
      } else {
        entry.source.playbackRate.value = adjustment.targetRate;
      }
      return;
    }

    const media = entry.media;
    if (entry.gainNode) {
      media.volume = 1;
      this.applyGain(entry.gainNode, state.gain);
    } else {
      media.volume = state.gain;
    }

    const adjustment = computeAudioSyncAdjustment(
      media.currentTime,
      state.sourceSeconds,
      state.rate,
      initial || this.forceSeek,
    );
    media.playbackRate = adjustment.targetRate;
    if (adjustment.action === 'seek' && adjustment.seekToSeconds !== undefined) {
      media.currentTime = adjustment.seekToSeconds;
    }

    if (!this.playing) media.pause();
    else if (media.paused && !entry.pending) {
      entry.pending = true;
      void media.play().catch(error => {
        if (!this.closed && this.playing && this.entries.get(clip.id) === entry
          && !(error instanceof DOMException && error.name === 'AbortError')) this.onError(error);
      }).finally(() => {
        entry.pending = false;
        if (!this.playing || this.closed || this.entries.get(clip.id) !== entry) media.pause();
      });
    }
  }

  pause(): void {
    this.playing = false;
    this.generation++;
    for (const [id, entry] of this.entries) {
      if (entry.kind === 'buffer') {
        this.release(entry);
        this.entries.delete(id);
      } else {
        entry.media.pause();
      }
    }
  }

  private release(entry: ActiveAudioEntry): void {
    if (entry.kind === 'buffer') {
      try { entry.source.stop(); } catch { /* already stopped */ }
      try { entry.source.disconnect(); } catch { /* already disconnected */ }
      try { entry.gainNode.disconnect(); } catch { /* already disconnected */ }
      return;
    }
    entry.media.onerror = null;
    entry.media.pause();
    entry.node.disconnect();
    if (entry.gainNode) entry.gainNode.disconnect();
    entry.media.removeAttribute('src');
    entry.media.load();
  }

  close(): void {
    this.closed = true;
    this.pause();
    for (const entry of this.entries.values()) this.release(entry);
    this.entries.clear();
    this.bufferCache.clear();
  }
}
