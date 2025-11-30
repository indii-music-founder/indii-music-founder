import React, { useState, useEffect } from 'react';
import CreativeNavbar from './components/CreativeNavbar';
import CreativeGallery from './components/CreativeGallery';
import AgentWindow from '../../core/components/AgentWindow';
import InfiniteCanvas from './components/InfiniteCanvas';
import Showroom from './components/Showroom';
import VideoWorkflow from '../video/VideoWorkflow';
import { LayoutGrid, Maximize2, Store, Film } from 'lucide-react';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';

export default function CreativeStudio() {
    const { viewMode, setViewMode, selectedItem, setSelectedItem, generationMode } = useStore();

    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
        if (generationMode === 'video') {
            setViewMode('video_production');
        } else if (viewMode === 'video_production') {
            setViewMode('gallery');
        }
    }, [generationMode]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f]">
            <CreativeNavbar />



            <AgentWindow />
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
                <CreativeCanvas item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
        </div>
    );
}
