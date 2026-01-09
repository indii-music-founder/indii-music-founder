import React, { useState } from 'react';
import { Wand2, History, ChevronRight, ChevronDown, Sliders } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { useStore } from '../../store';
import { useToast } from '@/core/context/ToastContext';

interface CreativePanelProps {
    toggleRightPanel: () => void;
}

export default function CreativePanel({ toggleRightPanel }: CreativePanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const {
        studioControls, setStudioControls,
    } = useStore();
    const toast = useToast();



    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0d1117] to-[#0d1117]/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Sliders size={14} className="text-purple-400" />
                    </div>
                    Studio Controls
                </h3>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Create"
                        >
                            <Wand2 size={14} />
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'history' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="History"
                        >
                            <History size={14} />
                        </button>
                    </div>
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {activeTab === 'history' ? (
                <div className="flex-1 overflow-hidden">
                    <CreativeGallery compact={true} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* Prompt Section */}


                    {/* Negative Prompt */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">CONSTRAINTS</label>
                        <textarea
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Negative prompt: elements to exclude..."
                        />
                    </div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.aspectRatio}
                                    onChange={(e) => setStudioControls({ aspectRatio: e.target.value })}
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="16:9">16:9 Landscape</option>
                                    <option value="1:1">1:1 Square</option>
                                    <option value="9:16">9:16 Portrait</option>
                                    <option value="21:9">21:9 Ultrawide</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">RESOLUTION</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.resolution || '1024x1024'}
                                    onChange={(e) => setStudioControls({ resolution: e.target.value })}
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="1024x1024">1K (Square)</option>
                                    <option value="1280x720">HD (720p)</option>
                                    <option value="1920x1080">FHD (1080p)</option>
                                    <option value="3840x2160">4K (UHD)</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">STYLE PRESET</label>
                            <div className="relative group">
                                <select className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all">
                                    <option>Cinematic</option>
                                    <option>Photorealistic</option>
                                    <option>Anime / Manga</option>
                                    <option>3D Render</option>
                                    <option>Oil Painting</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">SEED</label>
                            <input
                                type="text"
                                pattern="[0-9]*"
                                value={studioControls.seed || ''}
                                onChange={(e) => setStudioControls({ seed: e.target.value })}
                                placeholder="Random"
                                className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>

                    {/* Advanced Settings Toggle */}

                </div>
            )}
        </div>
    );
}
