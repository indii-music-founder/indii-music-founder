import React, { useState } from 'react';
import { Image as ImageIcon, Wand2, History, ChevronRight, Zap, ChevronDown, Sliders, Plus } from 'lucide-react';
import { useStore } from '../../store';

interface CreativePanelProps {
    toggleRightPanel: () => void;
}

export default function CreativePanel({ toggleRightPanel }: CreativePanelProps) {
    const [activeTab, setActiveTab] = useState('create');

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ImageIcon size={16} className="text-purple-400" />
                    Image Studio
                </h3>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Wand2 size={14} />
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'history' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <History size={14} />
                        </button>
                    </div>
                    <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* Prompt Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-gray-400">POSITIVE PROMPT</label>
                        <button className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                            <Zap size={10} /> Enhance
                        </button>
                    </div>
                    <textarea
                        className="w-full bg-black/20 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 transition-colors h-28 resize-none placeholder:text-gray-600"
                        placeholder="Describe your imagination..."
                    />
                </div>

                {/* Negative Prompt */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-gray-400">NEGATIVE PROMPT</label>
                    <textarea
                        className="w-full bg-black/20 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 transition-colors h-20 resize-none placeholder:text-gray-600"
                        placeholder="Blurry, low quality, distorted..."
                    />
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">ASPECT RATIO</label>
                        <div className="relative">
                            <select className="w-full bg-black/20 text-white text-xs p-2.5 rounded-lg border border-white/10 outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors">
                                <option>16:9 Landscape</option>
                                <option>1:1 Square</option>
                                <option>9:16 Portrait</option>
                                <option>21:9 Ultrawide</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400">STYLE PRESET</label>
                        <div className="relative">
                            <select className="w-full bg-black/20 text-white text-xs p-2.5 rounded-lg border border-white/10 outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors">
                                <option>Cinematic</option>
                                <option>Photorealistic</option>
                                <option>Anime / Manga</option>
                                <option>3D Render</option>
                                <option>Oil Painting</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-white/10 transition-colors">
                    <span className="flex items-center gap-2"><Sliders size={12} /> Advanced Settings</span>
                    <ChevronDown size={12} />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-white/5 space-y-3 bg-[#0d1117]">
                <div className="flex gap-2">
                    <button className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 group">
                        <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                        Generate
                    </button>
                    <button className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors">
                        <Plus size={18} />
                    </button>
                </div>
                <p className="text-[10px] text-center text-gray-600">Cost: 2 Credits • Est. Time: 4.2s</p>
            </div>
        </div>
    );
}
