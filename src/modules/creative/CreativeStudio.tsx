import React, { useEffect } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import CreativeGallery from './components/CreativeGallery';
import CreativeNavbar from './components/CreativeNavbar';
import InfiniteCanvas from './components/InfiniteCanvas';
import Showroom from './components/Showroom';
import VideoWorkflow from '../video/VideoWorkflow';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import WhiskSidebar from './components/whisk/WhiskSidebar';
import MainPromptBar from './components/whisk/MainPromptBar';
import { WhiskService } from '@/services/WhiskService';

export default function CreativeStudio({ initialMode }: { initialMode?: 'image' | 'video' }) {
    const {
        viewMode, setViewMode,
        selectedItem, setSelectedItem,
        generationMode, setGenerationMode,
        pendingPrompt, setPendingPrompt,
        setPrompt, studioControls,
        addToHistory, currentProjectId,
        userProfile, whiskState
    } = useStore();
    // const { useToast } = require('@/core/context/ToastContext'); // Import locally to avoid top-level circular deps if any
    const toast = useToast();
    const [activeMobileTab, setActiveMobileTab] = React.useState<'controls' | 'studio'>('studio');

    useEffect(() => {
        if (initialMode) {
            setGenerationMode(initialMode);
        }
    }, [initialMode]);

    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
        if (generationMode === 'video') {
            setViewMode('video_production');
        } else if (viewMode === 'video_production') {
            // If we switched OUT of video mode, go back to gallery (or canvas/showroom)
            // But if we just mounted with initialMode='image', generationMode might be 'image' already.
            setViewMode('gallery');
        }
    }, [generationMode]);

    // Handle Pending Prompt for Image Mode
    useEffect(() => {
        if (pendingPrompt && generationMode === 'image') {
            const { setIsGenerating } = useStore.getState();
            setPrompt(pendingPrompt);
            setPendingPrompt(null);

            // Trigger Image Generation
            const generateImage = async () => {
                const isCoverArt = studioControls.isCoverArtMode;
                setIsGenerating(true);
                toast.info(isCoverArt ? "Generating cover art..." : "Generating image...");

                try {
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

                    // Synthesize prompt and get source images for Whisk
                    const finalPrompt = WhiskService.synthesizeWhiskPrompt(pendingPrompt, whiskState);
                    const sourceImages = WhiskService.getSourceImages(whiskState);

                    const results = await ImageGeneration.generateImages({
                        prompt: finalPrompt,
                        count: 1,
                        resolution: studioControls.resolution,
                        aspectRatio: isCoverArt ? '1:1' : studioControls.aspectRatio,
                        negativePrompt: studioControls.negativePrompt,
                        seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                        sourceImages: sourceImages,
                        // Pass distributor context for cover art mode
                        userProfile: isCoverArt ? userProfile : undefined,
                        isCoverArt
                    });

                    if (results.length > 0) {
                        results.forEach(res => {
                            addToHistory({
                                id: res.id,
                                url: res.url,
                                prompt: pendingPrompt, // Store user's original prompt in history for clarity
                                type: 'image',
                                timestamp: Date.now(),
                                projectId: currentProjectId,
                                origin: 'generated'
                            });
                        });
                        toast.success("Image generated!");
                    } else {
                        toast.error("Generation returned no images. Please try again.");
                    }
                } catch (e) {
                    toast.error("Image generation failed.");
                } finally {
                    setIsGenerating(false);
                }
            };
            generateImage();
        }
    }, [pendingPrompt, generationMode, whiskState]);

    return (
        <ModuleErrorBoundary moduleName="Creative Director">
            <div className="flex flex-col h-full w-full bg-[#0f0f0f]">
                <CreativeNavbar />

                {/* Mobile Tab Switcher */}
                <div className="md:hidden flex border-b border-white/10 bg-[#0f0f0f] flex-shrink-0">
                    <button
                        onClick={() => setActiveMobileTab('controls')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'controls' ? 'text-purple-400 border-b-2 border-purple-400 bg-white/5' : 'text-gray-500'}`}
                    >
                        Controls
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('studio')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'studio' ? 'text-purple-400 border-b-2 border-purple-400 bg-white/5' : 'text-gray-500'}`}
                    >
                        Studio
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* Whisk Sidebar - Controls Tab on Mobile */}
                    <div className={`${activeMobileTab === 'controls' ? 'flex w-full' : 'hidden'} md:flex md:w-auto h-full z-10`}>
                        <WhiskSidebar />
                    </div>

                    {/* Main Workspace - Studio Tab on Mobile */}
                    <div className={`${activeMobileTab === 'studio' ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative min-w-0 bg-[#0f0f0f]`}>
                        {viewMode === 'gallery' && <CreativeGallery />}
                        {viewMode === 'canvas' && <InfiniteCanvas />}
                        {viewMode === 'showroom' && <Showroom />}
                    </div>
                </div>

                {/* Main Prompt Bar at Bottom */}
                <MainPromptBar />

                {/* Global Overlay */}
                {selectedItem && (
                    <CreativeCanvas
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                        onSendToWorkflow={(type, item) => {
                            // type is 'firstFrame' | 'lastFrame'
                            const { setVideoInput, setGenerationMode, setViewMode, setSelectedItem } = useStore.getState();
                            setVideoInput(type, item);
                            setGenerationMode('video');
                            setViewMode('video_production');
                            setSelectedItem(null);
                            toast.success(`Set as ${type === 'firstFrame' ? 'Start' : 'End'} Frame`);
                        }}
                    />
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
