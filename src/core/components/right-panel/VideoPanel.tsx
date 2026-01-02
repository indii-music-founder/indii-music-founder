import React, { useState } from 'react';
import { Film, Sliders, Image as ImageIcon, ChevronRight, Video, Settings, Plus, Move, Loader2 } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { motion } from 'framer-motion';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '../../store';
import { useToast } from '@/core/context/ToastContext';

interface VideoPanelProps {
    toggleRightPanel: () => void;
}

export default function VideoPanel({ toggleRightPanel }: VideoPanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const [isGenerating, setIsGenerating] = useState(false);
    // Use local state for video prompt since it might differ from image prompt
    const [videoPrompt, setVideoPrompt] = useState('');
    const { addToHistory, currentProjectId, studioControls, setStudioControls } = useStore();
    const toast = useToast();

    const handleRender = async () => {
        if (!videoPrompt.trim()) {
            toast.error("Please enter a video description");
            return;
        }

        setIsGenerating(true);
        try {
            const results = await VideoGeneration.generateVideo({
                prompt: videoPrompt,
                aspectRatio: studioControls.aspectRatio,
                resolution: studioControls.resolution,
                negativePrompt: studioControls.negativePrompt,
                seed: studioControls.seed ? parseInt(studioControls.seed) : undefined
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'video',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                toast.success("Video generation started!");
            }
        } catch (e) {
            console.error("Video generation failed:", e);
            toast.error("Video generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

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
                    {/* Video Prompt Input (Added) */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">VIDEO DESCRIPTION</label>
                        <textarea
                            value={videoPrompt}
                            onChange={(e) => setVideoPrompt(e.target.value)}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all h-24 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Describe the video you want to generate..."
                        />
                    </div>

                    {/* Negative Prompt */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                        <textarea
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Blurry, shaky, distorted, text, watermark..."
                        />
                    </div>

                    {/* Technical Settings */}
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
                                <ChevronRight size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors rotate-90" />
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
                                <ChevronRight size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors rotate-90" />
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
                                className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>

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
                            onClick={handleRender}
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 border border-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
                            {isGenerating ? 'Rendering...' : 'Render Sequence'}
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
}
