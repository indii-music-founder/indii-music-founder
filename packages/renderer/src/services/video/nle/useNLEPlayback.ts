import { useState, useRef, useEffect, useCallback } from 'react';
import type { IndiiVideoProject } from '@indii/shared';
import { MasterAudioClock } from './MasterAudioClock';
import { NLEFrameRenderer } from './NLEFrameRenderer';
import { WebGL2Compositor } from './WebGL2Compositor';
import { logger } from '@/utils/logger';

export interface UseNLEPlaybackOptions {
  project: IndiiVideoProject;
  canvas: HTMLCanvasElement | null;
  onFrameUpdate?: (frame: number) => void;
  onEnded?: () => void;
}

export interface UseNLEPlaybackReturn {
  isPlaying: boolean;
  error: string | null;
  retry: () => void;
  currentFrame: number;
  currentSeconds: number;
  play: () => void;
  pause: () => void;
  seekToFrame: (frame: number) => void;
  seekToSeconds: (seconds: number) => void;
}

export function useNLEPlayback({
  project,
  canvas,
  onFrameUpdate,
  onEnded,
}: UseNLEPlaybackOptions): UseNLEPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const [currentFrame, setCurrentFrame] = useState(0);

  const fps = project.fps > 0 ? project.fps : 30;
  const currentSeconds = currentFrame / fps;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const clockRef = useRef<MasterAudioClock | null>(null);
  const compositorRef = useRef<WebGL2Compositor | null>(null);
  const frameRendererRef = useRef<NLEFrameRenderer | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentFrameRef = useRef<number>(0);

  // Keep ref synchronized with state
  currentFrameRef.current = currentFrame;

  // Initialize WebGL2 Compositor and Web Audio Master Clock
  useEffect(() => {
    if (!canvas) return;
    setError(null);

    try {
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl && typeof gl.createShader === 'function') {
        const compositor = new WebGL2Compositor(gl);
        compositorRef.current = compositor;
        frameRendererRef.current = new NLEFrameRenderer(project, compositor, (cause) => {
          setError(cause instanceof Error ? cause.message : 'Video preview could not decode this media.');
          if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
          clockRef.current?.pause();
          setIsPlaying(false);
        });
        frameRendererRef.current.request(BigInt(Math.round(currentFrameRef.current * 60000 / fps)));
      } else {
        setError('WebGL2 is unavailable in this browser.');
      }
    } catch (err) {
      logger.error('[useNLEPlayback] Failed to initialize WebGL2Compositor:', err);
      setError('The NLE preview could not initialize.');
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

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      frameRendererRef.current?.close();
      frameRendererRef.current = null;
      if (compositorRef.current) {
        compositorRef.current.dispose();
        compositorRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      clockRef.current = null;
      setIsPlaying(false);
    };
  }, [canvas, project, fps, revision]);

  const renderAtPts = useCallback((pts: bigint) => {
    frameRendererRef.current?.request(pts);
  }, []);

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
    if (!clock || error) return;
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);

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
  }, [error, fps, onEnded, onFrameUpdate, pause, project.durationInFrames, renderAtPts]);

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
    error,
    retry,
    currentFrame,
    currentSeconds,
    play,
    pause,
    seekToFrame,
    seekToSeconds,
  };
}
