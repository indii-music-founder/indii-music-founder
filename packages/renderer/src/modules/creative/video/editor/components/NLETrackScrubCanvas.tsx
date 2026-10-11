import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

export interface NLETrackScrubCanvasProps {
  src: string;
  width: number;
  height: number;
  durationInFrames: number;
  fps?: number;
  sourceInUs?: number;
  sourceOutUs?: number;
  playheadFrame?: number;
  isScrubbing?: boolean;
  className?: string;
}

interface FrameCacheEntry {
  bitmap: ImageBitmap | HTMLCanvasElement;
  timestamp: number;
}

// Global LRU cache for scrub thumbnails across timeline clips
const GLOBAL_THUMBNAIL_CACHE = new Map<string, FrameCacheEntry>();
const MAX_CACHE_ENTRIES = 250;

function getCachedFrame(key: string): ImageBitmap | HTMLCanvasElement | null {
  const entry = GLOBAL_THUMBNAIL_CACHE.get(key);
  if (!entry) return null;
  entry.timestamp = Date.now();
  return entry.bitmap;
}

function setCachedFrame(key: string, bitmap: ImageBitmap | HTMLCanvasElement): void {
  if (GLOBAL_THUMBNAIL_CACHE.size >= MAX_CACHE_ENTRIES) {
    let oldestKey = '';
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [k, v] of GLOBAL_THUMBNAIL_CACHE.entries()) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const removed = GLOBAL_THUMBNAIL_CACHE.get(oldestKey);
      if (removed && 'close' in removed.bitmap && typeof removed.bitmap.close === 'function') {
        try {
          removed.bitmap.close();
        } catch {
          // Ignore bitmap close errors
        }
      }
      GLOBAL_THUMBNAIL_CACHE.delete(oldestKey);
    }
  }
  GLOBAL_THUMBNAIL_CACHE.set(key, { bitmap, timestamp: Date.now() });
}

