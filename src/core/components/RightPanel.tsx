import React, { useState } from 'react';
import { useStore } from '../store';
import {
    X, Settings, Image as ImageIcon, Video, Clock, Move,
    Layers, Film, Wand2, History, ChevronDown, Plus,
    Sliders, Camera, Zap
} from 'lucide-react';
import CreativeGallery from '../../modules/creative/components/CreativeGallery';

export default function RightPanel() {
    const { currentModule } = useStore();
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'

    // Placeholder content based on module
    const renderContent = () => {
        switch (currentModule) {
            case 'creative':
                return (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <ImageIcon size={16} className="text-purple-400" />
                                Image Studio
                            </h3>
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
            case 'video':
                return (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Film size={16} className="text-blue-400" />
                                Video Studio
                            </h3>
                            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('create')}
                                    className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Sequencer"
                                >
                                    <Sliders size={14} />
                                </button>
                                <button
                                    onClick={() => setActiveTab('assets')}
                                    className={`p-1.5 rounded-md transition-all ${activeTab === 'assets' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Assets"
                                >
                                    <ImageIcon size={14} />
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
                                        <label className="text-xs font-medium text-gray-400">SHOT LIST</label>
                                        <span className="text-[10px] text-gray-600">00:00 / 00:15</span>
                                    </div>

                                    <div className="space-y-2">
                                        {[1, 2].map((shot) => (
                                            <div key={shot} className="group relative bg-black/20 rounded-lg border border-white/10 p-2 flex gap-3 hover:border-blue-500/30 transition-colors cursor-pointer">
                                                <div className="w-16 h-16 bg-white/5 rounded flex items-center justify-center flex-shrink-0">
                                                    <Video size={16} className="text-gray-600" />
                                                </div>
                                                <div className="flex-1 min-w-0 py-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs font-medium text-gray-300">Shot {shot}</span>
                                                        <span className="text-[10px] font-mono text-gray-600">4.0s</span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 truncate">Cinematic drone shot over mountains...</p>
                                                </div>
                                                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-1 hover:bg-white/10 rounded"><Settings size={10} className="text-gray-400" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="w-full py-3 border border-dashed border-white/10 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 transition-all flex items-center justify-center gap-2">
                                            <Plus size={12} /> Add New Shot
                                        </button>
                                    </div>
                                </div>

                                {/* Motion Controls */}
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                                        <Move size={12} /> CAMERA MOVEMENT
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Zoom In', 'Pan Left', 'Tilt Up'].map((move) => (
                                            <button key={move} className="px-2 py-2 bg-white/5 hover:bg-white/10 rounded text-[10px] text-gray-300 border border-white/5 hover:border-white/20 transition-all">
                                                {move}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Sliders */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-medium text-gray-400">MOTION STRENGTH</label>
                                            <span className="text-[10px] text-gray-500">0.7</span>
                                        </div>
                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full w-[70%] bg-blue-500 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-medium text-gray-400">FPS</label>
                                            <span className="text-[10px] text-gray-500">24</span>
                                        </div>
                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full w-[40%] bg-blue-500 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Render Button */}
                                <div className="pt-4 border-t border-white/5">
                                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
                                        <Film size={16} />
                                        Render Sequence
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            default:
                return (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                            <Layers size={24} className="text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-gray-300">No Tool Selected</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Select a tool from the sidebar to view its controls and settings.</p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-80 h-full border-l border-white/5 bg-[#0d1117] flex-shrink-0 hidden lg:block">
            {renderContent()}
        </div>
    );
}
