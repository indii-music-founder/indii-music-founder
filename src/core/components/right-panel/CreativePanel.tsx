import React, { useState } from 'react';
import { Image as ImageIcon, Wand2, History, ChevronRight, Zap, ChevronDown, Sliders, Plus, Loader2 } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useToast } from '@/core/context/ToastContext';

interface CreativePanelProps {
    toggleRightPanel: () => void;
}

export default function CreativePanel({ toggleRightPanel }: CreativePanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const [isGenerating, setIsGenerating] = useState(false);
    const {
        prompt, setPrompt,
        studioControls, setStudioControls,
        addToHistory, currentProjectId
    } = useStore();
    const toast = useToast();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a prompt");
            return;
        }

        setIsGenerating(true);
        try {
            const results = await ImageGeneration.generateImages({
                prompt: prompt,
                count: 1,
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
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                toast.success("Image generated!");
            } else {
                toast.error("Generation returned no images. Please try again.");
            }
        } catch (e) {
            console.error("Generation failed:", e);
            toast.error("Generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleEnhance = async () => {
        if (!prompt.trim()) return;

        toast.info("Enhancing prompt...");
        try {
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: {
                    role: 'user',
                    parts: [{ text: `Enhance this image generation prompt to be more descriptive, artistic, and detailed. Keep it under 50 words. Return ONLY the enhanced prompt. Prompt: "${prompt}"` }]
                },
                config: AI_CONFIG.THINKING.LOW
            });

            const enhancedPrompt = response.text();
            if (enhancedPrompt) {
                setPrompt(enhancedPrompt.trim());
                toast.success("Prompt enhanced!");
            } else {
                toast.error("Failed to enhance prompt");
            }
        } catch (e) {
            console.error("Enhance failed:", e);
            toast.error("Enhance failed");
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0d1117] to-[#0d1117]/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <ImageIcon size={14} className="text-purple-400" />
                    </div>
                    Image Studio
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
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">POSITIVE PROMPT</label>
                            <button
                                onClick={handleEnhance}
                                className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                            >
                                <Zap size={10} /> Enhance
                            </button>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all h-28 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Describe your imagination..."
                        />
                    </div>

                    {/* Negative Prompt */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                        <textarea
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Blurry, low quality, distorted..."
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
                    </div>

                    {/* Advanced Settings Toggle */}
                    <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all border border-transparent hover:border-white/5">
                        <span className="flex items-center gap-2"><Sliders size={12} /> Advanced Settings</span>
                        <ChevronDown size={12} />
                    </button>
                </div>
            )}

            {/* Action Buttons - Only show in create mode */}
            {activeTab === 'create' && (
                <div className="p-4 border-t border-white/10 space-y-3 bg-black/20 backdrop-blur-md">
                    <div className="flex gap-2">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 group border border-purple-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />}
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                        >
                            <Plus size={18} />
                        </motion.button>
                    </div>
                    <p className="text-[10px] text-center text-gray-600 font-mono">Est. Cost: 2 Credits • Est. Time: 4.2s</p>
                </div>
            )}
        </div>
    );
}
