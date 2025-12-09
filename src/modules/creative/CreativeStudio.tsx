import React, { useState, useEffect } from 'react';
import CreativeNavbar from './components/CreativeNavbar';
import CreativeGallery from './components/CreativeGallery';
import InfiniteCanvas from './components/InfiniteCanvas';
import Showroom from './components/Showroom';
import VideoWorkflow from '../video/VideoWorkflow';
import { LayoutGrid, Maximize2, Store, Film } from 'lucide-react';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

export default function CreativeStudio({ initialMode }: { initialMode?: 'image' | 'video' }) {
    const { viewMode, setViewMode, selectedItem, setSelectedItem, generationMode, setGenerationMode, pendingPrompt, setPendingPrompt, setPrompt, studioControls, addToHistory, currentProjectId } = useStore();
    // const { useToast } = require('@/core/context/ToastContext'); // Import locally to avoid top-level circular deps if any
    const toast = useToast();

    useEffect(() => {
        if (initialMode) {
            setGenerationMode(initialMode);
        }
    }, [initialMode]);

    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
        if (generationMode === 'video') {
            setViewMode('video_production');
        } else if (viewMode === 'video_production' && generationMode !== 'video') {
            // If we switched OUT of video mode, go back to gallery (or canvas/showroom)
            // But if we just mounted with initialMode='image', generationMode might be 'image' already.
            setViewMode('gallery');
        }
    }, [generationMode]);

    // Handle Pending Prompt for Image Mode
    useEffect(() => {
        if (pendingPrompt && generationMode === 'image') {
            setPrompt(pendingPrompt);
            setPendingPrompt(null);

            // Trigger Image Generation
            const generateImage = async () => {
                toast.info("Generating image...");
                try {
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                    const results = await ImageGeneration.generateImages({
                        prompt: pendingPrompt,
                        count: 1,
                        resolution: studioControls.resolution,
                        aspectRatio: studioControls.aspectRatio,
                        negativePrompt: studioControls.negativePrompt,
                        seed: studioControls.seed ? parseInt(studioControls.seed) : undefined
                    });

                    if (results.length > 0) {
                        results.forEach(res => {
                            addToHistory({
                                id: res.id,
                                url: res.url,
                                prompt: res.prompt,
                                type: 'image',
                                timestamp: Date.now(),
                                projectId: currentProjectId
                            });
                        });
                        toast.success("Image generated!");
                    } else {
                        toast.error("Generation returned no images. Please try again.");
                    }
                } catch (e) {
                    console.error("Image generation failed:", e);
                    toast.error("Image generation failed.");
                }
            };
            generateImage();
        }
    }, [pendingPrompt, generationMode]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f]">
            <CreativeNavbar />



            <div className="flex-1 flex overflow-hidden relative">
                {/* Main Workspace */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-[#0f0f0f]">
                    {viewMode === 'gallery' && <CreativeGallery />}
                    {viewMode === 'canvas' && <InfiniteCanvas />}
                    {viewMode === 'showroom' && <Showroom />}
                    {viewMode === 'video_production' && <VideoWorkflow />}
                </div>
            </div>

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
    );
}
