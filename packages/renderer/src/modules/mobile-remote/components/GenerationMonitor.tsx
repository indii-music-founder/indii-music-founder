/**
 * GenerationMonitor — Remote image generation from phone.
 *
 * Two modes:
 * 1. Quick Generate — Type a prompt, send it through the Firestore relay
 *    as a 'generate_image' command. The desktop runs ImageGenerationService
 *    and relays the resulting Firebase Storage URL back.
 * 2. Monitor — Shows the current generation status from creativeControlsSlice
 *    when a generation is running on the desktop.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { 
    Image as ImageIcon, Loader2, Sparkles, Send, Palette, 
    Wand2, LayoutGrid, Check, AlertCircle, RefreshCw,
    Layers, Cpu, Activity
} from 'lucide-react';
import { remoteRelayService, type RemoteResponse } from '@/services/agent/RemoteRelayService';
import type { Unsubscribe } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Aspect Ratio Options ────────────────────────────────────────────────────
const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1', icon: '◻️' },
    { label: '16:9', value: '16:9', icon: '🖥️' },
    { label: '9:16', value: '9:16', icon: '📱' },
    { label: '4:3', value: '4:3', icon: '🖼️' },
];

// ─── Style Presets ───────────────────────────────────────────────────────────
const STYLE_PRESETS = [
    { label: 'Cinematic', prefix: 'Cinematic, dramatic lighting, film grain, ' },
    { label: 'Album Art', prefix: 'Music album cover art, bold typography space, ' },
    { label: 'Streetwear', prefix: 'Luxury streetwear aesthetic, urban, high fashion, ' },
    { label: 'Neon', prefix: 'Neon lights, cyberpunk, vibrant colors, night scene, ' },
    { label: 'Minimal', prefix: 'Minimalist, clean, negative space, elegant, ' },
    { label: 'Vintage', prefix: 'Retro vintage, 35mm film, faded colors, nostalgic, ' },
];

interface GeneratedImage {
    url: string;
    prompt: string;
}

export default function GenerationMonitor() {
    const {
        isGenerating,
        prompt: storePrompt,
        currentModule,
        isAgentProcessing,
    } = useStore(
        useShallow(state => ({
            isGenerating: state.isGenerating,
            prompt: state.prompt,
            currentModule: state.currentModule,
            isAgentProcessing: state.isAgentProcessing,
        }))
    );

    const [inputPrompt, setInputPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isSending, setIsSending] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);
    const activeListenerRef = useRef<Unsubscribe | null>(null);

    const handleStylePreset = useCallback((preset: typeof STYLE_PRESETS[0]) => {
        if (activeStylePreset === preset.label) {
            setInputPrompt(prev => prev.replace(preset.prefix, ''));
            setActiveStylePreset(null);
        } else {
            const cleanPrompt = STYLE_PRESETS.reduce((p, s) => p.replace(s.prefix, ''), inputPrompt);
            setInputPrompt(preset.prefix + cleanPrompt);
            setActiveStylePreset(preset.label);
        }
    }, [activeStylePreset, inputPrompt]);

    const handleGenerate = useCallback(async () => {
        if (!inputPrompt.trim() || isSending) return;

        setIsSending(true);
        setError(null);

        try {
            const commandId = await remoteRelayService.sendCommand(
                `[GENERATE_IMAGE] ${inputPrompt.trim()}`,
                undefined,
                { aspectRatio, type: 'generate_image' } as Record<string, unknown>
            );

            if (!commandId) {
                setError('Cloud Pipeline Failure');
                setIsSending(false);
                return;
            }

            if (activeListenerRef.current) {
                activeListenerRef.current();
                activeListenerRef.current = null;
            }

            const timeout = setTimeout(() => {
                if (activeListenerRef.current) {
                    activeListenerRef.current();
                    activeListenerRef.current = null;
                }
                setIsSending(false);
                setError('Generation timed out. Check desktop studio.');
            }, 90000);

            activeListenerRef.current = remoteRelayService.onResponse(commandId, (response: RemoteResponse) => {
                if (response.isFinal && response.text) {
                    clearTimeout(timeout);
                    if (activeListenerRef.current) {
                        activeListenerRef.current();
                        activeListenerRef.current = null;
                    }
                    setIsSending(false);

                    if (response.imageUrls && response.imageUrls.length > 0) {
                        const newImages = response.imageUrls.map((url: string) => ({
                            url,
                            prompt: inputPrompt.trim(),
                        }));
                        setGeneratedImages(prev => [...newImages, ...prev]);
                        setInputPrompt('');
                        setActiveStylePreset(null);
                    } else if (response.text.startsWith('ERROR:')) {
                        setError(response.text.replace('ERROR: ', ''));
                    } else {
                        setError(response.text);
                    }
                }
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Pipeline Error');
            setIsSending(false);
        }
    }, [inputPrompt, aspectRatio, isSending]);

    useEffect(() => {
        return () => {
            if (activeListenerRef.current) {
                activeListenerRef.current();
                activeListenerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Gallery Section */}
            <AnimatePresence mode="popLayout">
                {generatedImages.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                    >
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e93]">Recent Generates</span>
                            </div>
                            <span className="text-[10px] font-bold text-white/40">{generatedImages.length} items</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {generatedImages.slice(0, 4).map((img, i) => (
                                <motion.div
                                    key={i}
                                    layoutId={`img-${img.url}`}
                                    className="group relative aspect-square rounded-[24px] overflow-hidden border border-white/5 bg-white/[0.02]"
                                >
                                    <img
                                        src={img.url}
                                        alt={img.prompt}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <p className="text-[9px] text-white/90 leading-snug line-clamp-2 font-medium">{img.prompt}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Monitoring */}
            <AnimatePresence>
                {(isGenerating || isSending || (isAgentProcessing && currentModule === 'creative')) && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative overflow-hidden p-5 rounded-[32px] bg-white/[0.03] border border-blue-500/20 shadow-[0_20px_40px_-12px_rgba(59,130,246,0.1)]"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 relative">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                    className="absolute inset-0 rounded-2xl border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent"
                                />
                                <Sparkles className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-bold text-white tracking-tight">
                                        {isSending ? 'Studio Generating…' : isGenerating ? 'Rendering Artifact…' : 'Agent Brainstorming…'}
                                    </h4>
                                    <Activity className="w-3 h-3 text-blue-400 animate-pulse" />
                                </div>
                                <p className="text-[10px] text-[#8e8e93] font-medium uppercase tracking-widest truncate">
                                    {isSending ? inputPrompt : (storePrompt || 'Processing Creative Directive')}
                                </p>
                                
                                <div className="mt-4 space-y-1.5">
                                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: '100%' }}
                                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-bold text-white/20 uppercase tracking-widest">
                                        <span>Allocating GPU</span>
                                        <span>4K Upscaling</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {!isGenerating && !isSending && !isAgentProcessing && generatedImages.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center flex-1"
                >
                    <div className="w-20 h-20 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 relative">
                        <motion.div 
                            animate={{ rotate: [0, 90, 0], scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 6 }}
                            className="absolute inset-0 bg-blue-500/5 rounded-[32px] blur-xl"
                        />
                        <Wand2 className="w-8 h-8 text-white/10" />
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-2">Remote Creative</h3>
                    <p className="text-xs text-[#8e8e93] max-w-[220px] leading-relaxed">
                        Authorize image generation from your palm. Results sync to your studio automatically.
                    </p>
                </motion.div>
            )}

            {/* Error UI */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400"
                    >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input & Presets Section */}
            <div className="mt-auto space-y-4">
                {/* Presets */}
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                        <Palette className="w-4 h-4 text-[#8e8e93]" />
                    </div>
                    <div className="flex gap-2">
                        {STYLE_PRESETS.map(preset => (
                            <motion.button
                                key={preset.label}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleStylePreset(preset)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300 border",
                                    activeStylePreset === preset.label
                                        ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                        : "bg-white/[0.03] text-[#8e8e93] border-white/5 hover:border-white/20"
                                )}
                            >
                                {preset.label}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Aspect Ratio */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                        <ImageIcon className="w-4 h-4 text-[#8e8e93]" />
                    </div>
                    <div className="flex gap-2">
                        {ASPECT_RATIOS.map(ar => (
                            <motion.button
                                key={ar.value}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setAspectRatio(ar.value)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all duration-300 border",
                                    aspectRatio === ar.value
                                        ? "bg-white/[0.08] text-white border-white/20"
                                        : "bg-transparent text-[#636366] border-white/5 hover:border-white/10"
                                )}
                            >
                                {ar.icon} {ar.label}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Prompt Bar */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex items-center gap-3 p-3 rounded-[28px] bg-white/[0.03] border border-white/10 focus-within:border-white/20 transition-all duration-300">
                        <Wand2 className="w-5 h-5 text-blue-400 ml-2" />
                        <input
                            type="text"
                            value={inputPrompt}
                            onChange={e => {
                                setInputPrompt(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleGenerate();
                            }}
                            placeholder="Describe visual concept…"
                            disabled={isSending}
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#636366] outline-none font-medium"
                        />
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleGenerate}
                            disabled={!inputPrompt.trim() || isSending}
                            className={cn(
                                "w-12 h-12 rounded-[20px] flex items-center justify-center transition-all shadow-lg",
                                inputPrompt.trim() && !isSending 
                                    ? "bg-white text-black shadow-white/10" 
                                    : "bg-white/5 text-[#48484a] cursor-not-allowed"
                            )}
                        >
                            {isSending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}
