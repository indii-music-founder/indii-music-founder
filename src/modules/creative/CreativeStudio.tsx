import React, { useEffect, lazy, Suspense } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
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
            // Allow navigating to editor to pick assets even while in video mode
            if (viewMode !== 'editor' && viewMode !== 'video_production') {
                setViewMode('video_production');
            }
        } else if (viewMode === 'video_production') {
            // If we switched OUT of video mode, go back to direct generation
            setViewMode('direct');
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
                const isAndromeda = studioControls.isAndromedaMode;

                setIsGenerating(true);
                toast.info(isAndromeda ? "Deploying Andromeda 15-Variant Pipeline..." : isCoverArt ? "Generating cover art..." : "Generating image...");

                try {
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

                    // Synthesize prompt and get source images for Whisk
                    const finalPrompt = WhiskService.synthesizeWhiskPrompt(pendingPrompt, whiskState);
                    const sourceImages = WhiskService.getSourceImages(whiskState);

                    if (isAndromeda) {
                        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
                        const { adAutomationService } = await import('@/services/marketing/AdAutomationService');

                        // 1. Generate 10 Image Variants
                        const imagePromises = Array(10).fill(0).map((_, i) =>
                            ImageGeneration.generateImages({
                                prompt: `${finalPrompt}, variant iteration ${i + 1}, varied composition`,
                                count: 1,
                                resolution: studioControls.resolution,
                                aspectRatio: studioControls.aspectRatio,
                                negativePrompt: studioControls.negativePrompt,
                                seed: undefined, // Force random seeds for variety
                                sourceImages: sourceImages,
                                model: studioControls.model,
                                thinking: studioControls.thinking,
                                useGrounding: studioControls.useGrounding
                            })
                        );

                        // 2. Generate 5 Video Variants (Veo 3.1)
                        const videoPromises = Array(5).fill(0).map((_, i) =>
                            VideoGeneration.generateVideo({
                                prompt: `${finalPrompt}, cinematic motion variant ${i + 1}`,
                                resolution: studioControls.resolution,
                                aspectRatio: studioControls.aspectRatio,
                                duration: 4,
                                cameraMovement: 'Dynamic',
                                motionStrength: 0.8,
                                model: 'pro'
                            })
                        );

                        const allPromises = [...imagePromises, ...videoPromises];
                        const results = await Promise.allSettled(allPromises);

                        let successCount = 0;
                        const adCreatives: { creativeId: string; postId: string; headline: string; body: string; callToAction: 'LEARN_MORE' | 'SHOP_NOW' | 'LISTEN_NOW' }[] = [];

                        results.forEach((res, index) => {
                            if (res.status === 'fulfilled' && res.value.length > 0) {
                                successCount++;
                                const item = res.value[0]!;
                                const isVideo = index >= 10;

                                addToHistory({
                                    id: item.id,
                                    url: item.url,
                                    prompt: pendingPrompt,
                                    type: isVideo ? 'video' : 'image',
                                    timestamp: Date.now(),
                                    projectId: currentProjectId,
                                    origin: 'generated'
                                });

                                adCreatives.push({
                                    creativeId: item.id,
                                    postId: `post_${Date.now()}_${index}`,
                                    headline: isVideo ? `Experience the Vision ${index + 1}` : `Discover the Magic ${index + 1}`,
                                    body: pendingPrompt.slice(0, 80) + "...",
                                    callToAction: isVideo ? 'LEARN_MORE' : 'SHOP_NOW'
                                });
                            } else if (res.status === 'rejected') {
                                logger.warn(`[Andromeda] Variant ${index + 1} failed:`, res.reason);
                            }
                        });

                        if (successCount > 0) {
                            toast.success(`Andromeda: ${successCount}/15 Variants generated.`);
                            try {
                                await adAutomationService.deployAndromedaPipeline(adCreatives, {
                                    platform: 'meta',
                                    dailyBudget: 10.00,
                                    totalDays: 28,
                                    targetAgeRange: [18, 35],
                                    targetInterests: ['music', 'creativity', 'art']
                                });
                                toast.success("Campaign deployed to Marketing Protocol.");
                            } catch (e) {
                                logger.error("[Andromeda] Failed to deploy marketing pipeline", e);
                                toast.error("Assets generated, but marketing deployment failed.");
                            }
                        } else {
                            toast.error("Andromeda pipeline failed: 0 variants generated.");
                        }

                    } else {
                        // Original Single Generation
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
                        {viewMode === 'direct' && <DirectGenerationTab />}
                        {viewMode === 'canvas' && <InfiniteCanvas />}
                        {viewMode === 'video_production' && <VideoWorkflow />}
                        {viewMode === 'lab' && <AILab />}
                        {viewMode === 'editor' && selectedItem && (
                            <CreativeCanvas
                                item={selectedItem}
                                onClose={() => {
                                    setSelectedItem(null);
                                    setViewMode('direct');
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
