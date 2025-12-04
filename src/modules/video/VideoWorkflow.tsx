import React, { useState, useEffect } from 'react';
import { Film, X } from 'lucide-react';
import { useStore } from '../../core/store';
import { useToast } from '../../core/context/ToastContext';
import IdeaStep from './components/IdeaStep';
import ReviewStep from './components/ReviewStep';
import FrameSelectionModal from './components/FrameSelectionModal';
import { VideoEditor } from './editor/VideoEditor';

type WorkflowStep = 'idea' | 'review' | 'generating' | 'result' | 'editor';

export default function VideoWorkflow() {
    const { generatedHistory, selectedItem, pendingPrompt, setPendingPrompt, addToHistory, setPrompt, studioControls, videoInputs, setVideoInput } = useStore();
    const toast = useToast();
    const [step, setStep] = useState<WorkflowStep>('idea');
    const [localPrompt, setLocalPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTarget, setModalTarget] = useState<'firstFrame' | 'lastFrame'>('firstFrame');

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

    const handleGenerate = async () => {
        setIsGenerating(true);
        setStep('generating');
        toast.info('Directing scene...');
        try {
            // Use the client-side VideoGeneration service to respect studio controls
            const { VideoGeneration } = await import('@/services/image/VideoGenerationService');

            const results = await VideoGeneration.generateVideo({
                prompt: localPrompt,
                resolution: studioControls.resolution,
                aspectRatio: studioControls.aspectRatio,
                negativePrompt: studioControls.negativePrompt,
                seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                firstFrame: videoInputs.firstFrame?.url,
                lastFrame: videoInputs.lastFrame?.url,
                timeOffset: videoInputs.timeOffset
            });

            if (results.length > 0) {
                const newAsset = {
                    ...results[0],
                    type: 'video' as const,
                    timestamp: Date.now(),
                    projectId: 'default'
                };

                // If it's a storyboard preview (image), set type to image
                if (newAsset.url.startsWith('data:image') || !newAsset.url.endsWith('.mp4')) {
                    if (newAsset.url.startsWith('data:image')) {
                        // @ts-ignore
                        newAsset.type = 'image';
                    }
                }

                addToHistory(newAsset);
                toast.success('Scene generated!');
                setStep('result');
            } else {
                throw new Error('No video generated');
            }

        } catch (error: any) {
            console.error("Video generation failed:", error);
            toast.error(`Generation failed: ${error.message}`);
            setStep('review'); // Go back to review on failure
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDesignFrame = (type: 'start' | 'end') => {
        setModalTarget(type === 'start' ? 'firstFrame' : 'lastFrame');
        setIsModalOpen(true);
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
                <div className="max-w-2xl mx-auto pt-20">
                    <IdeaStep
                        initialPrompt={localPrompt}
                        onPromptChange={setLocalPrompt}
                        onNext={() => setStep('review')}
                        isThinking={false}
                    />
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
                        isGenerating={isGenerating}
                        startFrameData={videoInputs.firstFrame?.url || null}
                        endFrameData={videoInputs.lastFrame?.url || null}
                        onDesignFrame={handleDesignFrame}
                        onClearFrame={handleClearFrame}
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
            return <VideoEditor initialVideo={activeVideo} />;
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

            <FrameSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={(image) => setVideoInput(modalTarget, image)}
                target={modalTarget}
            />
        </div>
    );
}
