
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';
import { WhiskService } from '../../services/WhiskService';
// Removed unused imports from motion and lucide-react as they are now in VideoStage
import { Loader2, Layout, Maximize2, Settings } from 'lucide-react';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

// Components
import { DirectorPromptBar } from './components/DirectorPromptBar';
import { DailiesStrip } from './components/DailiesStrip';
import { VideoStage } from './components/VideoStage'; // ⚡ Bolt Optimization
import { useToast, ToastContextType } from '@/core/context/ToastContext';

/** Valid job status values for video generation */
export type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'stitching';

/** Data shape from Firestore video job listener */
export interface VideoJobUpdateData {
    status?: string;
    progress?: number;
    videoUrl?: string;
    prompt?: string;
    stitchError?: string;
    metadata?: Record<string, unknown>;
    output?: {
        metadata?: Record<string, unknown>;
    };
}

// Lazy load the heavy Editor
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));

export const processJobUpdate = (
    data: VideoJobUpdateData | null,
    currentJobId: string,
    deps: {
        currentProjectId: string | null,
        currentOrganizationId: string | undefined,
        localPrompt: string,
        addToHistory: (item: HistoryItem) => void,
        updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void,
        setActiveVideo: (item: HistoryItem) => void,
        setJobId: (id: string | null) => void,
        setJobStatus: (status: JobStatus) => void,
        setJobProgress: (progress: number) => void,
        toast: ToastContextType,
        resetEditorProgress: () => void,
        getCurrentStatus: () => JobStatus
    }
) => {
    if (data) {
        const newStatus = data.status;

        // Check current status to avoid unnecessary updates
        const currentStatus = deps.getCurrentStatus();
        if (newStatus && newStatus !== currentStatus) {
            // Type guard for valid job statuses
            const validStatuses: JobStatus[] = ['idle', 'queued', 'processing', 'completed', 'failed', 'stitching'];
            if (validStatuses.includes(newStatus as JobStatus)) {
                deps.setJobStatus(newStatus as JobStatus);
            }
        }

        if (data.progress !== undefined) {
            deps.setJobProgress(data.progress);
        }

        if (newStatus === 'completed' && data.videoUrl) {
            // ⚡ Automatic Local Save (Veo 3.1 Requirement)
            // The AI community/app needs access to this file locally first.
            const filename = `veo_${currentJobId}.mp4`;

            // Trigger background download via Electron
            // We don't await this to avoid blocking the UI update, but we log it
            if (window.electronAPI?.video?.saveAsset) {
                window.electronAPI.video.saveAsset(data.videoUrl, filename)
                    .then((path: string) => {
                        console.log('Video saved locally to:', path);
                        deps.updateHistoryItem(currentJobId, { localPath: path });
                    })
                    .catch((err: unknown) => {
                        console.error('Failed to save to local folder:', err);
                        deps.toast.error('Failed to save video to local disk.');
                    });
            }

            const metadata = data.output?.metadata || data.metadata;

            const newAsset = {
                id: currentJobId,
                url: data.videoUrl,
                localPath: '', // Will be updated async
                prompt: data.prompt || deps.localPrompt,
                type: 'video' as const,
                timestamp: Date.now(),
                projectId: deps.currentProjectId || 'default',
                orgId: deps.currentOrganizationId,
                meta: metadata ? JSON.stringify(metadata) : undefined
            };
            deps.addToHistory(newAsset);
            deps.setActiveVideo(newAsset);
            deps.toast.success('Scene generated!');
            deps.setJobId(null);
            deps.setJobStatus('idle');
            deps.resetEditorProgress();
        } else if (newStatus === 'failed') {
            deps.toast.error(data.stitchError ? `Stitching failed: ${data.stitchError}` : 'Generation failed');
            deps.setJobId(null);
            deps.setJobStatus('failed');
            deps.resetEditorProgress();
        }
    }
}

