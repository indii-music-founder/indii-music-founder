import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';
import { WhiskService } from '../../services/WhiskService';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

// Components
import { DirectorPromptBar } from './components/DirectorPromptBar';
import { CompositionPromptBar } from './components/CompositionPromptBar'; // New
import { DailiesStrip } from './components/DailiesStrip';
import { VideoStage } from './components/VideoStage';
import { useToast, ToastContextType } from '@/core/context/ToastContext';

// Remotion Player
import { Player } from '@remotion/player';
import { AIGeneratedComposition } from './remotion/compositions/AIGeneratedComposition';


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
            if (window.electronAPI?.video?.saveAsset) {
                window.electronAPI.video.saveAsset(data.videoUrl, filename)
                    .then((path: string) => {
                        console.log('Video saved locally to:', path);
                        deps.updateHistoryItem(currentJobId, { localPath: path });
                    })
                    .catch((err: any) => console.error('Failed to save to local folder:', err));
            }

            const newAsset = {
                id: currentJobId,
                url: data.videoUrl,
                localPath: '', // Will be updated async
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
    } = useStore(useShallow((state) => ({
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
        setProgress: setJobProgress,
        aiComposition
    } = useVideoEditorStore(useShallow(state => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        jobId: state.jobId,
        setJobId: state.setJobId,
        status: state.status,
        setStatus: state.setStatus,
        progress: state.progress,
        setProgress: state.setProgress,
        aiComposition: state.aiComposition
    })));

    const toast = useToast();

    // View State
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

    const videoHistory = useMemo(() => {
        return generatedHistory.filter(h => h.type === 'video' && (!currentProjectId || h.projectId === currentProjectId));
    }, [generatedHistory, currentProjectId]);

    // Sync pending prompt
    useEffect(() => {
        if (pendingPrompt) {
            setTimeout(() => {
                setLocalPrompt(pendingPrompt);
                setPrompt(pendingPrompt);
                setPendingPrompt(null);
            }, 0);
        }
    }, [pendingPrompt, setPrompt, setPendingPrompt]);

    // Set initial active video
    useEffect(() => {
        setTimeout(() => {
            if (selectedItem?.type === 'video') {
                setActiveVideo(selectedItem);
            } else if (generatedHistory.length > 0 && !activeVideo) {
                const recent = generatedHistory.find(h => h.type === 'video');
                if (recent) setActiveVideo(recent);
            }
        }, 0);
    }, [selectedItem, generatedHistory, activeVideo]);

    // Job Listener
    useEffect(() => {
        if (!jobId) return;

        const unsubscribe = VideoGeneration.subscribeToJob(jobId, (data) => {
            if (data) {
                const newStatus = data.status;
                const currentStatus = useVideoEditorStore.getState().status;

                if (newStatus && newStatus !== currentStatus) {
                    if (['idle', 'queued', 'processing', 'completed', 'failed', 'stitching'].includes(newStatus)) {
                        setJobStatus(newStatus as 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'stitching');
                    }
                }

                if (data.progress !== undefined) {
                    setJobProgress(data.progress);
                    useVideoEditorStore.getState().setProgress(data.progress);
                }

                if (newStatus === 'completed' && data.videoUrl) {
                    const metadata = data.output?.metadata || data.metadata;
                    const filename = `veo_${jobId}.mp4`;

                    if (window.electronAPI?.video?.saveAsset) {
                        window.electronAPI.video.saveAsset(data.videoUrl, filename)
                            .then((path: string) => console.log('Video saved locally to:', path))
                            .catch((err: any) => console.error('Failed to save to local folder:', err));
                    }

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
                updateHistoryItem,
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

    const handleGenerate = async (promptOverride?: string) => {
        // Veo generation logic
        setJobStatus('queued');
        const isInterpolation = !!(videoInputs.firstFrame && videoInputs.lastFrame);
        toast.info(isInterpolation ? 'Queuing interpolation...' : 'Queuing scene generation...');

        const promptToUse = promptOverride || localPrompt;

        try {
            setPrompt(promptToUse);
            if (promptOverride) setLocalPrompt(promptToUse);

            const finalPrompt = WhiskService.synthesizeVideoPrompt(promptToUse, whiskState);
            let results: { id: string; url: string; prompt: string; }[] = [];

            if (studioControls.duration > 8) {
                results = await VideoGeneration.generateLongFormVideo({
                    prompt: finalPrompt,
                    totalDuration: studioControls.duration,
                    aspectRatio: studioControls.aspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrame: videoInputs.firstFrame?.url,
                    onProgress: (current, total) => console.info(`Segment ${current}/${total}`)
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
                    duration: studioControls.duration
                });
            }

            if (results && results.length > 0) {
                const firstResult = results[0];
                if (firstResult.url) {
                    results.forEach(res => {
                        const filename = `veo_${res.id}.mp4`;
                        if (window.electronAPI?.video?.saveAsset) {
                            window.electronAPI.video.saveAsset(res.url, filename)
                                .then((path: string) => updateHistoryItem(res.id, { localPath: path }))
                                .catch((err: any) => console.error('Failed to save to local folder:', err));
                        }
                        const newAsset = {
                            id: res.id,
                            url: res.url,
                            localPath: '',
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

            {/* Mode Switcher Overlay (Top Right) */}
            <div className="absolute top-4 right-4 z-[60] flex gap-2 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/10">
                {(['director', 'composer', 'editor'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${viewMode === mode
                            ? 'bg-white text-black shadow-lg'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            {/* Director Panel */}
            <div
                id="director-panel"
                className={`flex-1 flex flex-col relative transition-all duration-500 absolute inset-0 ${viewMode === 'director' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
                <DirectorPromptBar
                    prompt={localPrompt}
                    onPromptChange={(val) => { setLocalPrompt(val); setPrompt(val); }}
                    onGenerate={handleGenerate}
                    isGenerating={jobStatus === 'queued' || jobStatus === 'processing'}
                />
                <VideoStage
                    jobStatus={jobStatus}
                    jobProgress={jobProgress}
                    activeVideo={activeVideo}
                    setVideoInputs={setVideoInputs}
                />
                <DailiesStrip
                    items={videoHistory}
                    selectedId={activeVideo?.id || null}
                    onSelect={setActiveVideo}
                    onDragStart={handleDragStart}
                />
            </div>

            {/* Composer Panel */}
            <div
                id="composer-panel"
                className={`flex-1 flex flex-col relative transition-all duration-500 absolute inset-0 bg-background ${viewMode === 'composer' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
                <CompositionPromptBar onBack={() => setViewMode('director')} />

                <div className="flex-1 flex items-center justify-center p-8">
                    {aiComposition ? (
                        <div className="w-full max-w-5xl aspect-video rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                            <Player
                                component={AIGeneratedComposition}
                                inputProps={{ composition: aiComposition }}
                                durationInFrames={300} // This should be dynamic based on comp
                                fps={30}
                                compositionWidth={1920}
                                compositionHeight={1080}
                                style={{ width: '100%', height: '100%' }}
                                controls
                            />
                        </div>
                    ) : (
                        <div className="text-center text-white/30">
                            <p className="text-xl">Describe a scene to begin composition.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Panel */}
            {viewMode === 'editor' && (
                <div className="absolute inset-0 z-50 bg-background">
                    <ErrorBoundary fallback={<div className="p-10 text-red-500">Editor Error</div>}>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-yellow-500">Loading Cutting Room...</div>}>
                            <VideoEditor initialVideo={activeVideo || undefined} />
                        </React.Suspense>
                    </ErrorBoundary>
                </div>
            )}
        </div>
    );
}
