import { useState, useRef, useEffect, useCallback } from 'react';
import type { IndiiVideoProject } from '@indii/shared';
import { projectToTimelineAST, isClipActive, getSourceOffsetPts } from '@indii/video-compiler';
import { MasterAudioClock } from './MasterAudioClock';
import { VideoTrackDecoder } from './VideoTrackDecoder';
import { WebGL2Compositor, computeTransformMatrix, type RenderLayer } from './WebGL2Compositor';
import { logger } from '@/utils/logger';

export interface UseNLEPlaybackOptions {
  project: IndiiVideoProject;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onFrameUpdate?: (frame: number) => void;
  onEnded?: () => void;
}

export interface UseNLEPlaybackReturn {
  isPlaying: boolean;
  currentFrame: number;
  currentSeconds: number;
  play: () => void;
  pause: () => void;
  seekToFrame: (frame: number) => void;
  seekToSeconds: (seconds: number) => void;
}

export function useNLEPlayback({
  project,
  canvasRef,
  onFrameUpdate,
  onEnded,
}: UseNLEPlaybackOptions): UseNLEPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  const fps = project.fps > 0 ? project.fps : 30;
  const currentSeconds = currentFrame / fps;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const clockRef = useRef<MasterAudioClock | null>(null);
  const compositorRef = useRef<WebGL2Compositor | null>(null);
  const decodersRef = useRef<Map<string, VideoTrackDecoder>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const currentFrameRef = useRef<number>(0);

  // Keep ref synchronized with state
  currentFrameRef.current = currentFrame;

  // Initialize WebGL2 Compositor and Web Audio Master Clock
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl && typeof gl.createShader === 'function') {
        compositorRef.current = new WebGL2Compositor(gl);
      }
    } catch (err) {
      logger.error('[useNLEPlayback] Failed to initialize WebGL2Compositor:', err);
    }

    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : undefined;

    let audioCtx: AudioContext | null = null;
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
      } catch {
        // Fall back to software timing if hardware audio context throws
      }
    }

    const fallbackCtx = {
      get currentTime() {
        return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
      },
      state: 'running' as AudioContextState,
      resume: async () => {},
    };

    clockRef.current = new MasterAudioClock(audioCtx ?? fallbackCtx, 60000);

    const decoders = decodersRef.current;

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (compositorRef.current) {
        compositorRef.current.dispose();
        compositorRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      for (const decoder of decoders.values()) {
        decoder.purgeBefore(BigInt(Number.MAX_SAFE_INTEGER));
      }
      decoders.clear();
    };
  }, [canvasRef]);

  // Render a single frame tick at a specific playhead PTS
  const renderAtPts = useCallback(
    (playheadPts: bigint) => {
      const compositor = compositorRef.current;
      if (!compositor) return;

      const ast = projectToTimelineAST(project, 60000);
      const layers: RenderLayer[] = [];

      for (const track of ast.tracks) {
        if (track.type !== 'video' || track.muted) continue;

        for (const clip of track.clips) {
          if (clip.type !== 'video' || !isClipActive(playheadPts, clip)) continue;

          let decoder = decodersRef.current.get(track.id);
          if (!decoder) {
            decoder = new VideoTrackDecoder(track.id);
            decodersRef.current.set(track.id, decoder);
          }

          const offsetPts = getSourceOffsetPts(playheadPts, clip, 60000);
          const frame = decoder.getFrameForPts(offsetPts);

          if (frame) {
            const transform = computeTransformMatrix(clip.transform);
            layers.push({
              frame,
              transform,
              opacity: clip.transform.opacity,
            });
          }
        }
      }

      compositor.renderTick(layers);
    },
    [project]
  );

  const pause = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (clockRef.current) {
      clockRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const clock = clockRef.current;
    if (!clock) return;

    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const startPts = BigInt(Math.round((currentFrameRef.current * 60000) / fps));
    clock.play(startPts);
    setIsPlaying(true);

    const tick = () => {
      if (!clockRef.current) return;
      const pts = clockRef.current.getCurrentPts();
      const frame = Math.round((Number(pts) * fps) / 60000);

      if (project.durationInFrames > 0 && frame >= project.durationInFrames) {
        pause();
        setCurrentFrame(project.durationInFrames);
        onFrameUpdate?.(project.durationInFrames);
        onEnded?.();
        return;
      }

      setCurrentFrame(frame);
      onFrameUpdate?.(frame);
      renderAtPts(pts);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [fps, onEnded, onFrameUpdate, pause, project.durationInFrames, renderAtPts]);

  const seekToFrame = useCallback(
    (frame: number) => {
      const clamped = Math.max(0, Math.min(frame, project.durationInFrames || frame));
      setCurrentFrame(clamped);
      currentFrameRef.current = clamped;
      onFrameUpdate?.(clamped);

      const targetPts = BigInt(Math.round((clamped * 60000) / fps));

      if (isPlaying && clockRef.current) {
        clockRef.current.play(targetPts);
      } else {
        renderAtPts(targetPts);
      }
    },
    [fps, isPlaying, onFrameUpdate, project.durationInFrames, renderAtPts]
  );

  const seekToSeconds = useCallback(
    (seconds: number) => {
      const targetFrame = Math.round(seconds * fps);
      seekToFrame(targetFrame);
    },
    [fps, seekToFrame]
  );

  return {
    isPlaying,
    currentFrame,
    currentSeconds,
    play,
    pause,
    seekToFrame,
    seekToSeconds,
  };
}