export default function VideoWorkflow() {
    // Global State
    // ⚡ Bolt Optimization: Use useShallow to prevent re-renders on unrelated store updates (like prompt keystrokes)
    const {
        generatedHistory,
        addToHistory,
        updateHistoryItem,
        setPrompt,
        studioControls,
        currentProjectId,
        videoInputs,
        currentOrganizationId,
        pendingPrompt,
        setPendingPrompt,
        selectedItem,
        setVideoInputs,
        whiskState
    } = useStore(useShallow((state: import('@/core/store').StoreState) => ({
        generatedHistory: state.generatedHistory,
        addToHistory: state.addToHistory,
        updateHistoryItem: state.updateHistoryItem,
        setPrompt: state.setPrompt,
        studioControls: state.studioControls,
        currentProjectId: state.currentProjectId,
        videoInputs: state.videoInputs,
        currentOrganizationId: state.currentOrganizationId,
        pendingPrompt: state.pendingPrompt,
        setPendingPrompt: state.setPendingPrompt,
        selectedItem: state.selectedItem,
        setVideoInputs: state.setVideoInputs,
        whiskState: state.whiskState
    })));

    // Editor Store
    const {
        viewMode,
        setViewMode,
        jobId,
        setJobId,
        status: jobStatus,
        setStatus: setJobStatus,
        progress: jobProgress,
        setProgress: setJobProgress
    } = useVideoEditorStore(useShallow(state => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        jobId: state.jobId,
        setJobId: state.setJobId,
        status: state.status,
        setStatus: state.setStatus,
        progress: state.progress,
        setProgress: state.setProgress
    })));

    const toast = useToast();

    // View State: 'director' (Generation) or 'editor' (Timeline)
    const [localPrompt, setLocalPrompt] = useState('');
    const localPromptRef = useRef(localPrompt);

    // Keep ref in sync
    useEffect(() => { localPromptRef.current = localPrompt; }, [localPrompt]);

    // Director State
    const [activeVideo, setActiveVideo] = useState<HistoryItem | null>(null);

    // Stable handler for drag start
    const handleDragStart = React.useCallback((e: React.DragEvent, item: HistoryItem) => {
        // Drag logic
    }, []);

    // ⚡ Bolt Optimization: Memoize filtered video list to prevent DailiesStrip re-renders
    const videoHistory = useMemo(() => {
        return generatedHistory.filter(h => h.type === 'video' && (!currentProjectId || h.projectId === currentProjectId));
    }, [generatedHistory, currentProjectId]);

    // Sync pending prompt — deferred to avoid cascading renders (react-hooks/set-state-in-effect)
    useEffect(() => {
        if (pendingPrompt) {
            queueMicrotask(() => {
                setLocalPrompt(pendingPrompt);
                setPrompt(pendingPrompt);
                setPendingPrompt(null);
            });
        }
    }, [pendingPrompt, setPrompt, setPendingPrompt]);

    // Keyboard Shortcut for Mode Toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                setViewMode(viewMode === 'director' ? 'editor' : 'director');
                toast.info(`Switched to ${viewMode === 'director' ? 'Editor' : 'Director'} Mode`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, setViewMode, toast]);

    // Set initial active video — deferred to avoid cascading renders (react-hooks/set-state-in-effect)
    useEffect(() => {
        if (selectedItem?.type === 'video') {
            queueMicrotask(() => setActiveVideo(selectedItem));
        } else if (generatedHistory.length > 0 && !activeVideo) {
            // Find most recent video
            const recent = generatedHistory.find(h => h.type === 'video');
            if (recent) queueMicrotask(() => setActiveVideo(recent));
        }
    }, [selectedItem, generatedHistory, activeVideo]);

    // Job Listener
    useEffect(() => {
        if (!jobId) return;

        const unsubscribe = VideoGeneration.subscribeToJob(jobId, (data) => {
            processJobUpdate(data, jobId, {
                currentProjectId,
                currentOrganizationId,
                localPrompt: localPromptRef.current,
                addToHistory,
                updateHistoryItem,
                setActiveVideo,
                setJobId,
                setJobStatus,
                setJobProgress: (p) => {
                    setTimeout(() => {
                        useVideoEditorStore.getState().setProgress(p);
                        setJobProgress(p);
                    }, 0); // H10 Fix: Avoid state cascade
                },
                toast,
                resetEditorProgress: () => {
                    setTimeout(() => useVideoEditorStore.getState().setProgress(0), 100); // H9 Fix: Delay reset
                },
                getCurrentStatus: () => useVideoEditorStore.getState().status
            });
        });

        return () => { if (unsubscribe) unsubscribe(); };
    }, [jobId, addToHistory, updateHistoryItem, toast, setJobId, setJobStatus, currentOrganizationId, currentProjectId, setActiveVideo, setJobProgress]);

    const handleGenerate = async (promptOverride?: string) => {
        setJobStatus('queued');
        const isInterpolation = !!(videoInputs.firstFrame && videoInputs.lastFrame);
        toast.info(isInterpolation ? 'Queuing interpolation...' : 'Queuing scene generation...');

        // ⚡ Bolt Optimization: Use prompt passed from child component (which has local state)
        // to avoid using stale state due to debounce, falling back to localPrompt.
        const promptToUse = promptOverride || localPrompt;

        try {
            // Update global prompt before generating
            setPrompt(promptToUse);
            if (promptOverride) setLocalPrompt(promptToUse); // Ensure local state matches

            // Synthesize prompt with Whisk references (SUBJECT, SCENE, STYLE, MOTION)
            let finalPrompt = WhiskService.synthesizeVideoPrompt(promptToUse, whiskState);

            // 🧠 Thinking Mode: Incorporate advanced reasoning into the prompt for now
            // until a native 'thinking' parameter is supported for Veo models.
            if (studioControls.thinking) {
                finalPrompt = `[Think CINEMATIC PHYSICS & CONTINUITY]: ${finalPrompt}`;
            }

            let results: { id: string; url: string; prompt: string; }[] = [];

            // Check for long-form Video
            if (studioControls.duration > 8) {
                results = await VideoGeneration.generateLongFormVideo({
                    prompt: finalPrompt,
                    totalDuration: studioControls.duration,
                    aspectRatio: studioControls.aspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrame: videoInputs.firstFrame?.url,
                    generateAudio: studioControls.generateAudio,
                    thinking: studioControls.thinking,
                    model: studioControls.model,
                    onProgress: (current, total) => {
                        // Optional: Could wire this up to a local progress update if store supports it
                        console.info(`Segment ${current}/${total}`);
                    }
                });
            } else {
                results = await VideoGeneration.generateVideo({
                    prompt: finalPrompt,
                    resolution: studioControls.resolution,
                    aspectRatio: studioControls.aspectRatio,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    fps: studioControls.fps,
                    cameraMovement: studioControls.cameraMovement,
                    motionStrength: studioControls.motionStrength,
                    shotList: studioControls.shotList,
                    firstFrame: videoInputs.firstFrame?.url,
                    lastFrame: videoInputs.lastFrame?.url,
                    timeOffset: videoInputs.timeOffset,
                    ingredients: videoInputs.ingredients?.map(i => i.url),
                    orgId: currentOrganizationId,
                    duration: studioControls.duration,
                    durationSeconds: studioControls.duration,
                    generateAudio: studioControls.generateAudio,
                    thinking: studioControls.thinking,
                    model: studioControls.model
                });
            }

            if (results && results.length > 0) {
                const firstResult = results[0];

                // If the URL is provided immediately, complete it. Otherwise, set jobId to listen for updates.
                if (firstResult.url) {
                    results.forEach(res => {
                        const filename = `veo_${res.id}.mp4`;

                        if (window.electronAPI?.video?.saveAsset) {
                            window.electronAPI.video.saveAsset(res.url, filename)
                                .then((path: string) => {
                                    console.log('Video saved locally to:', path);
                                    updateHistoryItem(res.id, { localPath: path });
                                })
                                .catch((err: unknown) => console.error('Failed to save to local folder:', err));
                        }

                        const newAsset = {
                            id: res.id,
                            url: res.url,
                            localPath: '', // Will be updated async
                            prompt: res.prompt,
                            type: 'video' as const,
                            timestamp: Date.now(),
                            projectId: currentProjectId
                        };
                        addToHistory(newAsset);
                        setActiveVideo(newAsset);
                    });
                    setJobStatus('completed');
                    toast.success('Scene generated!');
                } else {
                    // Start listening for the background job
                    setJobId(firstResult.id);
                    setJobStatus('processing');
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error("Video generation failed:", error);
            toast.error(`Trigger failed: ${message}`);
            setJobStatus('failed');
        }
    };

    return (
        <div className={`flex-1 flex overflow-hidden h-full bg-background relative`}>
            {/* Main Stage (Director View) */}
            <div
                id="director-panel"
                role="tabpanel"
                aria-label="Director Mode"
                className={`flex-1 flex flex-col relative transition-all duration-500 ${viewMode === 'director' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}
            >

                {/* Director Prompt Bar (Top Overlay) */}
                <DirectorPromptBar
                    prompt={localPrompt}
                    onPromptChange={(val) => {
                        setLocalPrompt(val);
                        setPrompt(val); // Sync real-time
                    }}
                    onGenerate={handleGenerate}
                    isGenerating={jobStatus === 'queued' || jobStatus === 'processing'}
                />

                {/* Central Preview Stage (Memoized) */}
                <VideoStage
                    jobStatus={jobStatus}
                    jobProgress={jobProgress}
                    activeVideo={activeVideo}
                    setVideoInputs={setVideoInputs}
                />

                {/* Dailies Strip (Bottom Overlay) */}
                <DailiesStrip
                    items={videoHistory}
                    selectedId={activeVideo?.id || null}
                    onSelect={setActiveVideo}
                    onDragStart={handleDragStart}
                />
            </div>

            {/* Editor Container (Full Screen Overlay) */}
            {viewMode === 'editor' && (
                <div
                    id="editor-panel"
                    role="tabpanel"
                    aria-label="Editor Mode"
                    className="absolute inset-0 z-50 bg-background"
                >
                    <ErrorBoundary fallback={<div className="p-10 text-red-500">Editor Error</div>}>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-yellow-500">Loading Cutting Room...</div>}>
                            <div className="h-full flex flex-col">
                                {/* Editor Header Removed - using Global Navbar */}
                                <div className="flex-1 relative">
                                    <VideoEditor initialVideo={activeVideo || undefined} />
                                </div>
                            </div>
                        </React.Suspense>
                    </ErrorBoundary>
                </div>
            )}
        </div>
    );
}
