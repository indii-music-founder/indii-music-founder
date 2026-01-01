import React from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, Layers, Palette, Film, Folder } from 'lucide-react';
import CreativePanel from './right-panel/CreativePanel';
import VideoPanel from './right-panel/VideoPanel';
import { ResourceTree } from '@/components/project/ResourceTree';
import { motion, AnimatePresence } from 'framer-motion';

export default function RightPanel() {
    const { currentModule, setModule, isRightPanelOpen, toggleRightPanel } = useStore();

    // Placeholder content based on module
    const renderContent = () => {
        switch (currentModule) {
            case 'creative':
                return <CreativePanel toggleRightPanel={toggleRightPanel} />;
            case 'video':
                return <VideoPanel toggleRightPanel={toggleRightPanel} />;
            case 'files':
                return (
                    <div className="h-full flex flex-col bg-[#0d1117] relative">
                        <div className="absolute top-2 right-2 z-10">
                            <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <ResourceTree className="flex-1 p-2" />
                    </div>
                );
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

    const handleToolClick = (module: 'creative' | 'video' | 'files') => {
        setModule(module);
    };

    return (
        <motion.div
            initial={false}
            animate={{ width: isRightPanelOpen ? 320 : 48 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full border-l border-white/10 bg-[#0d1117]/80 backdrop-blur-xl flex-shrink-0 hidden lg:flex flex-col overflow-hidden z-20 shadow-2xl"
        >
            <AnimatePresence mode="wait">
                {!isRightPanelOpen ? (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col items-center py-4 gap-4"
                    >
                        <button
                            onClick={toggleRightPanel}
                            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors mb-4"
                            title="Expand Panel"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex flex-col gap-4 w-full px-2">
                            <button
                                onClick={() => handleToolClick('creative')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'creative' ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Image Studio"
                            >
                                <Palette size={20} />
                                {currentModule === 'creative' && <div className="absolute inset-0 rounded-xl bg-purple-500/10 blur-sm" />}
                            </button>

                            <button
                                onClick={() => handleToolClick('video')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'video' ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Video Studio"
                            >
                                <Film size={20} />
                                {currentModule === 'video' && <div className="absolute inset-0 rounded-xl bg-blue-500/10 blur-sm" />}
                            </button>

                            <button
                                onClick={() => handleToolClick('files')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'files' ? 'bg-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Project Files"
                            >
                                <Folder size={20} />
                                {currentModule === 'files' && <div className="absolute inset-0 rounded-xl bg-green-500/10 blur-sm" />}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-hidden relative"
                    >
                        {renderContent()}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
