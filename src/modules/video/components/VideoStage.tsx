import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Video } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { CreativeSlice } from '@/core/store/slices/creativeSlice';
import { logger } from '@/utils/logger';

interface VideoStageProps {
    jobStatus: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed';
    jobProgress: number;
    activeVideo: HistoryItem | null;
    setVideoInputs: (inputs: Partial<CreativeSlice['videoInputs']>) => void;
}

// ⚡ Bolt Optimization: Memoize this heavy component to prevent re-renders when parent state (like prompt input) changes
export const VideoStage = React.memo<VideoStageProps>(({
    jobStatus,
    jobProgress,
    activeVideo,
    setVideoInputs
}) => {
    const [videoError, setVideoError] = React.useState<string | null>(null);
    const [displayProgress, setDisplayProgress] = React.useState(0);
    const [statusMessageIndex, setStatusMessageIndex] = React.useState(0);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    /**
     * Captures the current video frame as a base64 JPEG string.
     * This is essential for daisy-chaining: the Veo API needs actual image data,
     * not a blob: URL reference (which is session-scoped and un-fetchable by the API).
     */
    const captureCurrentFrame = React.useCallback((): string | null => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
            logger.warn('[VideoStage] Cannot capture frame: video element not ready');
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Return base64 JPEG — strip the data:image/jpeg;base64, prefix for the API
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            logger.info('[VideoStage] Frame captured successfully', {
                width: canvas.width,
                height: canvas.height,
                size: Math.round(dataUrl.length / 1024) + 'KB'
            });
            return dataUrl;
        } catch (e) {
            logger.error('[VideoStage] Frame capture failed:', e);
            return null;
        }
    }, []);

    /**
     * Creates a HistoryItem-like anchor from the captured frame.
     * The URL is a base64 data URI that the Veo API can actually consume.
     */
    const createFrameAnchor = React.useCallback((label: 'anchor' | 'end'): HistoryItem | null => {
        if (!activeVideo) return null;
        const frameData = captureCurrentFrame();
        if (!frameData) {
            logger.warn(`[VideoStage] Failed to capture ${label} frame — using fallback`);
            return activeVideo; // Fallback: pass the HistoryItem as-is
        }

        return {
            ...activeVideo,
            id: `${activeVideo.id}-${label}-frame`,
            url: frameData,
            type: 'image' as const,
            prompt: `${label === 'anchor' ? 'First' : 'Last'} frame from: ${activeVideo.prompt || 'video'}`,
            timestamp: Date.now()
        };
    }, [activeVideo, captureCurrentFrame]);

    const PROGRESS_MESSAGES = React.useMemo(() => [
        "AI Director is framing the scene...",
        "Analyzing temporal continuity...",
        "Synthesizing lighting and textures...",
        "Neural networks are dreaming...",
        "Calibrating movement vectors...",
        "Baking cinematic details...",
        "Finalizing pixels...",
        "Polishing the master render..."
    ], []);

    // Simulated progress logic to prevent "0% panic"
    React.useEffect(() => {
        let interval: NodeJS.Timeout;

        if (jobStatus === 'processing' || jobStatus === 'queued') {
            // Reset for new job
            if (jobProgress === 0 && displayProgress > 90) {
                setDisplayProgress(0);
                setStatusMessageIndex(0);
            }

            interval = setInterval(() => {
                setDisplayProgress(prev => {
                    // If real progress is ahead, jump to it
                    if (jobProgress > prev) return jobProgress;
                    // Otherwise, move slowly up to 95%
                    if (prev < 95) {
                        const increment = prev < 50 ? 1 : 0.5;
                        return Math.min(95, prev + increment);
                    }
                    return prev;
                });

                setStatusMessageIndex(prev => (prev + 1) % PROGRESS_MESSAGES.length);
            }, 3000); // Update every 3 seconds
        } else {
            setDisplayProgress(0);
            setStatusMessageIndex(0);
        }

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- adding displayProgress causes interval clearing loop
    }, [jobStatus, jobProgress, PROGRESS_MESSAGES.length]);

    // Ensure displayProgress jumps to real progress if it's significant
    React.useEffect(() => {
        if (jobProgress > displayProgress) {
            setDisplayProgress(jobProgress);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when jobProgress changes
    }, [jobProgress]);

    React.useEffect(() => {
        setVideoError(null);
        if (activeVideo?.meta && activeVideo.type === 'video') {
            try {
                const meta = JSON.parse(activeVideo.meta);
                if (meta.mime_type && meta.mime_type !== 'video/mp4') {
                    setVideoError(`Invalid video format: ${meta.mime_type}. Lens requires video/mp4.`);
                }
            } catch {
                // Ignore parse errors, treating metadata as optional if malformed
            }
        }
    }, [activeVideo]);

    const handleVideoError = React.useCallback(async () => {
        // Blob URL Recovery: If a blob: URL fails, check the Zustand store
        // for a durable https:// URL that may have been populated by the
        // fire-and-forget Storage upload in VideoGenerationService.
        if (activeVideo?.url.startsWith('blob:')) {
            try {
                const { useStore } = await import('@/core/store');
                const storeHistory = useStore.getState().generatedHistory;
                const storeItem = storeHistory.find(h => h.id === activeVideo.id);

                if (storeItem && storeItem.url.startsWith('https://')) {
                    logger.info('[VideoStage] Recovered durable URL from store:', storeItem.url.slice(0, 60));
                    // Don't set error — the parent will re-render with the updated URL
                    return;
                }
            } catch (e) {
                logger.warn('[VideoStage] Blob URL recovery attempt failed:', e);
            }
        }

        setVideoError("Playback Error: Video source unavailable or corrupted.");
    }, [activeVideo]);

    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
            {/* Background Grid Ambience */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10 group">
                {jobStatus === 'processing' || jobStatus === 'queued' || jobStatus === 'stitching' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                        <div className="w-24 h-24 relative mb-4">
                            <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
                            <div className="absolute inset-2 rounded-full border-r-2 border-indigo-500 animate-spin flex items-center justify-center">
                                <Sparkles size={24} className="text-purple-400 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse capitalize">
                            {jobStatus === 'stitching' ? 'Stitching Masterpiece...' : 'Imaginating Scene...'}
                        </h3>
                        <p className="text-gray-400 text-sm mt-2 font-medium">
                            {jobStatus === 'stitching'
                                ? 'Finalizing your unified video'
                                : `${PROGRESS_MESSAGES[statusMessageIndex]} (${Math.round(displayProgress)}%)`}
                        </p>
                        {/* Progress Bar */}
                        <div className="w-64 h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${displayProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                ) : videoError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                        <div className="bg-red-500/10 p-4 rounded-full mb-4">
                            <Video size={48} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-red-500 mb-2">Playback Error</h3>
                        <p className="text-gray-400 text-center max-w-sm px-4">{videoError}</p>
                    </div>
                ) : activeVideo ? (
                    <div className="relative w-full h-full flex items-center justify-center group/stage">
                        {activeVideo.url.startsWith('data:image') || activeVideo.type === 'image' ? (
                            <img src={activeVideo.url} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <video
                                ref={videoRef}
                                src={activeVideo.url}
                                controls
                                className="max-h-full max-w-full rounded-lg shadow-2xl border border-white/10"
                                poster={undefined} // H4 Fix: Do not use video URL as an image poster
                                preload="metadata" // ⚡ Bolt Optimization: efficient loading
                                onError={handleVideoError}
                                data-testid="video-player"
                            />
                        )}
                        {/* Info Overlay — Top-left, auto-hides to not block video controls */}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 max-w-sm opacity-0 group-hover/stage:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <p className="text-xs font-medium text-white truncate">{activeVideo.prompt}</p>
                            <div className="flex gap-2 text-[9px] text-gray-400 mt-0.5">
                                <span>{new Date(activeVideo.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span>{activeVideo.id.slice(0, 8)}</span>
                            </div>
                        </div>
                        {/* Daisychaining Buttons — Top-right, show on hover */}
                        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/stage:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={() => {
                                    const anchor = createFrameAnchor('anchor');
                                    if (anchor) {
                                        setVideoInputs({ firstFrame: anchor });
                                        logger.info('[VideoStage] Anchor frame set (captured from canvas)');
                                    }
                                }}
                                data-testid="set-anchor-btn"
                                aria-label="Set as anchor frame for next generation"
                                className="px-2.5 py-1.5 bg-black/60 backdrop-blur-md hover:bg-purple-500/30 rounded-lg text-[10px] font-semibold text-white/80 hover:text-white transition-all border border-white/10 hover:border-purple-500/40 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                ⚓ Set Anchor
                            </button>
                            <button
                                onClick={() => {
                                    const endFrame = createFrameAnchor('end');
                                    if (endFrame) {
                                        setVideoInputs({ lastFrame: endFrame });
                                        logger.info('[VideoStage] End frame set (captured from canvas)');
                                    }
                                }}
                                data-testid="set-end-frame-btn"
                                aria-label="Set as end frame for next generation"
                                className="px-2.5 py-1.5 bg-black/60 backdrop-blur-md hover:bg-indigo-500/30 rounded-lg text-[10px] font-semibold text-white/80 hover:text-white transition-all border border-white/10 hover:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                🎬 Set End Frame
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400/30">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="relative mb-6"
                        >
                            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                            <Video size={80} className="relative z-10 text-white/10" strokeWidth={1} />
                        </motion.div>
                        <h3 className="text-xl font-light text-white/40 tracking-[0.2em] uppercase mb-2">Director's Chair</h3>
                        <p className="text-sm font-medium text-white/20 max-w-xs text-center leading-relaxed">
                            Compose your vision above to begin.<br />
                            <span className="text-xs opacity-50">Keyboard Shortcut: <code className="bg-white/10 px-1 rounded text-white/40">⌘E</code> to toggle Editor</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});

VideoStage.displayName = 'VideoStage';
