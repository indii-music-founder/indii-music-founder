import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { logger } from '@/utils/logger';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';

type VideoJsPlayerInstance = ReturnType<typeof videojs>;

export interface VideoJsPlayerHandle {
    player: VideoJsPlayerInstance | null;
    seekTo: (seconds: number) => void;
    currentTime: () => number;
    duration: () => number;
    buffered: () => TimeRanges | null;
    captureFrame: () => string | null;
    loadSource: (videoUrl: string, mimeType?: string) => void;
}

interface VideoJsPlayerProps {
    videoUrl: string;
    mimeType?: string;
    posterUrl?: string;
    autoPlay?: boolean;
    controls?: boolean;
    loop?: boolean;
    muted?: boolean;
    className?: string;
    dataTestId?: string;
    onReady?: (api: VideoJsPlayerHandle) => void;
    onTimeUpdate?: (currentTime: number) => void;
    onError?: (message: string) => void;
}

export const VideoJsPlayer = React.forwardRef<VideoJsPlayerHandle, VideoJsPlayerProps>(({
    videoUrl,
    mimeType = 'video/mp4',
    posterUrl,
    autoPlay = false,
    controls = true,
    loop = false,
    muted = true,
    className = '',
    dataTestId = 'video-player',
    onReady,
    onTimeUpdate,
    onError,
}, ref) => {
    const videoElementRef = React.useRef<HTMLVideoElement | null>(null);
    const playerRef = React.useRef<VideoJsPlayerInstance | null>(null);
    const onReadyRef = React.useRef(onReady);
    const onTimeUpdateRef = React.useRef(onTimeUpdate);
    const onErrorRef = React.useRef(onError);
    const { url: resolvedVideoUrl, isResolving, error: resolveError } = useResolvedStorageUrl(videoUrl);
    const sourceUrl = resolvedVideoUrl || (videoUrl.startsWith('gs://') ? '' : videoUrl);

    React.useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    React.useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    React.useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    const captureFrame = React.useCallback((): string | null => {
        const player = playerRef.current;
        const videoEl = (videoElementRef.current || (player?.el()?.querySelector('video') as HTMLVideoElement | null));
        if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.92);
        } catch (error) {
            logger.warn('[VideoJsPlayer] frame capture failed', error);
            return null;
        }
    }, []);

    const buildHandle = React.useCallback((): VideoJsPlayerHandle => ({
        player: playerRef.current,
        seekTo: (seconds: number) => {
            playerRef.current?.currentTime(seconds);
        },
        currentTime: () => playerRef.current?.currentTime() ?? 0,
        duration: () => playerRef.current?.duration() ?? 0,
        buffered: () => playerRef.current?.buffered() ?? null,
        captureFrame,
        loadSource: (nextVideoUrl: string, nextMimeType?: string) => {
            playerRef.current?.src({ src: nextVideoUrl, type: nextMimeType || mimeType });
        },
    }), [captureFrame, mimeType]);

    React.useImperativeHandle(ref, () => buildHandle(), [buildHandle]);

    React.useEffect(() => {
        const videoEl = videoElementRef.current;
        if (!videoEl || playerRef.current || !sourceUrl) return;

        const player = videojs(videoEl, {
            controls,
            fluid: true,
            responsive: true,
            preload: 'metadata',
            autoplay: autoPlay,
            muted,
            loop,
            poster: posterUrl,
            sources: [{ src: sourceUrl, type: mimeType }],
        });
        playerRef.current = player;

        const emitTimeUpdate = () => {
            onTimeUpdateRef.current?.(player.currentTime());
        };
        const emitError = () => {
            const error = player.error();
            onErrorRef.current?.(error?.message || 'Playback Error: Video source unavailable or corrupted.');
        };

        player.on('timeupdate', emitTimeUpdate);
        player.on('error', emitError);

        player.ready(() => {
            onReadyRef.current?.(buildHandle());
        });

        return () => {
            player.off('timeupdate', emitTimeUpdate);
            player.off('error', emitError);
            player.dispose();
            playerRef.current = null;
        };
    }, [autoPlay, buildHandle, controls, mimeType, muted, posterUrl, sourceUrl, loop]);

    React.useEffect(() => {
        const player = playerRef.current;
        if (!player || !sourceUrl) return;
        player.src({ src: sourceUrl, type: mimeType });
        player.autoplay(autoPlay);
        player.controls(controls);
        player.muted(muted);
        player.loop(loop);
        if (posterUrl !== undefined) {
            player.poster(posterUrl);
        }
    }, [autoPlay, controls, loop, mimeType, muted, posterUrl, sourceUrl]);

    React.useEffect(() => {
        if (resolveError) {
            onErrorRef.current?.(resolveError);
        }
    }, [resolveError]);

    if (isResolving) {
        return (
            <div className={`flex items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/60 ${className}`}>
                Resolving playback asset...
            </div>
        );
    }

    if (resolveError) {
        return (
            <div className={`flex items-center justify-center rounded-lg border border-red-500/20 bg-[#1a0f0f] text-red-300 ${className}`}>
                Playback asset unavailable.
            </div>
        );
    }

    return (
        <video
            ref={videoElementRef}
            className={`video-js vjs-big-play-centered ${className}`.trim()}
            data-testid={dataTestId}
            playsInline
        />
    );
});

VideoJsPlayer.displayName = 'VideoJsPlayer';
