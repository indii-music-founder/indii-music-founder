import React from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, Layers, Palette, Film } from 'lucide-react';
import CreativePanel from './right-panel/CreativePanel';
import VideoPanel from './right-panel/VideoPanel';

export default function RightPanel() {
    const { currentModule, setModule, isRightPanelOpen, toggleRightPanel } = useStore();
    // Removed activeTab state as it's now handled in sub-components

    // Placeholder content based on module
    const renderContent = () => {
        switch (currentModule) {
            case 'creative':
                return <CreativePanel toggleRightPanel={toggleRightPanel} />;
            case 'video':
                return <VideoPanel toggleRightPanel={toggleRightPanel} />;
            default:
                return (
                    <div className="flex flex-col h-full">
                        <div className="p-4 flex justify-end">
                            <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                                <Layers size={24} className="text-gray-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-300">No Tool Selected</h3>
                                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Select a tool from the sidebar to view its controls and settings.</p>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    const handleToolClick = (module: 'creative' | 'video') => {
        setModule(module);
        // setModule now handles opening the panel automatically
    };

    return (
        <div className={`${isRightPanelOpen ? 'w-80' : 'w-12'} h-full border-l border-white/5 bg-[#0d1117] flex-shrink-0 hidden lg:flex flex-col transition-all duration-300`}>
            {!isRightPanelOpen && (
                <div className="flex-1 flex flex-col items-center py-4 gap-4">
                    <button
                        onClick={toggleRightPanel}
                        className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors mb-4"
                        title="Expand Panel"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div className="flex flex-col gap-4 w-full px-2">
                        <button
                            onClick={() => handleToolClick('creative')}
                            className={`p-2 rounded-lg transition-all flex justify-center ${currentModule === 'creative' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            title="Image Studio"
                        >
                            <Palette size={20} />
                        </button>

                        <button
                            onClick={() => handleToolClick('video')}
                            className={`p-2 rounded-lg transition-all flex justify-center ${currentModule === 'video' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            title="Video Studio"
                        >
                            <Film size={20} />
                        </button>
                    </div>
                </div>
            )}

            {isRightPanelOpen && (
                <>
                    <div className="flex-1 overflow-hidden relative">
                        {renderContent()}
                    </div>
                </>
            )}
        </div>
    );
}
