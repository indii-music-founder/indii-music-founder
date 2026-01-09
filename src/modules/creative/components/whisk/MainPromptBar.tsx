import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Send, Sparkles, Wand2, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { useToast } from '@/core/context/ToastContext';

export default function MainPromptBar() {
    const { prompt, setPrompt, whiskState, setPendingPrompt } = useStore();
    const [isFocused, setIsFocused] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const toast = useToast();

    const handleEnhance = async () => {
        if (!prompt.trim()) return;

        setIsEnhancing(true);
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
            toast.error("Enhance failed");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGenerate = () => {
        if (!prompt.trim()) return;
        setPendingPrompt(prompt);
    };

    const activeCount =
        whiskState.subjects.filter(i => i.checked).length +
        whiskState.scenes.filter(i => i.checked).length +
        whiskState.styles.filter(i => i.checked).length;

    return (
        <div className="p-4 bg-[#0f0f0f] border-t border-gray-800">
            <div className="max-w-4xl mx-auto relative">
                <div className={`relative flex items-center bg-[#1a1a1a] border rounded-2xl transition-all ${isFocused ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'border-gray-800'
                    }`}>
                    <div className="pl-4 flex items-center gap-2">
                        {activeCount > 0 ? (
                            <div className="flex items-center gap-1 bg-purple-900/40 border border-purple-500/30 px-2 py-0.5 rounded-full">
                                <Sparkles size={10} className="text-purple-400" />
                                <span className="text-[10px] font-bold text-purple-300">{activeCount} Locked</span>
                            </div>
                        ) : (
                            <Wand2 size={16} className="text-gray-500" />
                        )}
                    </div>

                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        placeholder="Describe the action or context..."
                        className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-sm text-white placeholder-gray-600"
                    />

                    <div className="pr-4 flex items-center gap-2">
                        {prompt.trim() && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={handleEnhance}
                                disabled={isEnhancing}
                                className="text-purple-400 hover:text-purple-300 p-2 rounded-lg hover:bg-purple-500/10 transition-colors"
                                title="Enhance with AI"
                            >
                                {isEnhancing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            </motion.button>
                        )}
                        <button
                            onClick={handleGenerate}
                            disabled={!prompt.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Send size={14} />
                            Generate
                        </button>
                    </div>
                </div>

                <p className="mt-3 text-[10px] text-gray-500 text-center font-medium">
                    Try <span className="text-gray-400">"fighting in space"</span> or <span className="text-gray-400">"eating a burger in the rain"</span>
                </p>
            </div>
        </div>
    );
}
