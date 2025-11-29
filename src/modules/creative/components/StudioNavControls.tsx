import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Settings2, ChevronDown, Ratio, Monitor, Type, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudioNavControls({ className = "" }: { className?: string }) {
    const { studioControls, setStudioControls } = useStore();
    const [showAdvanced, setShowAdvanced] = useState(false);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Aspect Ratio Dropdown */}
            <div className="relative group">
                <div className="flex items-center gap-1 bg-[#0f0f0f] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 hover:border-gray-500 transition-colors cursor-pointer">
                    <Ratio size={12} className="text-gray-500" />
                    <select
                        value={studioControls.aspectRatio}
                        onChange={(e) => setStudioControls({ aspectRatio: e.target.value })}
                        className="bg-transparent border-none outline-none appearance-none cursor-pointer w-20"
                    >
                        <option value="original">Original</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                        <option value="21:9">21:9</option>
                    </select>
                    <ChevronDown size={10} className="text-gray-500" />
                </div>
            </div>

            {/* Resolution Dropdown */}
            <div className="relative group">
                <div className="flex items-center gap-1 bg-[#0f0f0f] border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 hover:border-gray-500 transition-colors cursor-pointer">
                    <Monitor size={12} className="text-gray-500" />
                    <select
                        value={studioControls.resolution}
                        onChange={(e) => setStudioControls({ resolution: e.target.value })}
                        className="bg-transparent border-none outline-none appearance-none cursor-pointer w-16"
                    >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                    </select>
                    <ChevronDown size={10} className="text-gray-500" />
                </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="relative">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`p-1.5 rounded border transition-colors ${showAdvanced ? 'bg-gray-700 border-gray-600 text-white' : 'bg-[#0f0f0f] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}`}
                    title="Advanced Settings (Negative Prompt, Seed)"
                >
                    <Settings2 size={14} />
                </button>

                <AnimatePresence>
                    {showAdvanced && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-3"
                        >
                            {/* Negative Prompt */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase">
                                    <Type size={10} />
                                    Negative Prompt
                                </div>
                                <input
                                    type="text"
                                    value={studioControls.negativePrompt}
                                    onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                                    placeholder="What to avoid..."
                                    className="bg-[#0f0f0f] border border-gray-700 rounded p-2 text-xs text-gray-300 focus:border-red-500 outline-none placeholder-gray-600 w-full"
                                />
                            </div>

                            {/* Seed */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase">
                                    <Hash size={10} />
                                    Seed
                                </div>
                                <input
                                    type="text"
                                    value={studioControls.seed}
                                    onChange={(e) => setStudioControls({ seed: e.target.value })}
                                    placeholder="Random"
                                    className="bg-[#0f0f0f] border border-gray-700 rounded p-2 text-xs text-gray-300 focus:border-blue-500 outline-none placeholder-gray-600 w-full"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
