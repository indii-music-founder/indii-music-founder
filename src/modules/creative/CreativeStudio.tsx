import React, { useEffect, lazy, Suspense } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import CreativeGallery from './components/CreativeGallery';
import CreativeNavbar from './components/CreativeNavbar';
import InfiniteCanvas from './components/InfiniteCanvas';
import AILab from './components/AILab';
import VideoWorkflow from '../video/VideoWorkflow';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';

import { WhiskService } from '@/services/WhiskService';
import { QuotaExceededError } from '@/shared/types/errors';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import DirectGenerationTab from './components/DirectGenerationTab';
import { logger } from '@/utils/logger';


// Lazy load CreativePanel for mobile controls tab
const CreativePanel = lazy(() => import('@/core/components/right-panel/CreativePanel'));

export default function CreativeStudio({ initialMode }: { initialMode?: 'image' | 'video' }) {
    const {
        viewMode, setViewMode,
        selectedItem, setSelectedItem,
        generationMode, setGenerationMode,
        pendingPrompt, setPendingPrompt,
        prompt, setPrompt,
        isGenerating,
        studioControls,
        addToHistory, currentProjectId,
        userProfile, whiskState
    } = useStore(useShallow(state => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        selectedItem: state.selectedItem,
        setSelectedItem: state.setSelectedItem,
        generationMode: state.generationMode,
        setGenerationMode: state.setGenerationMode,
        pendingPrompt: state.pendingPrompt,
        setPendingPrompt: state.setPendingPrompt,
        prompt: state.prompt,
        setPrompt: state.setPrompt,
        isGenerating: state.isGenerating,
        studioControls: state.studioControls,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        userProfile: state.userProfile,
        whiskState: state.whiskState
    })));
    const toast = useToast();
    const [activeMobileTab, setActiveMobileTab] = React.useState<'controls' | 'studio'>('studio');

    const isDirty = React.useMemo(() => (prompt && prompt.length > 0) || isGenerating, [prompt, isGenerating]);
    useUnsavedChanges(isDirty);

    useEffect(() => {
        if (initialMode) {
            setGenerationMode(initialMode);
        }
    }, [initialMode, setGenerationMode]);

    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
        if (generationMode === 'video') {
            // Allow navigating to gallery or editor to pick assets even while in video mode
            if (viewMode !== 'gallery' && viewMode !== 'editor' && viewMode !== 'video_production') {
                setViewMode('video_production');
            }
        } else if (viewMode === 'video_production') {
            // If we switched OUT of video mode, go back to gallery (or canvas/showroom)
            setViewMode('gallery');
        }
    }, [generationMode, viewMode, setViewMode]);

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
                        isCoverArt,
                        // Gemini 3 Params
                        model: studioControls.model,
                        thinking: studioControls.thinking,
                        useGrounding: studioControls.useGrounding
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
                } catch (e: unknown) {
                    logger.error("[CreativeStudio] Image generation error:", e);
                    const isQuota = e instanceof Error && (e.name === 'QuotaExceededError' || ('code' in e && (e as { code?: string }).code === 'QUOTA_EXCEEDED'));
                    if (isQuota) {
                        toast.error(e instanceof Error ? e.message : 'Quota exceeded. Please upgrade.');
                    } else {
                        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                        toast.error(`Image generation failed: ${errorMsg}`);
                    }
                } finally {
                    setIsGenerating(false);
                }
            };
            generateImage();
        }
    }, [pendingPrompt, generationMode, whiskState, setPrompt, setPendingPrompt, studioControls, addToHistory, currentProjectId, userProfile, toast]);

    return (
        <ModuleErrorBoundary moduleName="Creative Director">
            <div className="flex flex-col h-full w-full bg-background selection:bg-dept-creative/30">
                <CreativeNavbar data-testid="creative-navbar" />

                {/* Mobile Tab Switcher */}
                <div className="md:hidden flex border-b border-white/10 bg-background flex-shrink-0">
                    <button
                        onClick={() => setActiveMobileTab('controls')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'controls' ? 'text-dept-creative border-b-2 border-dept-creative bg-white/5' : 'text-muted-foreground'}`}
                        data-testid="mobile-tab-controls"
                    >
                        Controls
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('studio')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'studio' ? 'text-dept-creative border-b-2 border-dept-creative bg-white/5' : 'text-muted-foreground'}`}
                        data-testid="mobile-tab-studio"
                    >
                        Studio
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* Mobile Controls Tab Content */}
                    <div className={`${activeMobileTab === 'controls' ? 'flex' : 'hidden'} md:hidden flex-1 flex-col overflow-y-auto bg-[#0f0f0f]`}>
                        <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading controls...</div>}>
                            <CreativePanel toggleRightPanel={() => setActiveMobileTab('studio')} />
                        </Suspense>
                    </div>

                    {/* Main Workspace - Studio Tab on Mobile, always visible on desktop */}
                    <div className={`${activeMobileTab === 'studio' ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative min-w-0 bg-[#0f0f0f]`}>
                        {viewMode === 'gallery' && <CreativeGallery />}
                        {viewMode === 'canvas' && <InfiniteCanvas />}
                        {viewMode === 'video_production' && <VideoWorkflow />}
                        {viewMode === 'direct' && <DirectGenerationTab />}
                        {viewMode === 'lab' && <AILab />}
                        {viewMode === 'release' && <div className="text-white p-8 text-center">Use the Distribution module for release management.</div>}
                        {viewMode === 'editor' && selectedItem && (
                            <CreativeCanvas
                                item={selectedItem}
                                onClose={() => {
                                    setSelectedItem(null);
                                    setViewMode('gallery');
                                }}
                                onSendToWorkflow={(type, item) => {
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
                </div>

                {/* Main Prompt Bar Removed - Using Global CommandBar */}

                {/* Transitions handled via viewMode === 'editor' above */}
            </div>
        </ModuleErrorBoundary>
    );
}
