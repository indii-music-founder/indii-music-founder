/**
 * Master Audio Clock Synchronization Engine for NLE (Issue #413).
 *
 * Synchronizes multi-track playback to the Web Audio hardware clock
 * to prevent audio/video drift across arbitrarily long timelines.
 */

import { DEFAULT_TIMESCALE } from '@indii/video-compiler';

export interface AudioContextLike {
  currentTime: number;
  state: AudioContextState;
  resume?: () => Promise<void>;
}

export class MasterAudioClock {
  private audioCtx: AudioContextLike;
  private playbackStartTime = 0;
  private timelineStartPts = 0n;
  private isRunning = false;
  private timescale: number;

  constructor(audioCtx: AudioContextLike, timescale = DEFAULT_TIMESCALE) {
    this.audioCtx = audioCtx;
    this.timescale = timescale;
  }

  /**
   * Begins playback from a specific rational timeline PTS.
   */
  public play(fromTimelinePts: bigint): void {
    this.timelineStartPts = fromTimelinePts;
    this.playbackStartTime = this.audioCtx.currentTime;
    this.isRunning = true;
  }

  /**
   * Pauses playback and returns the exact rational PTS at pause.
   */
  public pause(): bigint {
    const currentPts = this.getCurrentPts();
    this.isRunning = false;
    this.timelineStartPts = currentPts;
    return currentPts;
  }

  /**
   * Computes the current timeline PTS based on elapsed hardware audio time.
   */
  public getCurrentPts(): bigint {
    if (!this.isRunning) return this.timelineStartPts;
    const elapsedSeconds = this.audioCtx.currentTime - this.playbackStartTime;
    const elapsedPts = BigInt(Math.round(elapsedSeconds * this.timescale));
    return this.timelineStartPts + elapsedPts;
  }

  /**
   * Returns current playback state.
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Returns the clock's configured timescale base.
   */
  public getTimescale(): number {
    return this.timescale;
  }

  /**
   * Seeks to a specific PTS without changing active running state.
   */
  public seek(toTimelinePts: bigint): void {
    this.timelineStartPts = toTimelinePts;
    this.playbackStartTime = this.audioCtx.currentTime;
  }
}
