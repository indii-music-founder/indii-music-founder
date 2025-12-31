import React, { useState, useEffect } from 'react';
import { Film, X } from 'lucide-react';
import { useStore, HistoryItem } from '../../core/store';
import { useToast } from '../../core/context/ToastContext';
import IdeaStep from './components/IdeaStep';
import ReviewStep from './components/ReviewStep';
import FrameSelectionModal from './components/FrameSelectionModal';
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));
import { useVideoEditorStore } from './store/videoEditorStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { VideoGenerationSidebar } from './components/VideoGenerationSidebar';

type WorkflowStep = 'idea' | 'review' | 'generating' | 'result' | 'editor';

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

    // Use local store for job tracking
    const {
        jobId,
        status: jobStatus,
        setJobId,
        setStatus: setJobStatus
    } = useVideoEditorStore();

    const toast = useToast();
    const [step, setStep] = useState<WorkflowStep>('idea');
    const [localPrompt, setLocalPrompt] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTarget, setModalTarget] = useState<'firstFrame' | 'lastFrame' | 'ingredient'>('firstFrame');

    // Find the most recent video or the selected item if it's a video
    const activeVideo = selectedItem?.type === 'video' ? selectedItem : generatedHistory.find(item => item.type === 'video');

    useEffect(() => {
        if (pendingPrompt) {
            setLocalPrompt(pendingPrompt);
            setPrompt(pendingPrompt); // Sync to global prompt state
            setStep('review'); // Skip to review if prompt is provided via command bar
            setPendingPrompt(null);
        }
    }, [pendingPrompt, setPrompt, setPendingPrompt]);

    // Listen for job updates
    useEffect(() => {
        if (!jobId) return;

        // Import Firestore dynamically to avoid SSR issues if any (though this is client side)
        let unsubscribe: () => void;

        const setupListener = async () => {
            try {
                const { doc, onSnapshot } = await import('firebase/firestore');
                // Dynamically import db from our service to ensure app is initialized
                const { db } = await import('@/services/firebase');

                unsubscribe = onSnapshot(doc(db, 'videoJobs', jobId), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        const newStatus = data?.status;

                        if (newStatus && newStatus !== jobStatus) {
                            setJobStatus(newStatus);

                            if (newStatus === 'completed' && data.videoUrl) {
                                const newAsset = {
                                    id: jobId,
                                    url: data.videoUrl,
                                    prompt: data.prompt || localPrompt,
                                    type: 'video' as const,
                                    timestamp: Date.now(),
                                    projectId: 'default',
                                    orgId: currentOrganizationId // Add orgId to history item
                                };
                                addToHistory(newAsset);
                                toast.success('Scene generated!');
                                setStep('result');
                                setJobId(null); // Clear job
                                setJobStatus('idle');
                            } else if (newStatus === 'failed') {
                                toast.error('Generation failed');
                                setJobId(null);
                                setJobStatus('failed');
                                setStep('review');
                            }
                        }
                    }
                }, (error) => {
                    console.error("Job listener error:", error);
                    toast.error("Lost connection to job status.");
                });
            } catch (e) {
                console.error("Failed to setup job listener:", e);
                toast.error("Failed to track job status.");
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [jobId, addToHistory, toast, localPrompt, setJobId, setJobStatus, jobStatus, currentOrganizationId]);

    const handleGenerate = async () => {
        setStep('generating');
        setJobStatus('queued');
        const isInterpolation = videoInputs.firstFrame && videoInputs.lastFrame;
        toast.info(isInterpolation ? 'Queuing interpolation sequence...' : 'Queuing scene generation...');

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
            console.error("Video generation trigger failed:", error);
            toast.error(`Trigger failed: ${error.message}`);
            setStep('review');
            setJobStatus('failed');
        }
    };

    const handleDesignFrame = (type: 'start' | 'end') => {
        setModalTarget(type === 'start' ? 'firstFrame' : 'lastFrame');
        setIsModalOpen(true);
    };

    const handleAddIngredient = () => {
        setModalTarget('ingredient');
        setIsModalOpen(true);
    };

    const handleRemoveIngredient = (index: number) => {
        const newIngredients = [...(videoInputs.ingredients || [])];
        newIngredients.splice(index, 1);
        setVideoInput('ingredients', newIngredients);
    };

    const handleClearFrame = (type: 'start' | 'end') => {
        if (type === 'start') {
            setVideoInput('firstFrame', null);
        } else {
            setVideoInput('lastFrame', null);
        }
    };

    const renderStage = () => {
        if (step === 'idea') {
            return (
                <div className="max-w-2xl mx-auto pt-20 relative">
                    <IdeaStep
                        initialPrompt={localPrompt}
                        onPromptChange={setLocalPrompt}
                        onNext={() => setStep('review')}
                        isThinking={false}
                    />
                    <div className="absolute top-0 right-0 mt-4 mr-4">
                        <button
                            onClick={() => setStep('editor')}
                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <Film size={14} />
                            Open Editor
                        </button>
                    </div>
                </div>
            );
        }

        if (step === 'review') {
            return (
                <div className="max-w-4xl mx-auto pt-10">
                    <ReviewStep
                        finalPrompt={localPrompt}
                        onBack={() => setStep('idea')}
                        onGenerate={handleGenerate}
                        isGenerating={jobStatus === 'queued' || jobStatus === 'processing'}
                        startFrameData={videoInputs.firstFrame?.url || null}
                        endFrameData={videoInputs.lastFrame?.url || null}
                        onDesignFrame={handleDesignFrame}
                        onClearFrame={handleClearFrame}
                        ingredients={videoInputs.ingredients || []}
                        onAddIngredient={handleAddIngredient}
                        onRemoveIngredient={handleRemoveIngredient}
                    />
                </div>
            );
        }

        if (step === 'generating') {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-pulse">
                    <div className="w-24 h-24 bg-neon-purple/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(176,38,255,0.3)]">
                        <Film size={48} className="text-neon-purple animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Generating Scene...</h2>
                    <p className="text-gray-500 max-w-md">
                        AI is rendering your vision. This may take a moment.
                    </p>
                </div>
            );
        }

        if (step === 'result' && activeVideo) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8">
                    <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 relative group">
                        {activeVideo.url.startsWith('data:image') ? (
                            <div className="relative w-full h-full">
                                <img src={activeVideo.url} alt={activeVideo.prompt} className="w-full h-full object-contain" />
                                <div className="absolute top-4 left-4 bg-purple-600/90 text-white px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
                                    Storyboard Preview
                                </div>
                            </div>
                        ) : (
                            <video
                                src={activeVideo.url}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain"
                            />
                        )}
                    </div>
                    <div className="mt-6 text-center flex gap-4 justify-center">
                        <button
                            onClick={() => setStep('idea')}
                            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        >
                            New Scene
                        </button>
                        <button
                            onClick={() => setStep('review')}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                        >
                            Remix / Edit
                        </button>
                        <button
                            onClick={() => setStep('editor')}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Film size={16} />
                            Open in Studio
                        </button>
                    </div>
                </div>
            );
        }

        if (step === 'editor') {
            return (
                <ErrorBoundary fallback={<div className="p-10 text-red-500">Video Editor encountered an error.</div>}>
                    <React.Suspense fallback={<div className="flex items-center justify-center h-full text-purple-500">Loading Studio Engine...</div>}>
                        <VideoEditor initialVideo={activeVideo} />
                    </React.Suspense>
                </ErrorBoundary>
            );
        }

        // Fallback for result state if no active video
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-24 h-24 bg-gray-800/50 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-purple-900/10">
                    <Film size={48} className="text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Direct</h2>
                <button
                    onClick={() => setStep('idea')}
                    className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all"
                >
                    Start New Project
                </button>
                <button
                    onClick={() => setStep('editor')}
                    className="mt-4 ml-4 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
                >
                    Open Studio Editor
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 flex overflow-hidden h-full">
            {/* Stage Area */}
            <div className="flex-1 relative bg-[#0f0f0f] overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                    {renderStage()}
                </div>
            </div>

            {/* Right Sidebar - Video Generation Controls */}
            {step !== 'editor' && (
                <VideoGenerationSidebar />
            )}

            <FrameSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={async (image) => {
                    let imageUrl = image.url;

                    // If selecting a video, extract the relevant frame
                    if (image.type === 'video') {
                        try {
                            const { extractVideoFrame } = await import('../../utils/video');
                            // If target is firstFrame, we want the LAST frame of the video (Extension)
                            // If target is lastFrame, we want the FIRST frame (Bridging) - though usually bridging uses images
                            // If target is ingredient, we probably want a representative frame (e.g. first)

                            const offset = modalTarget === 'firstFrame' ? -1 : 0; // -1 signals last frame in our util (implicitly)
                            imageUrl = await extractVideoFrame(image.url, offset);

                            toast.success("Extracted frame from video for extension");
                        } catch (e) {
                            console.error("Failed to extract frame", e);
                            toast.error("Failed to use video as input");
                            return;
                        }
                    }

                    if (modalTarget === 'ingredient') {
                        // For ingredients, we need to construct a HistoryItem-like object if we extracted a frame
                        // But setVideoInput expects HistoryItem[] or HistoryItem
                        // If we extracted a frame, imageUrl is a data URI. We need to wrap it.
                        const ingredientItem = { ...image, url: imageUrl, type: 'image' as const };
                        setVideoInput('ingredients', [...(videoInputs.ingredients || []), ingredientItem]);
                    } else {
                        // For frames, we also need to wrap it if it was a video
                        const frameItem = { ...image, url: imageUrl, type: 'image' as const };
                        setVideoInput(modalTarget, frameItem);
                    }
                }}
                target={modalTarget}
            />
        </div>
    );
}
