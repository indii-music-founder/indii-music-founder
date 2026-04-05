import React, { useState, useCallback } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { Loader2, Image as ImageIcon, Video, Send, Settings2, Download } from 'lucide-react';
import { WhiskService } from '@/services/WhiskService';
import { logger } from '@/utils/logger';

interface GeneratedItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    prompt: string;
    timestamp: number;
}

export default function DirectGenerationTab() {
    const {
        studioControls,
        setPrompt,
        addToHistory,
        currentProjectId,
        whiskState,
        setSelectedItem
    } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        setPrompt: state.setPrompt,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        whiskState: state.whiskState,
        setSelectedItem: state.setSelectedItem
    })));
    const toast = useToast();

    // Local state for direct mode isolation
    const [localPrompt, setLocalPrompt] = useState('');
    const [mode, setMode] = useState<'image' | 'video'>('image');
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<GeneratedItem[]>([]);

    const handleGenerate = useCallback(async () => {
        if (!localPrompt.trim()) return;

        setIsGenerating(true);
        setPrompt(localPrompt); // Sync to global for history/logging

        try {
            if (mode === 'image') {
                // Synthesize prompt with Whisk (optional, but good for consistency)
                const finalPrompt = WhiskService.synthesizeWhiskPrompt(localPrompt, whiskState);

                // Direct mode: Bypasses Firebase Functions entirely. Calls Gemini 3 Image directly via SDK.
                const { generateImageDirectly } = await import('@/services/ai/generators/DirectImageGenerator');
                const { AI_MODELS } = await import('@/core/config/ai-models');

                // Map studio model to Direct models
                const resolvedModel = studioControls.model === 'pro'
                    ? AI_MODELS.IMAGE.DIRECT_PRO
                    : AI_MODELS.IMAGE.DIRECT_FAST;

                const generatedUrls = await generateImageDirectly({
                    prompt: finalPrompt,
                    aspectRatio: studioControls.aspectRatio,
                    model: resolvedModel,
                    numberOfImages: 1
                });

                if (generatedUrls.length > 0) {
                    const newItems = generatedUrls.map(url => ({
                        id: crypto.randomUUID(),
                        url: url, // Directly returns the data URI
                        type: 'image' as const,
                        prompt: localPrompt,
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'generated' as const
                    }));
                    setResults(prev => [...newItems, ...prev]);
                    newItems.forEach(item => addToHistory({ ...item }));

                    // Open the FIRST generated image in CreativeCanvas for editing
                    setSelectedItem(newItems[0] as HistoryItem);

                    toast.success('Image generated directly successfully');
                }
            } else {
                // Direct Video Generation
                const finalPrompt = WhiskService.synthesizeVideoPrompt(localPrompt, whiskState);

                const generated = await VideoGeneration.generateVideo({
                    prompt: finalPrompt,
                    resolution: studioControls.resolution,
                    aspectRatio: studioControls.aspectRatio,
                    duration: Math.max(6, studioControls.duration || 6), // Veo API requires >= 6
                    durationSeconds: Math.max(6, studioControls.duration || 6),
                    model: studioControls.model, // Will be resolved by FirebaseAIService
                    fps: 24,
                    orgId: 'personal' // Force personal for direct test
                });

                if (generated && generated.length > 0) {
                    // For video, we might get a URL immediately or a job ID.
                    // VideoGenerationService returns standardized results now.
                    const newItems = generated.map(g => ({
                        id: g.id || crypto.randomUUID(),
                        url: g.url || '', // Might be empty if queued
                        type: 'video' as const,
                        prompt: localPrompt,
                        timestamp: Date.now()
                    }));

                    // If queued, we won't see it immediately here unless we listen.
                    // For DIRECT mode, we accept that 'Queued' state might need refresh, 
                    // or better, we just show the "Job Started" toast.
                    if (newItems.every(i => !i.url)) {
                        toast.info('Video job queued. Check gallery for results.');
                    } else {
                        setResults(prev => [...newItems, ...prev]);
                        newItems.forEach(item => addToHistory({ ...item, projectId: currentProjectId }));
                        toast.success('Video generated successfully');
                    }
                }
            }
        } catch (error: unknown) {
            logger.error("Direct Generation Failed:", error);

            const errObj = error as Record<string, unknown> | null;
            const errMessage = error instanceof Error ? error.message : '';

            // Provide specific error messages based on error type
            if (errObj?.code === 'deadline-exceeded' || errMessage?.includes('timeout')) {
                toast.error('Generation timed out. The API may be busy - please try again.');
            } else if (errObj?.code === 'resource-exhausted') {
                toast.error(errMessage || 'Quota exceeded. Please upgrade your plan.');
            } else if (errObj?.code === 'internal' && errMessage?.includes('No image data')) {
                toast.error('No image was generated. Try rephrasing your prompt.');
            } else {
                toast.error(`Generation failed: ${errMessage || 'Unknown error'}`);
            }
        } finally {
            setIsGenerating(false);
        }
    }, [localPrompt, mode, studioControls, whiskState, addToHistory, currentProjectId, toast, setPrompt, setSelectedItem]);

    return (
        <div className="flex flex-col h-full w-full bg-background text-foreground">
            {/* Top Bar: Prompt & Controls */}
            <div className="flex-none p-4 border-b border-white/10 bg-background/50 backdrop-blur-md flex flex-col gap-4">
                <div className="flex items-center gap-4 justify-center max-w-4xl mx-auto w-full">
                    {/* Mode Switch */}
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/5 shrink-0">
                        <button
                            onClick={() => setMode('image')}
                            data-testid="direct-image-mode-btn"
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${mode === 'image' ? 'bg-dept-creative/20 text-dept-creative' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <ImageIcon size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Image</span>
                        </button>
                        <button
                            onClick={() => setMode('video')}
                            data-testid="direct-video-mode-btn"
                            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${mode === 'video' ? 'bg-dept-creative/20 text-dept-creative' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Video size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Video</span>
                        </button>
                    </div>

                    {/* Prompt Input */}
                    <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-dept-creative/10 to-dept-marketing/10 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <input
                            type="text"
                            value={localPrompt}
                            onChange={(e) => setLocalPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
                            placeholder={`Describe your ${mode}...`}
                            data-testid="direct-prompt-input"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-12 text-sm focus:outline-none focus:border-dept-creative/50 focus:ring-1 focus:ring-dept-creative/20 transition-all relative z-10"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-20">
                            {mode === 'image' ? <ImageIcon size={16} /> : <Video size={16} />}
                        </div>

                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
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
                        </div>
                    </div>
                </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
                        {results.map((item) => (
                            <div key={item.id} className="group relative aspect-square bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all">
                                {item.type === 'video' ? (
                                    item.url ? (
                                        <video src={item.url} className="w-full h-full object-cover" controls loop muted />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#111] text-gray-500">
                                            <Loader2 size={24} className="animate-spin mb-2" />
                                            <span className="text-xs">Processing...</span>
                                        </div>
                                    )
                                ) : (
                                    <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                    <p className="text-white text-xs line-clamp-2 mb-2">{item.prompt}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] uppercase font-bold text-gray-400">{item.type}</span>
                                        <button aria-label="Download image" className="text-gray-400 hover:text-white transition-colors">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
