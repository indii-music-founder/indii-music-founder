
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';
// Removed unused imports from framer-motion and lucide-react as they are now in VideoStage
import { Loader2, Layout, Maximize2, Settings } from 'lucide-react';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

// Components
import { DirectorPromptBar } from './components/DirectorPromptBar';
import { DailiesStrip } from './components/DailiesStrip';
import { VideoStage } from './components/VideoStage'; // ⚡ Bolt Optimization
import { useToast } from '@/core/context/ToastContext';

// Lazy load the heavy Editor
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));

export const processJobUpdate = (
    data: any,
    currentJobId: string,
    deps: {
        currentProjectId: string | null,
        currentOrganizationId: string | undefined,
        localPrompt: string,
        addToHistory: (item: HistoryItem) => void,
        setActiveVideo: (item: HistoryItem) => void,
        setJobId: (id: string | null) => void,
        setJobStatus: (status: any) => void,
        setJobProgress: (progress: number) => void,
        toast: any,
        resetEditorProgress: () => void,
        getCurrentStatus: () => string
    }
) => {
     if (data) {
        const newStatus = data.status;

        // Check current status to avoid unnecessary updates
        const currentStatus = deps.getCurrentStatus();
        if (newStatus && newStatus !== currentStatus) {
            // Start of type guard
            if (['idle', 'queued', 'processing', 'completed', 'failed', 'stitching'].includes(newStatus)) {
                deps.setJobStatus(newStatus as any);
            }
        }

        if (data.progress !== undefined) {
            deps.setJobProgress(data.progress);
        }

        if (newStatus === 'completed' && data.videoUrl) {
            const newAsset = {
                id: currentJobId,
                url: data.videoUrl,
                prompt: data.prompt || deps.localPrompt,
                type: 'video' as const,
                timestamp: Date.now(),
                projectId: deps.currentProjectId || 'default',
                orgId: deps.currentOrganizationId,
                meta: data.metadata ? JSON.stringify(data.metadata) : undefined
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
        setPrompt,
        studioControls,
        currentProjectId,
        videoInputs,
        currentOrganizationId,
        pendingPrompt,
        setPendingPrompt,
        selectedItem,
        setVideoInputs
    } = useStore(useShallow((state) => ({
        generatedHistory: state.generatedHistory,
        addToHistory: state.addToHistory,
        setPrompt: state.setPrompt,
        studioControls: state.studioControls,
        currentProjectId: state.currentProjectId,
        videoInputs: state.videoInputs,
        currentOrganizationId: state.currentOrganizationId,
        pendingPrompt: state.pendingPrompt,
        setPendingPrompt: state.setPendingPrompt,
        selectedItem: state.selectedItem,
        setVideoInputs: state.setVideoInputs
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

    // Sync pending prompt
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (pendingPrompt) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocalPrompt(pendingPrompt);
            setPrompt(pendingPrompt);
            setPendingPrompt(null);
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
    }, [viewMode, setViewMode]);

    // Set initial active video
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (selectedItem?.type === 'video') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveVideo(selectedItem);
        } else if (generatedHistory.length > 0 && !activeVideo) {
            // Find most recent video
            const recent = generatedHistory.find(h => h.type === 'video');
            if (recent) setActiveVideo(recent);
        }
    }, [selectedItem, generatedHistory, activeVideo]);

    // Job Listener
    useEffect(() => {
        if (!jobId) return;

        const unsubscribe = VideoGeneration.subscribeToJob(jobId, (data) => {
            if (data) {
                const newStatus = data.status;

                // Check current status to avoid unnecessary updates
                const currentStatus = useVideoEditorStore.getState().status;
                if (newStatus && newStatus !== currentStatus) {
                    // Start of type guard
                    if (['idle', 'queued', 'processing', 'completed', 'failed', 'stitching'].includes(newStatus)) {
                        setJobStatus(newStatus as 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'stitching');
                    }
                }

                if (data.progress !== undefined) {
                    setJobProgress(data.progress);
                    useVideoEditorStore.getState().setProgress(data.progress);
                }

                if (newStatus === 'completed' && data.videoUrl) {
                    // Extract metadata from Veo 3.1 output (enforcing contract)
                    const metadata = data.output?.metadata || data.metadata;

                    const newAsset = {
                        id: jobId,
                        url: data.videoUrl,
                        prompt: data.prompt || localPromptRef.current,
                        type: 'video' as const,
                        timestamp: Date.now(),
                        projectId: currentProjectId || 'default',
                        orgId: currentOrganizationId,
                        meta: metadata ? JSON.stringify(metadata) : undefined
                    };
                    addToHistory(newAsset);
                    setActiveVideo(newAsset);
                    toast.success('Scene generated!');
                    setJobId(null);
                    setJobStatus('idle');
                    useVideoEditorStore.getState().setProgress(0);
                } else if (newStatus === 'failed') {
                    toast.error(data.stitchError ? `Stitching failed: ${data.stitchError}` : 'Generation failed');
                    setJobId(null);
                    setJobStatus('failed');
                    useVideoEditorStore.getState().setProgress(0);
                }
            }
            processJobUpdate(data, jobId, {
                currentProjectId,
                currentOrganizationId,
                localPrompt: localPromptRef.current,
                addToHistory,
                setActiveVideo,
                setJobId,
                setJobStatus,
                setJobProgress: (p) => {
                    setJobProgress(p);
                    useVideoEditorStore.getState().setProgress(p);
                },
                toast,
                resetEditorProgress: () => useVideoEditorStore.getState().setProgress(0),
                getCurrentStatus: () => useVideoEditorStore.getState().status
            });
        });

        return () => { if (unsubscribe) unsubscribe(); };
    }, [jobId, addToHistory, toast, setJobId, setJobStatus, currentOrganizationId, currentProjectId, setActiveVideo, setJobProgress]);

    const handleGenerate = async () => {
        setJobStatus('queued');
        const isInterpolation = !!(videoInputs.firstFrame && videoInputs.lastFrame);
        toast.info(isInterpolation ? 'Queuing interpolation...' : 'Queuing scene generation...');

        try {
            // Update global prompt before generating
            setPrompt(localPrompt);

            let results: { id: string; url: string; prompt: string; }[] = [];

            // Check for long-form Video
            if (studioControls.duration > 8) {
                results = await VideoGeneration.generateLongFormVideo({
                    prompt: localPrompt,
                    totalDuration: studioControls.duration,
                    aspectRatio: studioControls.aspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrame: videoInputs.firstFrame?.url,
                    onProgress: (current, total) => {
                        // Optional: Could wire this up to a local progress update if store supports it
                        console.info(`Segment ${current}/${total}`);
                    }
                });
            } else {
                results = await VideoGeneration.generateVideo({
                    prompt: localPrompt,
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
                    duration: studioControls.duration
                });
            }

            if (results && results.length > 0) {
                const firstResult = results[0];

                // If the URL is provided immediately, complete it. Otherwise, set jobId to listen for updates.
                if (firstResult.url) {
                    results.forEach(res => {
                        const newAsset = {
                            id: res.id,
                            url: res.url,
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
        } catch (error: any) {
            console.error("Video generation failed:", error);
            toast.error(`Trigger failed: ${error.message}`);
            setJobStatus('failed');
        }
    };

    return (
        <div className={`flex-1 flex overflow-hidden h-full bg-[#0a0a0a] relative`}>
            {/* Main Stage (Director View) */}
            <div className={`flex-1 flex flex-col relative transition-all duration-500 ${viewMode === 'director' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}>

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
                <div className="absolute inset-0 z-50 bg-[#0a0a0a]">
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
