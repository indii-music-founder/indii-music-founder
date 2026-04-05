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
import { Image, Loader2, Sparkles, Send, Palette, Wand2, LayoutGrid } from 'lucide-react';
import { remoteRelayService, type RemoteResponse } from '@/services/agent/RemoteRelayService';
import type { Unsubscribe } from 'firebase/firestore';

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
            // Toggle off — remove prefix
            setInputPrompt(prev => prev.replace(preset.prefix, ''));
            setActiveStylePreset(null);
        } else {
            // Toggle on — add prefix
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
            // Send as a special generate_image command through the relay
            const commandId = await remoteRelayService.sendCommand(
                `[GENERATE_IMAGE] ${inputPrompt.trim()}`,
                undefined, // no specific agent — will be handled by relay
                { aspectRatio, type: 'generate_image' } as Record<string, unknown>
            );

            if (!commandId) {
                setError('Failed to send command');
                setIsSending(false);
                return;
            }

            // Clean up previous listener if any
            if (activeListenerRef.current) {
                activeListenerRef.current();
                activeListenerRef.current = null;
            }

            // Listen for the response
            const timeout = setTimeout(() => {
                if (activeListenerRef.current) {
                    activeListenerRef.current();
                    activeListenerRef.current = null;
                }
                setIsSending(false);
                setError('Generation timed out (90s). Check the desktop.');
            }, 90000);

            activeListenerRef.current = remoteRelayService.onResponse(commandId, (response: RemoteResponse) => {
                if (response.isFinal && response.text) {
                    clearTimeout(timeout);
                    if (activeListenerRef.current) {
                        activeListenerRef.current();
                        activeListenerRef.current = null;
                    }
                    setIsSending(false);

                    // Check if response contains image URLs
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
                        // Text-only response — display as error or info
                        setError(response.text);
                    }
                }
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to generate');
            setIsSending(false);
        }
    }, [inputPrompt, aspectRatio, isSending]);

    // Cleanup active response listener on unmount
    useEffect(() => {
        return () => {
            if (activeListenerRef.current) {
                activeListenerRef.current();
                activeListenerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* ── Generated Images Gallery ──────────────────────────────── */}
            {generatedImages.length > 0 && (
                <div className="px-3 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-[#8b949e]">
                            {generatedImages.length} generated
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {generatedImages.slice(0, 4).map((img, i) => (
                            <div
                                key={i}
                                className="relative aspect-square rounded-lg overflow-hidden border border-[#30363d]/40 bg-[#0d1117]"
                            >
                                <img
                                    src={img.url}
                                    alt={img.prompt}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                                    <p className="text-[9px] text-white/70 truncate">{img.prompt}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Active Generation Monitor ─────────────────────────────── */}
            {(isGenerating || isSending) && (
                <div className="px-3 pb-3">
                    <div className="flex items-start gap-3 px-3 py-4 rounded-xl bg-[#161b22]/60 border border-blue-600/30">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-white font-medium">
                                {isSending ? 'Generating on desktop…' : 'Generating…'}
                            </p>
                            <p className="text-[10px] text-[#8b949e] mt-1 truncate">
                                {isSending ? inputPrompt : (storePrompt || 'Processing...')}
                            </p>
                            <div className="mt-2 h-1 rounded-full bg-[#21262d] overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse w-2/3" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Agent Processing in Creative Module ───────────────────── */}
            {isAgentProcessing && currentModule === 'creative' && !isSending && (
                <div className="flex flex-col items-center justify-center py-4 text-center px-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-900/20 border border-purple-600/30 flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                    </div>
                    <p className="text-sm text-purple-400">Creative Director working…</p>
                    <p className="text-xs text-[#484f58] mt-1">A generation may start soon</p>
                </div>
            )}

            {/* ── Error Display ─────────────────────────────────────────── */}
            {error && (
                <div className="px-3 pb-3">
                    <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-600/30 text-xs text-red-400">
                        {error}
                    </div>
                </div>
            )}

            {/* ── Empty State ───────────────────────────────────────────── */}
            {!isGenerating && !isSending && !isAgentProcessing && generatedImages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                    <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d]/40 flex items-center justify-center mb-3">
                        <Wand2 className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-sm text-[#c9d1d9]">Remote Image Generation</p>
                    <p className="text-xs text-[#484f58] mt-1 px-8">
                        Type a prompt below to generate images on the desktop
                    </p>
                </div>
            )}

            {/* ── Style Presets ──────────────────────────────────────────── */}
            <div className="px-3 pb-2 mt-auto">
                <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar">
                    <Palette className="w-3.5 h-3.5 text-[#484f58] flex-shrink-0" />
                    {STYLE_PRESETS.map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => handleStylePreset(preset)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors
                                ${activeStylePreset === preset.label
                                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                                    : 'bg-[#161b22] text-[#8b949e] border border-[#30363d]/40 hover:border-[#484f58]'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Aspect Ratio Selector ──────────────────────────────────── */}
            <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-[#484f58] flex-shrink-0" />
                    {ASPECT_RATIOS.map(ar => (
                        <button
                            key={ar.value}
                            onClick={() => setAspectRatio(ar.value)}
                            className={`px-2 py-0.5 rounded text-[10px] transition-colors
                                ${aspectRatio === ar.value
                                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                                    : 'bg-[#161b22] text-[#6e7681] border border-[#30363d]/40'
                                }`}
                        >
                            {ar.icon} {ar.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Prompt Input ───────────────────────────────────────────── */}
            <div className="px-3 pb-3">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0d1117]/80 border border-[#30363d]/60">
                    <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
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
                        placeholder="Describe your image…"
                        disabled={isSending}
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-[#484f58] outline-none"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={!inputPrompt.trim() || isSending}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                            ${inputPrompt.trim() && !isSending
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500'
                                : 'bg-[#21262d] text-[#484f58]'
                            }`}
                    >
                        {isSending
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