export const NLETrackScrubCanvas = memo(({
  src,
  width,
  height,
  durationInFrames,
  fps = 30,
  sourceInUs,
  sourceOutUs,
  playheadFrame,
  isScrubbing = false,
  className = '',
}: NLETrackScrubCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  // Determine source range in seconds
  const startSec = sourceInUs ? sourceInUs / 1_000_000 : 0;
  const endSec = sourceOutUs ? sourceOutUs / 1_000_000 : (durationInFrames > 0 ? durationInFrames / fps : 1);
  const clipDurationSec = Math.max(0.1, endSec - startSec);

  // Compute number of thumbnail tiles needed along width
  // Standard 16:9 thumbnail width for given height
  const idealTileWidth = Math.max(32, Math.round((16 / 9) * safeHeight));
  const tileCount = Math.max(1, Math.min(40, Math.ceil(safeWidth / idealTileWidth)));
  const actualTileWidth = safeWidth / tileCount;

  // Draw background fallback / grid
  const renderFallback = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, safeWidth, safeHeight);

    // Draw filmstrip grid dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < tileCount; i++) {
      const x = Math.round(i * actualTileWidth);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, safeHeight);
      ctx.stroke();
    }
  }, [safeWidth, safeHeight, tileCount, actualTileWidth]);

  // Main canvas render pass
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderFallback(ctx);

    // Draw cached thumbnail tiles
    for (let i = 0; i < tileCount; i++) {
      const tileCenterRatio = (i + 0.5) / tileCount;
      const targetTimeSec = startSec + tileCenterRatio * clipDurationSec;
      const roundedTime = Math.round(targetTimeSec * 10) / 10;
      const cacheKey = `${src}:${roundedTime}`;
      const cached = getCachedFrame(cacheKey);

      const dx = i * actualTileWidth;
      if (cached) {
        try {
          ctx.drawImage(cached, dx, 0, actualTileWidth, safeHeight);
        } catch {
          // Skip if drawn bitmap became invalid
        }
      }
    }

    // Tile border separation
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < tileCount; i++) {
      const x = Math.round(i * actualTileWidth);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, safeHeight);
      ctx.stroke();
    }

    // Draw active scrub line if playhead is within clip duration
    if (playheadFrame !== undefined && playheadFrame >= 0 && playheadFrame <= durationInFrames && durationInFrames > 0) {
      const playheadX = Math.round((playheadFrame / durationInFrames) * safeWidth);
      ctx.save();
      ctx.strokeStyle = isScrubbing ? '#38bdf8' : '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, safeHeight);
      ctx.stroke();

      // Top scrub head indicator notch
      ctx.fillStyle = isScrubbing ? '#38bdf8' : '#4ade80';
      ctx.beginPath();
      ctx.moveTo(playheadX - 4, 0);
      ctx.lineTo(playheadX + 4, 0);
      ctx.lineTo(playheadX, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }, [src, safeWidth, safeHeight, tileCount, actualTileWidth, startSec, clipDurationSec, playheadFrame, durationInFrames, isScrubbing, renderFallback]);

  // Frame extraction worker loop
  useEffect(() => {
    if (!src || safeWidth <= 0 || safeHeight <= 0) return;

    let isDisposed = false;
    const missingTileTimes: number[] = [];

    for (let i = 0; i < tileCount; i++) {
      const tileCenterRatio = (i + 0.5) / tileCount;
      const targetTimeSec = startSec + tileCenterRatio * clipDurationSec;
      const roundedTime = Math.round(targetTimeSec * 10) / 10;
      const cacheKey = `${src}:${roundedTime}`;
      if (!getCachedFrame(cacheKey)) {
        missingTileTimes.push(roundedTime);
      }
    }

    // If all tiles cached, redraw immediately
    if (missingTileTimes.length === 0) {
      redrawCanvas();
      setIsReady(true);
      return;
    }

    // Extract frames sequentially from hidden video element
    const video = document.createElement('video');
    activeVideoRef.current = video;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let currentIndex = 0;

    const captureCurrent = () => {
      if (isDisposed) return;
      const time = missingTileTimes[currentIndex];
      const cacheKey = `${src}:${time}`;

      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.max(16, Math.round(actualTileWidth));
        offscreen.height = safeHeight;
        const offCtx = offscreen.getContext('2d');
        if (offCtx && video.videoWidth > 0 && video.videoHeight > 0) {
          // Aspect-ratio cover crop
          const videoAspect = video.videoWidth / video.videoHeight;
          const tileAspect = offscreen.width / offscreen.height;
          let sx = 0;
          let sy = 0;
          let sw = video.videoWidth;
          let sh = video.videoHeight;

          if (videoAspect > tileAspect) {
            sw = video.videoHeight * tileAspect;
            sx = (video.videoWidth - sw) / 2;
          } else {
            sh = video.videoWidth / tileAspect;
            sy = (video.videoHeight - sh) / 2;
          }

          offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);
          setCachedFrame(cacheKey, offscreen);
          redrawCanvas();
        }
      } catch (err) {
        logger.debug('[NLETrackScrubCanvas] Frame capture skip:', err);
      }

      currentIndex++;
      if (currentIndex < missingTileTimes.length && !isDisposed) {
        seekNext();
      } else {
        setIsReady(true);
      }
    };

    const seekNext = () => {
      if (isDisposed || currentIndex >= missingTileTimes.length) return;
      video.currentTime = missingTileTimes[currentIndex];
    };

    const onSeeked = () => {
      captureCurrent();
    };

    const onLoadedMetadata = () => {
      if (isDisposed) return;
      seekNext();
    };

    const onError = () => {
      if (isDisposed) return;
      logger.debug(`[NLETrackScrubCanvas] Video load error for ${src}`);
      setIsReady(true);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    video.src = src;

    return () => {
      isDisposed = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.src = '';
      if (activeVideoRef.current === video) {
        activeVideoRef.current = null;
      }
    };
  }, [src, safeWidth, safeHeight, tileCount, actualTileWidth, startSec, clipDurationSec, redrawCanvas]);

  // Redraw when playhead/dimensions change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, playheadFrame, isScrubbing]);

  return (
    <canvas
      ref={canvasRef}
      width={safeWidth}
      height={safeHeight}
      data-testid="nle-track-scrub-canvas"
      data-ready={isReady ? 'true' : 'false'}
      role="img"
      aria-label={`Video track scrub filmstrip for ${src}`}
      className={`block pointer-events-none select-none rounded ${className}`}
      style={{
        width: `${safeWidth}px`,
        height: `${safeHeight}px`,
      }}
    />
  );
});
