import React, { useState, useEffect, useRef } from 'react';
import { Film, Layout, Maximize2, Minimize2, Settings, Sparkles } from 'lucide-react';
import { useStore, HistoryItem } from '../../core/store';
import { useToast } from '../../core/context/ToastContext';
import { useVideoEditorStore } from './store/videoEditorStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { VideoGenerationSidebar } from './components/VideoGenerationSidebar';
import { DirectorPromptBar } from './components/DirectorPromptBar';
import { DailiesStrip } from './components/DailiesStrip';

// Lazy load the heavy Editor
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));

export default function VideoWorkflow() {
    const {
        generatedHistory,
        selectedItem,
        pendingPrompt,
        setPendingPrompt,
        addToHistory,
        setPrompt,
        studioControls,
        videoInputs,
        setVideoInput,
        currentOrganizationId
    } = useStore();

    const {
        jobId,
        status: jobStatus,
        setJobId,
        setStatus: setJobStatus
    } = useVideoEditorStore();

    const toast = useToast();

    // View State: 'director' (Generation) or 'editor' (Timeline)
    const [viewMode, setViewMode] = useState<'director' | 'editor'>('director');
    const [localPrompt, setLocalPrompt] = useState('');

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

    // Job Listener (kept from original)
    useEffect(() => {
        if (!jobId) return;

        let unsubscribe: () => void;
        const setupListener = async () => {
            try {
                const { doc, onSnapshot } = await import('firebase/firestore');
                const { db } = await import('@/services/firebase');

                unsubscribe = onSnapshot(doc(db, 'videoJobs', jobId), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        const newStatus = data?.status;

                        // Use functional update to avoid dependency on jobStatus
                        setJobStatus((currentStatus) => {
                            if (newStatus && newStatus !== currentStatus) {
                                return newStatus;
                            }
                            return currentStatus;
                        });

                        if (newStatus === 'completed' && data.videoUrl) {
                            const newAsset = {
                                id: jobId,
                                url: data.videoUrl,
                                prompt: data.prompt || localPrompt, // Use stored prompt or initial local prompt
                                type: 'video' as const,
                                timestamp: Date.now(),
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
            } catch (e) {
                console.error("Job listener error:", e);
            }
        };
        setupListener();
        return () => { if (unsubscribe) unsubscribe(); };
        // Removed jobStatus and localPrompt from dependencies to prevent re-subscriptions and use stable/initial values
    }, [jobId, addToHistory, toast, setJobId, setJobStatus, currentOrganizationId]);

    const handleGenerate = async () => {
        setJobStatus('queued');
        const isInterpolation = videoInputs.firstFrame && videoInputs.lastFrame;
        toast.info(isInterpolation ? 'Queuing interpolation...' : 'Queuing scene generation...');

        try {
            const { VideoGeneration } = await import('@/services/image/VideoGenerationService');
            const { jobId: newJobId } = await VideoGeneration.triggerVideoGeneration({
                prompt: localPrompt,
                resolution: studioControls.resolution,
                aspectRatio: studioControls.aspectRatio,
                negativePrompt: studioControls.negativePrompt,
                seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                cameraMovement: studioControls.cameraMovement,
                motionStrength: studioControls.motionStrength,
                fps: studioControls.fps,
                shotList: studioControls.shotList,
                firstFrame: videoInputs.firstFrame?.url,
                lastFrame: videoInputs.lastFrame?.url,
                timeOffset: videoInputs.timeOffset,
                ingredients: videoInputs.ingredients?.map(i => i.url),
                orgId: currentOrganizationId
            });
            setJobId(newJobId);
        } catch (error: any) {
            console.error("Video generation failed:", error);
            toast.error(`Trigger failed: ${error.message}`);
            setJobStatus('failed');
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden h-full bg-[#0a0a0a] relative">

            {/* Main Stage (Director View) */}
            <div className={`flex-1 flex flex-col relative transition-all duration-500 ${viewMode === 'director' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}>

                {/* Director Prompt Bar (Top Overlay) */}
                <DirectorPromptBar
                    prompt={localPrompt}
                    onPromptChange={setLocalPrompt}
                    onGenerate={handleGenerate}
                    isGenerating={jobStatus === 'queued' || jobStatus === 'processing'}
                />

                {/* Central Preview Stage */}
                <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
                    {/* Background Grid Ambience */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

                    {/* Main Cinema View */}
                    <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10 group">

                        {jobStatus === 'processing' || jobStatus === 'queued' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                                <div className="w-24 h-24 relative mb-4">
                                    <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin"></div>
                                    <div className="absolute inset-2 rounded-full border-r-2 border-indigo-500 animate-spin flex items-center justify-center">
                                        <Sparkles size={24} className="text-purple-400 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
                                    Imaginating Scene...
                                </h3>
                                <p className="text-gray-500 text-sm mt-2">AI Director is rendering your vision</p>
                            </div>
                        ) : activeVideo ? (
                            activeVideo.url.startsWith('data:image') || activeVideo.type === 'image' ? (
                                <img src={activeVideo.url} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                                <video
                                    src={activeVideo.url}
                                    controls
                                    autoPlay
                                    loop
                                    className="w-full h-full object-contain"
                                />
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-700">
                                <Film size={64} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium opacity-50">Studio Ready</p>
                                <p className="text-sm opacity-30">Enter a prompt to begin</p>
                            </div>
                        )}

                        {/* Overlay Controls */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg backdrop-blur-md transition-colors">
                                <Maximize2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dailies Strip (Bottom Overlay) */}
                <DailiesStrip
                    items={generatedHistory}
                    selectedId={activeVideo?.id || null}
                    onSelect={setActiveVideo}
                    onDragStart={() => { }} // TODO: Drag to editor
                />
            </div>

            {/* Editor Container (Full Screen Overlay) */}
            {viewMode === 'editor' && (
                <div className="absolute inset-0 z-50 bg-[#0a0a0a]">
                    <ErrorBoundary fallback={<div className="p-10 text-red-500">Editor Error</div>}>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-yellow-500">Loading Cutting Room...</div>}>
                            <div className="h-full flex flex-col">
                                {/* Editor Header (integrated or part of Editor component) */}
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

            {/* Switch Mode Button (Floating when in Director Mode) */}
            {viewMode === 'director' && (
                <div className="absolute bottom-8 right-8 z-30">
                    <button
                        onClick={() => setViewMode('editor')}
                        className="group flex items-center gap-3 pl-4 pr-2 py-2 bg-gradient-to-r from-gray-900 to-black border border-white/10 rounded-full hover:border-yellow-500/50 shadow-2xl hover:shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all"
                    >
                        <span className="text-sm font-semibold text-gray-300 group-hover:text-yellow-400 transition-colors">
                            Open Editor
                        </span>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-all">
                            <Settings size={16} />
                        </div>
                    </button>
                </div>
            )}

            {/* Right Sidebar - Video Gen Controls (Only in Director Mode) */}
            {viewMode === 'director' && (
                <VideoGenerationSidebar />
            )}
        </div>
    );
}

