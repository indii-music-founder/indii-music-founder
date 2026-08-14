import React from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles, Video, X } from 'lucide-react';
import { HistoryItem } from '@/core/store';
import { CreativeSlice } from '@/core/store/slices/creative';
import { logger } from '@/utils/logger';
import { VideoJsPlayer, type VideoJsPlayerHandle } from './VideoJsPlayer';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { extractVideoFrameAt } from '@/utils/video';

interface VideoStageProps {
    jobStatus: 'idle' | 'queued' | 'processing' | 'stitching' | 'completed' | 'failed' | 'cancelled';
    jobProgress: number;
    activeVideo: HistoryItem | null;
    firstFrame?: HistoryItem | null;
    lastFrame?: HistoryItem | null;
    maskRange?: { startFrame: number; endFrame: number };
    setVideoInputs: (inputs: Partial<CreativeSlice['videoInputs']>) => void;
    onCancelJob?: () => void;
}

// ⚡ Bolt Optimization: Memoize this heavy component to prevent re-renders when parent state (like prompt input) changes
export const VideoStage = React.memo<VideoStageProps>(({
    jobStatus,
    jobProgress,
    activeVideo,
    firstFrame,
    lastFrame,
    maskRange,
    setVideoInputs,
    onCancelJob
}) => {
    const [videoError, setVideoError] = React.useState<string | null>(null);
    const [displayProgress, setDisplayProgress] = React.useState(0);
    const [statusMessageIndex, setStatusMessageIndex] = React.useState(0);
    const [extractionState, setExtractionState] = React.useState<{
        active: boolean;
        label: string | null;
        progress: number;
        error: string | null;
    }>({
        active: false,
        label: null,
        progress: 0,
        error: null,
    });
    const playerRef = React.useRef<VideoJsPlayerHandle | null>(null);
    const extractionAbortRef = React.useRef<AbortController | null>(null);

    const clearExtraction = React.useCallback(() => {
        extractionAbortRef.current?.abort();
        extractionAbortRef.current = null;
        setExtractionState({ active: false, label: null, progress: 0, error: null });
    }, []);

    React.useEffect(() => () => clearExtraction(), [clearExtraction]);

    // The /creative route runs with Cross-Origin-Embedder-Policy: require-corp
    // (needed elsewhere for SharedArrayBuffer/wasm audio processing). A plain
    // <img src="https://firebasestorage..."> gets silently blocked under that
    // policy because GCS never sends a Cross-Origin-Resource-Policy header —
    // same failure mode CanvasOperationsService.loadImageSafe already works
    // around for the canvas. Mirror that here: resolve remote frame URLs to a
    // same-origin blob: URL before handing them to <img>.
    const frameItem = firstFrame || lastFrame;
    const [resolvedFrameUrl, setResolvedFrameUrl] = React.useState<string | null>(null);
    const [frameImageFailed, setFrameImageFailed] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setResolvedFrameUrl(null);
        setFrameImageFailed(false);

        const url = frameItem?.url;
        if (!url) return;

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            setResolvedFrameUrl(url);
            return;
        }

        (async () => {
            try {
                const { safeStorageFetch } = await import('@/services/storage/safeStorageFetch');
                const { blob } = await safeStorageFetch(url);
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setResolvedFrameUrl(objectUrl);
            } catch (error) {
                // Don't fall back to the raw cross-origin URL — this route runs under
                // Cross-Origin-Embedder-Policy: require-corp, so a direct <img src>
                // to Storage is blocked the same way safeStorageFetch's own direct-fetch
                // attempt just was. Go straight to the graceful placeholder instead of
                // rendering an <img> that's guaranteed to fail.
                logger.warn('[VideoStage] Failed to resolve start/end frame preview', error);
                if (!cancelled) setFrameImageFailed(true);
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [frameItem?.id, frameItem?.url]);

    const createFrameAnchor = React.useCallback(async (
        label: 'anchor' | 'end' | 'mask'
    ): Promise<HistoryItem | null> => {
        if (!activeVideo) return null;

        const currentPlayer = playerRef.current;
        const fps = 24;
        const targetTime = label === 'anchor'
            ? 1 / fps
            : label === 'end'
                ? Math.max(0, (currentPlayer?.duration() || 0) - (1 / fps))
                : currentPlayer?.currentTime() ?? 0;

        const sourceUrl = activeVideo.storageUri || activeVideo.url;
        const extractionLabel = label === 'mask' ? 'mask frame' : label === 'anchor' ? 'anchor frame' : 'end frame';
        const controller = new AbortController();
        extractionAbortRef.current = controller;
        setExtractionState({ active: true, label: extractionLabel, progress: 0, error: null });

        try {
            const { useStore } = await import('@/core/store');
            const { user, currentProjectId, activeSessionId } = useStore.getState();
            const extracted = await extractVideoFrameAt(sourceUrl, targetTime, {
                fps,
                signal: controller.signal,
                onProgress: ({ progress }) => {
                    setExtractionState((state) => state.active ? { ...state, progress } : state);
                },
            });

            if (user?.uid) {
                const storageUri = await CreativeStorageService.uploadReferenceMedia(user.uid, extracted.dataUrl, 'image', {
                    projectId: currentProjectId || activeVideo.projectId || undefined,
                    sessionId: currentProjectId || activeVideo.projectId ? undefined : activeSessionId || undefined,
                    scope: label === 'mask' ? 'masks' : 'assets'
                });

                return {
                    ...activeVideo,
                    id: `${activeVideo.id}-${label}-frame`,
                    url: storageUri,
                    storageUri,
                    type: 'image' as const,
                    prompt: `${label === 'anchor' ? 'First' : label === 'end' ? 'Last' : 'Mask'} frame from: ${activeVideo.prompt || 'video'}`,
                    timestamp: Date.now(),
                    mask: label === 'mask' ? storageUri : undefined
                };
            }
        } catch (error) {
            if (!(error instanceof Error && error.message === 'Operation cancelled')) {
                logger.warn(`[VideoStage] Failed to persist ${label} frame to Storage; falling back to data URL`, error);
                setExtractionState((state) => ({ ...state, error: error instanceof Error ? error.message : String(error) }));
            }
        }

        const fallbackFrame = playerRef.current?.captureFrame();
        if (!fallbackFrame) {
            logger.warn(`[VideoStage] Failed to capture ${label} frame — using fallback`);
            return activeVideo;
        }

        return {
            ...activeVideo,
            id: `${activeVideo.id}-${label}-frame`,
            url: fallbackFrame,
            storageUri: undefined,
            type: 'image' as const,
            prompt: `${label === 'anchor' ? 'First' : label === 'end' ? 'Last' : 'Mask'} frame from: ${activeVideo.prompt || 'video'}`,
            timestamp: Date.now(),
            mask: label === 'mask' ? fallbackFrame : undefined
        };
    }, [activeVideo]);

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

    // Display-only estimated progress while the backend reports queued/processing.
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
            } catch (e: unknown) {
                logger.debug('[VideoStage] Non-fatal metadata parse error:', e);
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
            } catch (e: unknown) {
                logger.warn('[VideoStage] Blob URL recovery attempt failed:', e);
            }

            // If recovery fails and we are still a blob: 
            setVideoError("Playback Error: Local asset missing. This video was from a previous session and is no longer available offline.");
            return;
        }

        setVideoError("Playback Error: Video source unavailable or corrupted.");
    }, [activeVideo]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Grid Ambience */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="relative w-full h-full bg-[#0a0a0a] rounded-xl overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10 group flex items-center justify-center">
                {jobStatus === 'processing' || jobStatus === 'queued' || jobStatus === 'stitching' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                        <div className="w-24 h-24 relative mb-4">
                            <div className="absolute inset-0 rounded-full border-t-2 border-green-500 animate-spin"></div>
                            <div className="absolute inset-2 rounded-full border-r-2 border-indigo-500 animate-spin flex items-center justify-center">
                                <Sparkles size={24} className="text-green-400 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-green-400 to-pink-600 animate-pulse capitalize">
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
                                className="h-full bg-linear-to-r from-green-500 to-indigo-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${displayProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        {onCancelJob && (
                            <button
                                type="button"
                                onClick={onCancelJob}
                                className="mt-4 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                aria-label="Cancel video generation"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                ) : videoError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-20">
                        <div className="p-4 rounded-full mb-2 bg-white/5 border border-white/10 shadow-lg">
                            <Video size={24} className="text-gray-500" />
                        </div>
                        <h3 className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">Preview Unavailable</h3>
                        <p className="text-gray-600 text-[10px] text-center max-w-xs">{videoError}</p>
                    </div>
                ) : activeVideo ? (
                    <div className="relative w-full h-full flex items-center justify-center group/stage">
                        {extractionState.active && (
                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
                                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 shadow-2xl">
                                    <Loader2 size={18} className="text-green-400 animate-spin" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-white truncate">
                                            Extracting {extractionState.label}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {Math.round(extractionState.progress)}%
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => clearExtraction()}
                                        className="ml-2 rounded-md border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
                                        aria-label="Cancel frame extraction"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                {extractionState.error && (
                                    <p className="mt-3 max-w-sm text-center text-[10px] text-rose-300">
                                        {extractionState.error}
                                    </p>
                                )}
                            </div>
                        )}
                        {activeVideo.url.startsWith('data:image') || activeVideo.type === 'image' ? (
                            <img src={activeVideo.url} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <VideoJsPlayer
                                ref={playerRef}
                                videoUrl={activeVideo.url}
                                mimeType={activeVideo.meta ? (() => {
                                    try {
                                        const meta = JSON.parse(activeVideo.meta);
                                        return meta.mime_type || 'video/mp4';
                                    } catch {
                                        return 'video/mp4';
                                    }
                                })() : 'video/mp4'}
                                controls
                                onError={(message) => {
                                    if (activeVideo?.url.startsWith('blob:')) {
                                        void handleVideoError();
                                        return;
                                    }
                                    setVideoError(message);
                                }}
                                className="max-h-full max-w-full rounded-lg shadow-2xl border border-white/10"
                                dataTestId="video-player"
                            />
                        )}
                        {/* Info Overlay — Top-left, auto-hides to not block video controls */}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 max-w-sm opacity-0 group-hover/stage:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <p className="text-xs font-medium text-white truncate">{activeVideo.prompt}</p>
                            <div className="flex gap-2 text-[9px] text-gray-400 mt-0.5">
                                <span>{new Date(activeVideo.timestamp).toLocaleTimeString('en-US')}</span>
                                <span>•</span>
                                <span>{activeVideo.id.slice(0, 8)}</span>
                            </div>
                        </div>
                        {/* Daisychaining Buttons — Top-right, show on hover */}
                        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/stage:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={() => {
                                    void createFrameAnchor('anchor').then((anchor) => {
                                        if (anchor) {
                                            const startFrame = Math.max(0, Math.round((playerRef.current?.currentTime() || 0) * 24));
                                            setVideoInputs({
                                                firstFrame: anchor,
                                                maskRange: { startFrame, endFrame: startFrame } // Will be updated when end frame is set
                                            });
                                            logger.info('[VideoStage] Anchor frame set (start frame captured)');
                                        }
                                    }).catch((err) => logger.error('[VideoStage] Anchor frame creation failed:', err));
                                }}
                                data-testid="set-anchor-btn"
                                aria-label="Set as anchor frame for temporal inpaint (start frame)"
                                className="px-2.5 py-1.5 bg-black/60 backdrop-blur-md hover:bg-green-500/30 rounded-lg text-[10px] font-semibold text-white/80 hover:text-white transition-all border border-white/10 hover:border-green-500/40 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                ⚓ Set Anchor
                            </button>
                            <button
                                onClick={() => {
                                    void createFrameAnchor('end').then((endFrame) => {
                                        if (endFrame) {
                                            const endFrameNum = Math.max(0, Math.round((playerRef.current?.currentTime() || 0) * 24));
                                            // Update maskRange: keep existing startFrame, update endFrame
                                            const updatedMaskRange = {
                                                startFrame: maskRange?.startFrame ?? 0,
                                                endFrame: endFrameNum
                                            };
                                            setVideoInputs({
                                                lastFrame: endFrame,
                                                maskRange: updatedMaskRange
                                            });
                                            logger.info(`[VideoStage] End frame set (end frame captured, range: ${updatedMaskRange.startFrame}→${updatedMaskRange.endFrame})`);
                                        }
                                    }).catch((err) => logger.error('[VideoStage] End frame creation failed:', err));
                                }}
                                data-testid="set-end-frame-btn"
                                aria-label="Set as end frame for temporal inpaint"
                                className="px-2.5 py-1.5 bg-black/60 backdrop-blur-md hover:bg-indigo-500/30 rounded-lg text-[10px] font-semibold text-white/80 hover:text-white transition-all border border-white/10 hover:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                🎬 Set End Frame
                            </button>
                            <button
                                onClick={() => {
                                    // Temporal inpaint requires a non-zero frame range (startFrame < endFrame)
                                    if (!maskRange || maskRange.endFrame <= maskRange.startFrame) {
                                        setExtractionState(prev => ({
                                            ...prev,
                                            error: 'Temporal inpaint requires a frame range (start < end). Set Anchor Frame (start) and End Frame at different times before capturing mask.'
                                        }));
                                        logger.warn('[VideoStage] Cannot set mask: invalid frame range (endFrame must be > startFrame).');
                                        return;
                                    }
                                    void createFrameAnchor('mask').then((maskFrame) => {
                                        if (maskFrame) {
                                            setVideoInputs({
                                                maskFrame,
                                                maskRange,
                                                isTemporalInpaint: true
                                            } as Partial<CreativeSlice['videoInputs']>);
                                            logger.info('[VideoStage] Mask frame set with temporal inpaint range');
                                        }
                                    }).catch((err) => logger.error('[VideoStage] Mask frame creation failed:', err));
                                }}
                                data-testid="set-mask-frame-btn"
                                aria-label="Set as mask frame for temporal inpaint (requires setting anchor and end frames first)"
                                className="px-2.5 py-1.5 bg-black/60 backdrop-blur-md hover:bg-emerald-500/30 rounded-lg text-[10px] font-semibold text-white/80 hover:text-white transition-all border border-white/10 hover:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
                            >
                                🖌 Set Mask
                            </button>
                        </div>
                    </div>
                ) : firstFrame || lastFrame ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {resolvedFrameUrl && !frameImageFailed ? (
                            <img
                                src={resolvedFrameUrl}
                                alt={firstFrame ? 'Start frame' : 'End frame'}
                                className="w-full h-full object-contain"
                                onError={() => setFrameImageFailed(true)}
                                onLoad={(e) => {
                                    // Some COEP/network blocks report the <img> as "loaded"
                                    // (complete=true) without ever firing onError, leaving a
                                    // blank 0x0 image with no visible failure signal.
                                    if (e.currentTarget.naturalWidth === 0) {
                                        setFrameImageFailed(true);
                                    }
                                }}
                            />
                        ) : frameImageFailed ? (
                            <div className="flex flex-col items-center gap-2 text-white/30">
                                <Video size={48} strokeWidth={1} />
                                <p className="text-xs font-medium">Preview unavailable — frame is still set and ready to use</p>
                            </div>
                        ) : (
                            <Loader2 size={32} className="text-white/30 animate-spin" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                        {firstFrame && (
                            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg border border-green-500/40">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">⚓ Start Frame Set</span>
                                <button
                                    type="button"
                                    onClick={() => setVideoInputs({ firstFrame: null })}
                                    data-testid="clear-first-frame-btn"
                                    aria-label="Remove start frame"
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        {lastFrame && (
                            <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-2 rounded-lg border border-indigo-500/40">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">🎬 End Frame Set</span>
                                <button
                                    type="button"
                                    onClick={() => setVideoInputs({ lastFrame: null })}
                                    data-testid="clear-last-frame-btn"
                                    aria-label="Remove end frame"
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                            <p className="text-sm font-medium text-white/70 max-w-xs">
                                Describe your shot below, then Generate to bring it to life.
                            </p>
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
