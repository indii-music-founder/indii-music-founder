import React, { useState } from 'react';
import CreativeNavbar from './components/CreativeNavbar';
import CreativeGallery from './components/CreativeGallery';
import AgentWindow from '../../core/components/AgentWindow';
import InfiniteCanvas from './components/InfiniteCanvas';
import Showroom from './components/Showroom';
import { LayoutGrid, Maximize2, Store } from 'lucide-react';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';

export default function CreativeStudio() {
    const { viewMode, setViewMode, selectedItem, setSelectedItem } = useStore();

    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f]">
            <CreativeNavbar />

            {/* View Toggle Bar */}
            <div className="h-10 bg-[#111] border-b border-gray-800 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-gray-700">
                    <button
                        onClick={() => setViewMode('gallery')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'gallery' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Gallery View"
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('canvas')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'canvas' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Infinite Canvas"
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('showroom')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'showroom' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                        title="Product Showroom"
                    >
                        <Store size={14} />
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                    {viewMode === 'gallery' ? 'Asset Gallery' : viewMode === 'canvas' ? 'Infinite Canvas' : 'Product Showroom'}
                </p>
            </div>

            <AgentWindow />
            <div className="flex-1 flex overflow-hidden relative">
                {/* Main Workspace */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-[#0f0f0f]">
                    {viewMode === 'gallery' && <CreativeGallery />}
                    {viewMode === 'canvas' && <InfiniteCanvas />}
                    {viewMode === 'showroom' && <Showroom />}
                </div>
            </div>

            {/* Global Overlay */}
            {selectedItem && (
                <CreativeCanvas item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
        </div>
    );
}
