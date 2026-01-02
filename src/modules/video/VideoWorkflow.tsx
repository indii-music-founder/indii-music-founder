
import React, { useState, useEffect, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '@/services/image/VideoGenerationService';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Layout, Video, Sparkles, Maximize2, Settings } from 'lucide-react';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

// Components
import { DirectorPromptBar } from './components/DirectorPromptBar';
import { DailiesStrip } from './components/DailiesStrip';
import { useToast } from '@/core/context/ToastContext';

// Lazy load the heavy Editor
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));

export default function VideoWorkflow() {
    // Global State
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
        selectedItem
    } = useStore();

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
    } = useVideoEditorStore();

    const toast = useToast();

    // View State: 'director' (Generation) or 'editor' (Timeline)
    const [localPrompt, setLocalPrompt] = useState('');
    const localPromptRef = useRef(localPrompt);

    // Keep ref in sync
    useEffect(() => { localPromptRef.current = localPrompt; }, [localPrompt]);

    // Director State
    const [activeVideo, setActiveVideo] = useState<HistoryItem | null>(null);


    // Sync pending prompt
    useEffect(() => {
        if (pendingPrompt) {
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
        if (selectedItem?.type === 'video') {
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
                    setJobStatus(newStatus as any);
                }

                if (data.progress !== undefined) {
                    setJobProgress(data.progress);
                }

                        // Update progress
                        if (data.progress) {
                            useVideoEditorStore.getState().setProgress(data.progress);
                        }

                        if (newStatus === 'completed' && data.videoUrl) {
                            const newAsset = {
                                id: jobId,
                                url: data.videoUrl,
                                prompt: data.prompt || localPromptRef.current,
                                type: 'video' as const,
                                timestamp: Date.now(),
                                projectId: currentProjectId || 'default',
                                orgId: currentOrganizationId
                            };
                            addToHistory(newAsset);
                            setActiveVideo(newAsset); // Auto-play result
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
                });
            } catch (e) {
                console.error("Job listener error:", e);
                if (newStatus === 'completed' && data.videoUrl) {
                    const newAsset = {
                        id: jobId,
                        url: data.videoUrl,
                        prompt: data.prompt || localPromptRef.current,
                        type: 'video' as const,
                        timestamp: Date.now(),
                        projectId: currentProjectId || 'default',
                        projectId: 'default',
                        orgId: currentOrganizationId
                    };
                    addToHistory(newAsset);
                    setActiveVideo(newAsset); // Auto-play result
                    toast.success('Scene generated!');
                    setJobId(null);
                    setJobStatus('idle');
                } else if (newStatus === 'failed') {
                    toast.error('Generation failed');
                    setJobId(null);
                    setJobStatus('failed');
                }
            }
        });

        return () => { if (unsubscribe) unsubscribe(); };
    }, [jobId, addToHistory, toast, setJobId, setJobStatus, currentOrganizationId]);

    const handleGenerate = async () => {
        setJobStatus('queued');
        const isInterpolation = !!(videoInputs.firstFrame && videoInputs.lastFrame);
        toast.info(isInterpolation ? 'Queuing interpolation...' : 'Queuing scene generation...');

        try {
            // Update global prompt before generating
            setPrompt(localPrompt);

            const results = await VideoGeneration.generateVideo({
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
                orgId: currentOrganizationId
            });

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

                {/* Central Preview Stage */}
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
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
                                    {jobStatus === 'stitching' ? 'Stitching Scenes...' : 'Imaginating Scene...'}
                                </h3>
                                <p className="text-gray-500 text-sm mt-2">
                                    {jobStatus === 'stitching'
                                        ? 'Combining segments into final cut'
                                        : 'AI Director is rendering your vision'}
                                </p>

                                {useVideoEditorStore.getState().progress > 0 && (
                                    <div className="w-64 h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                            style={{ width: `${useVideoEditorStore.getState().progress}%` }}
                                        />
                                    </div>
                                )}
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse capitalize">
                                    {jobStatus === 'stitching' ? 'Stitching Masterpiece...' : 'Imaginating Scene...'}
                                </h3>
                                <p className="text-gray-500 text-sm mt-2">
                                    {jobStatus === 'stitching' ? 'Finalizing your unified video' : `AI Director is rendering your vision (${jobProgress}%)`}
                                </p>
                                {/* Progress Bar */}
                                <div className="w-64 h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${jobProgress}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        ) : activeVideo ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                {activeVideo.url.startsWith('data:image') || activeVideo.type === 'image' ? (
                                    <img src={activeVideo.url} alt="Preview" className="w-full h-full object-contain" />
                                ) : (
                                    <video
                                        src={activeVideo.url}
                                        controls
                                        className="max-h-full max-w-full rounded-lg shadow-2xl border border-white/10"
                                        poster={activeVideo.url}
                                    />
                                )}
                                {/* Info Overlay */}
                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 max-w-md">
                                    <p className="text-sm font-medium text-white truncate">{activeVideo.prompt}</p>
                                    <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                                        <span>{new Date(activeVideo.timestamp).toLocaleTimeString()}</span>
                                        <span>•</span>
                                        <span>{activeVideo.id.slice(0, 8)}</span>
                                    </div>
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

                {/* Dailies Strip (Bottom Overlay) */}
                <DailiesStrip
                    items={generatedHistory.filter(h => h.type === 'video')}
                    selectedId={activeVideo?.id || null}
                    onSelect={setActiveVideo}
                    onDragStart={() => { }}
                />
            </div>

            {/* Editor Container (Full Screen Overlay) */}
            {viewMode === 'editor' && (
                <div className="absolute inset-0 z-50 bg-[#0a0a0a]">
                    <ErrorBoundary fallback={<div className="p-10 text-red-500">Editor Error</div>}>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-yellow-500">Loading Cutting Room...</div>}>
                            <div className="h-full flex flex-col">
                                {/* Editor Header */}
                                <div className="h-10 bg-black border-b border-white/10 flex items-center px-4 justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setViewMode('director')}
                                            className="text-gray-400 hover:text-white flex items-center gap-1 text-xs"
                                        >
                                            <Layout size={14} /> Back to Director
                                        </button>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">The Cutting Room</span>
                                    <div className="w-20"></div>
                                </div>
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
