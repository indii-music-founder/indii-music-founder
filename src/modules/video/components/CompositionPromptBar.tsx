import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Film, Download, ArrowLeft } from 'lucide-react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { videoCompositionService } from '@/services/video/VideoCompositionService';
import { renderService } from '@/services/video/RenderService';
import { useToast } from '@/core/context/ToastContext';

interface CompositionPromptBarProps {
    onBack: () => void;
}

export const CompositionPromptBar: React.FC<CompositionPromptBarProps> = ({ onBack }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const { setAIComposition, aiComposition, setViewMode } = useVideoEditorStore();
    const toast = useToast();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        try {
            const result = await videoCompositionService.generateComposition(prompt);
            setAIComposition(result);
            toast.success('Composition generated!');
        } catch (error: any) {
            console.error('Generation failed:', error);
            toast.error(`Generation failed: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleKeydown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    const handleExport = async () => {
        if (!aiComposition) return;

        setIsRendering(true);
        try {
            const outputPath = await renderService.renderComposition({
                compositionId: 'AIComposition', // Must match ID in Root.tsx
                inputProps: {
                    composition: aiComposition,
                    prompt: prompt
                }
            });
            toast.success(`Video exported to: ${outputPath}`);

            // Optionally open folder
            if (window.electronAPI?.video?.openFolder) {
                window.electronAPI.video.openFolder(outputPath);
            }

        } catch (error: any) {
            console.error('Render failed:', error);
            toast.error(`Export failed: ${error.message}`);
        } finally {
            setIsRendering(false);
        }
    };

    return (
        <div className="absolute top-0 left-0 right-0 z-50 p-4">
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="max-w-4xl mx-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 flex gap-2"
            >
                <button
                    onClick={onBack}
                    className="p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeydown}
                        placeholder="Describe your video composition..."
                        className="w-full h-full bg-transparent text-white px-4 py-2 focus:outline-none placeholder-white/30"
                        disabled={isGenerating || isRendering}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isGenerating || isRendering}
                        className={`
                            px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all
                            ${!prompt.trim() || isGenerating
                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'}
                        `}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Dreaming...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={18} />
                                <span>Generate</span>
                            </>
                        )}
                    </button>

                    {aiComposition && (
                        <button
                            onClick={handleExport}
                            disabled={isRendering}
                            className={`
                                px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all
                                ${isRendering
                                    ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed'
                                    : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'}
                            `}
                        >
                            {isRendering ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-emerald-200 border-t-transparent rounded-full animate-spin" />
                                    <span>Rendering...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    <span>Export</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
