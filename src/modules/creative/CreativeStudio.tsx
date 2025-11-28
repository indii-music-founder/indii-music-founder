import React from 'react';
import CreativeNavbar from './components/CreativeNavbar';
import AgentWindow from './components/AgentWindow';
import CreativeHistory from './components/CreativeHistory';
import CreativeGallery from './components/CreativeGallery';

export default function CreativeStudio() {
    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f]">
            <CreativeNavbar />
            <AgentWindow />
            <div className="flex-1 flex overflow-hidden relative">
                {/* Main Workspace */}
                <div className="flex-1 flex flex-col relative min-w-0 bg-[#0f0f0f]">
                    <CreativeGallery />
                </div>

                {/* Right Sidebar (History) */}
                <div className="w-64 bg-[#111] border-l border-gray-800 flex-shrink-0 hidden md:flex flex-col">
                    <div className="p-3 border-b border-gray-800">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">History</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <CreativeHistory />
                    </div>
                </div>
            </div>
        </div>
    );
}
