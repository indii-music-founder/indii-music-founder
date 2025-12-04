import React, { useState } from 'react';
import { Film, Sliders, Image as ImageIcon, ChevronRight, Video, Settings, Plus, Move } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { motion } from 'framer-motion';

interface VideoPanelProps {
    toggleRightPanel: () => void;
}

export default function VideoPanel({ toggleRightPanel }: VideoPanelProps) {
    const [activeTab, setActiveTab] = useState('create');

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0d1117] to-[#0d1117]/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <Film size={14} className="text-blue-400" />
                    </div>
                    Video Studio
                </h3>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Sequencer"
                        >
                            <Sliders size={14} />
                        </button>
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'assets' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Assets"
                        >
                            <ImageIcon size={14} />
                        </button>
                    </div>
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {activeTab === 'assets' ? (
                <div className="flex-1 overflow-hidden">
                    <CreativeGallery compact={true} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* Shot List */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">SHOT LIST</label>
                            <span className="text-[10px] text-gray-600 font-mono">00:00 / 00:15</span>
                        </div>

                        <div className="space-y-2">
                            {[1, 2].map((shot) => (
                                <motion.div
                                    key={shot}
                                    whileHover={{ scale: 1.01 }}
                                    className="group relative bg-black/40 rounded-xl border border-white/10 p-2 flex gap-3 hover:border-blue-500/30 transition-all cursor-pointer shadow-sm"
                                >
                                    <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/5">
                                        <Video size={16} className="text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium text-gray-300 group-hover:text-blue-400 transition-colors">Shot {shot}</span>
                                            <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">4.0s</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 truncate">Cinematic drone shot over mountains...</p>
                                    </div>
                                    <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1 hover:bg-white/10 rounded"><Settings size={10} className="text-gray-400" /></button>
                                    </div>
                                </motion.div>
                            ))}
                            <button className="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                <Plus size={12} /> Add New Shot
                            </button>
                        </div>
                    </div>

                    {/* Motion Controls */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider flex items-center gap-2">
                            <Move size={12} /> CAMERA MOVEMENT
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Zoom In', 'Pan Left', 'Tilt Up'].map((move) => (
                                <button key={move} className="px-2 py-2 bg-black/40 hover:bg-white/10 rounded-lg text-[10px] text-gray-300 border border-white/10 hover:border-white/20 transition-all">
                                    {move}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">MOTION STRENGTH</label>
                                <span className="text-[10px] text-gray-500 font-mono">0.7</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-[70%] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">FPS</label>
                                <span className="text-[10px] text-gray-500 font-mono">24</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-[40%] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Render Button */}
                    <div className="pt-4 border-t border-white/10">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 border border-blue-400/20"
                        >
                            <Film size={16} />
                            Render Sequence
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
}
