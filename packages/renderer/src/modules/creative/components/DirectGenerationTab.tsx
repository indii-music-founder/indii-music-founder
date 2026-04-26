import React from 'react';
import { Loader2, Image as ImageIcon, Video, Send, Settings2, Download, ChevronDown, ChevronUp, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IngredientDropZone } from './IngredientDropZone';
import { CreativeVideoPlayer } from './CreativeVideoPlayer';
import { VideoPromptBuilder } from './veo/VideoPromptBuilder';
import { VeoSettingsPanel } from './veo/VeoSettingsPanel';
import { useDirectGeneration } from '../hooks/useDirectGeneration';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export default function DirectGenerationTab() {
    const { setGenerationMode, isPromptBuilderOpen, togglePromptBuilder } = useStore(useShallow(state => ({
        setGenerationMode: state.setGenerationMode,
        isPromptBuilderOpen: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder
    })));

    const {
        mode,
        localPrompt,
        setLocalPrompt,
        isGenerating,
        results,
        handleModeSwitch,
        handleGenerate,
        mappedIngredients,
        handleIngredientsChange,
        setSelectedItem,
        setViewMode,
        studioControls
    } = useDirectGeneration();

    const videoClipCount = results.filter(r => r.type === 'video').length;

    return (
        <div className="flex flex-col h-full w-full bg-background text-foreground">
            {/* Top Bar: Prompt & Controls */}
            <div className="flex-none p-4 border-b border-white/10 bg-background/50 backdrop-blur-md flex flex-col gap-4">
                <div className="flex items-center gap-4 justify-center max-w-4xl mx-auto w-full">
                    {/* Mode Switch */}
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 shrink-0 relative">
                        <button
                            onClick={() => handleModeSwitch('image')}
                            data-testid="direct-image-mode-btn"
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${mode === 'image'
                                ? 'bg-gradient-to-r from-dept-creative/30 to-dept-creative/20 text-white shadow-[0_0_12px_rgba(var(--color-dept-creative-rgb),0.3)] border border-dept-creative/40 font-bold'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <ImageIcon size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Image</span>
                        </button>
                        <button
                            onClick={() => handleModeSwitch('video')}
                            data-testid="direct-video-mode-btn"
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${mode === 'video'
                                ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/20 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] border border-purple-500/40 font-bold'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <Video size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Video</span>
                        </button>
                    </div>

                    {/* Prompt Input */}
                    <div className="flex-1 flex flex-col gap-2">
                        <VideoPromptBuilder
                            mode={mode}
                            prompt={localPrompt}
                            onChange={setLocalPrompt}
                            onGenerate={handleGenerate}
                            disabled={isGenerating}
                        >
                            <button
                                onClick={togglePromptBuilder}
                                data-testid="toggle-prompt-builder"
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title={isPromptBuilderOpen ? 'Hide Prompt Builder' : 'Show Prompt Builder'}
                                aria-label={isPromptBuilderOpen ? 'Hide Prompt Builder' : 'Show Prompt Builder'}
                                aria-expanded={isPromptBuilderOpen}
                            >
                                {isPromptBuilderOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono px-2 border-r border-white/5">
                                {studioControls.model.toUpperCase()}
                            </span>
                            <button
                                onClick={handleGenerate}
                                data-testid="direct-generate-btn"
                                disabled={isGenerating || !localPrompt.trim()}
                                className="bg-foreground text-background p-1.5 rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span className="sr-only">Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        <span className="sr-only">Generate</span>
                                    </>
                                )}
                            </button>
                        </VideoPromptBuilder>
                        {mode === 'video' && (
                            <VeoSettingsPanel isOpen={isPromptBuilderOpen} />
                        )}
                    </div>
                </div>

                {mode === 'video' && (
                    <div className="max-w-4xl mx-auto w-full">
                        <IngredientDropZone 
                            ingredients={mappedIngredients} 
                            onChange={handleIngredientsChange} 
                            mode="reference" 
                        />
                    </div>
                )}
            </div>

            {/* Main Content: Results Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {results.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <Settings2 size={32} className="opacity-50" />
                        </div>
                        <p className="text-sm font-medium">Direct Generation Mode</p>
                        <p className="text-xs text-gray-500 max-w-xs text-center">
                            Bypass the agent orchestration layer to directly test API integration and asset generation.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {results.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                                    onClick={() => {
                                        setSelectedItem(item);
                                        setViewMode('editor');
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedItem(item);
                                            setViewMode('editor');
                                        }
                                    }}
                                    data-testid={`direct-result-${item.id}`}
                                >
                                    {item.type === 'video' ? (
                                        <div className="w-full h-full">
                                            <CreativeVideoPlayer 
                                                jobId={item.url ? undefined : item.id} 
                                                url={item.url || undefined} 
                                                autoPlay={false}
                                                className="w-full h-full border-none rounded-none"
                                            />
                                        </div>
                                    ) : (
                                        <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                                    )}

                                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                        <p className="text-white text-xs line-clamp-2 mb-2">{item.prompt}</p>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] uppercase font-bold text-gray-400">{item.type}</span>
                                            <button aria-label="Download asset" className="text-gray-400 hover:text-white transition-colors" onClick={(e) => e.stopPropagation()}>
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            <AnimatePresence>
                {results.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="flex-none border-t border-white/10 bg-background/80 backdrop-blur-xl p-4 flex justify-between items-center px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 relative"
                    >
                        <div>
                            <h3 className="text-sm font-bold text-white">Done generating?</h3>
                            <p className="text-xs text-gray-400">
                                {videoClipCount >= 2 
                                    ? `Take your ${videoClipCount} clips to the producer to mix them into a longer video.` 
                                    : "Edit your generated asset in the studio."}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (videoClipCount >= 2) {
                                    setGenerationMode('video');
                                    setViewMode('video_production');
                                } else {
                                    setSelectedItem(results[0] || null);
                                    setViewMode('editor');
                                }
                            }}
                            className="px-8 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors shadow-lg flex items-center gap-2"
                        >
                            {videoClipCount >= 2 ? (
                                <>
                                    <Film size={18} />
                                    Finish & Produce Video
                                </>
                            ) : (
                                <>
                                    <Settings2 size={18} />
                                    Continue to Editor
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
