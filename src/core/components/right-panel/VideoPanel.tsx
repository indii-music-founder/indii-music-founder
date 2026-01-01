import React, { useState } from 'react';
import { Film, Sliders, Image as ImageIcon, ChevronRight, Video, Settings, Plus, Move, Loader2, Trash2 } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoGeneration } from '@/services/image/VideoGenerationService';
import { useStore, ShotItem } from '../../store';
import { useToast } from '@/core/context/ToastContext';
import { v4 as uuidv4 } from 'uuid';

interface VideoPanelProps {
    toggleRightPanel: () => void;
}

// Helper Component for Collapsible Sections
const ControlSection = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
            >
                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{title}</span>
                <ChevronRight size={14} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 border-t border-white/5 bg-black/20">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function VideoPanel({ toggleRightPanel }: VideoPanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const [isGenerating, setIsGenerating] = useState(false);
    // Use local state for video prompt since it might differ from image prompt
    const { addToHistory, currentProjectId, studioControls, setStudioControls, prompt, setPrompt } = useStore();
    const toast = useToast();

    const updateControl = (updates: Partial<typeof studioControls>) => {
        setStudioControls({ ...studioControls, ...updates });
    };

    const addShot = () => {
        const newShot: ShotItem = {
            id: uuidv4(),
            title: `Shot ${studioControls.shotList.length + 1}`,
            description: '',
            duration: 4.0,
            cameraMovement: 'Static'
        };
        updateControl({ shotList: [...studioControls.shotList, newShot] });
    };

    const removeShot = (id: string) => {
        updateControl({ shotList: studioControls.shotList.filter(s => s.id !== id) });
    };

    const handleRender = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a video description");
            return;
        }

        setIsGenerating(true);
        try {
            const results = await VideoGeneration.generateVideo({
                prompt: prompt,
                aspectRatio: studioControls.aspectRatio,
                resolution: studioControls.resolution,
                negativePrompt: studioControls.negativePrompt,
                seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                // Pass other controls if service supports them
                fps: studioControls.fps,
                cameraMovement: studioControls.cameraMovement,
                motionStrength: studioControls.motionStrength,
                shotList: studioControls.shotList
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
                    {/* Video Prompt Input */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">VIDEO DESCRIPTION</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all h-24 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Describe the video you want to generate..."
                        />
                    </div>

                    {/* Technical Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.aspectRatio}
                                    onChange={(e) => updateControl({ aspectRatio: e.target.value })}
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
                                    onChange={(e) => updateControl({ resolution: e.target.value })}
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="1024x1024">1K (Square)</option>
                                    <option value="1280x720">HD (720p)</option>
                                    <option value="1920x1080">FHD (1080p)</option>
                                    <option value="4K">4K (UHD)</option>
                                </select>
                                <ChevronRight size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors rotate-90" />
                            </div>
                        </div>
                    </div>

                    {/* Shot List (Collapsible) */}
                    <ControlSection title="SHOT LIST" defaultOpen={true}>
                        <div className="space-y-2">
                            {studioControls.shotList.length > 0 ? (
                                studioControls.shotList.map((shot, index) => (
                                    <motion.div
                                        key={shot.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ scale: 1.01 }}
                                        className="group relative bg-black/40 rounded-xl border border-white/10 p-2 flex gap-3 hover:border-blue-500/30 transition-all cursor-pointer shadow-sm"
                                    >
                                        <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/5">
                                            <div className="text-gray-500 font-black text-xs">S{index + 1}</div>
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-medium text-gray-300 group-hover:text-blue-400 transition-colors">{shot.title}</span>
                                                <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{shot.duration}s</span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 truncate">{shot.cameraMovement || 'Static'}</p>
                                        </div>
                                        <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeShot(shot.id); }}
                                                className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-center gap-2 group hover:bg-white/10 transition-colors cursor-pointer" onClick={addShot}>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus size={14} className="text-gray-400" />
                                    </div>
                                    <span className="text-[10px] text-gray-400">Start a Shot Sequence</span>
                                </div>
                            )}

                            {studioControls.shotList.length > 0 && (
                                <button
                                    onClick={addShot}
                                    className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] text-gray-500 hover:text-gray-300 hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={12} /> Add Another Shot
                                </button>
                            )}
                        </div>
                    </ControlSection>

                    {/* Camera & Motion (Collapsible) */}
                    <ControlSection title="CAMERA & MOTION" defaultOpen={true}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {['Static', 'Zoom In', 'Zoom Out', 'Pan Left', 'Pan Right', 'Tilt Up'].map((move) => (
                                    <button
                                        key={move}
                                        onClick={() => updateControl({ cameraMovement: move })}
                                        className={`px-2 py-2 rounded-lg text-[10px] border transition-all ${studioControls.cameraMovement === move
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                            : 'bg-black/40 text-gray-300 border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {move}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">MOTION STRENGTH</label>
                                        <span className="text-[10px] text-gray-500 font-mono">{studioControls.motionStrength}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={studioControls.motionStrength}
                                        onChange={(e) => updateControl({ motionStrength: parseFloat(e.target.value) })}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">FPS</label>
                                        <span className="text-[10px] text-gray-500 font-mono">{studioControls.fps}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="12"
                                        max="60"
                                        step="12"
                                        value={studioControls.fps}
                                        onChange={(e) => updateControl({ fps: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </ControlSection>

                    {/* Advanced Settings (Collapsible) */}
                    <ControlSection title="ADVANCED SETTINGS" defaultOpen={false}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">SEED</label>
                                <input
                                    type="text"
                                    pattern="[0-9]*"
                                    value={studioControls.seed || ''}
                                    onChange={(e) => updateControl({ seed: e.target.value })}
                                    placeholder="Random"
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                                <textarea
                                    value={studioControls.negativePrompt}
                                    onChange={(e) => updateControl({ negativePrompt: e.target.value })}
                                    className="w-full bg-black/40 text-white text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                                    placeholder="Blurry, shaky, distorted..."
                                />
                            </div>
                        </div>
                    </ControlSection>

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
