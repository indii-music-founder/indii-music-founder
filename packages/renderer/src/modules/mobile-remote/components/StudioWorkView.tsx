import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Sparkles, MessageSquare, Image as ImageIcon, Download, Maximize2, X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { remoteRelayService, type RemoteCommand, type RemoteResponse } from '@/services/agent/RemoteRelayService';
import { buildGeneratedImagesGallery } from './GenerationMonitor';
import { triggerHaptic } from '../haptics';
import { useToast } from '@/core/context/ToastContext';
import { downloadCapturedMedia } from './QuickCaptureView';

const AgentChat = lazy(() => import('./AgentChat'));

interface StudioWorkViewProps {
    isPaired: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSendCommand?: (command: { type: string; payload: any }) => void;
}

export default function StudioWorkView({ isPaired, onSendCommand }: StudioWorkViewProps) {
    const toast = useToast();
    const [subTab, setSubTab] = useState<'outputs' | 'chat'>('outputs');
    const [relayCommands, setRelayCommands] = useState<RemoteCommand[]>([]);
    const [relayResponses, setRelayResponses] = useState<RemoteResponse[]>([]);
    const [selectedImage, setSelectedImage] = useState<{ url: string; prompt: string } | null>(null);
    const [flyerPrompt, setFlyerPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        const unsubCmds = remoteRelayService.onAllCommands((cmds) => {
            setRelayCommands(cmds);
        });
        const unsubResps = remoteRelayService.onAllResponses((resps) => {
            setRelayResponses(resps);
        });

        return () => {
            unsubCmds();
            unsubResps();
        };
    }, []);

    // Combine all image URLs returned by relay responses
    const allImages = React.useMemo(() => {
        // Collect responses with image URLs
        const responseImages = relayResponses.flatMap((res) => {
            if (!res.imageUrls || res.imageUrls.length === 0) return [];
            const prompt = res.text || 'Studio generation';
            const timestamp = typeof res.timestamp === 'number'
                ? res.timestamp
                : (res.timestamp as { toMillis?: () => number })?.toMillis?.() || Date.now();
            return res.imageUrls.map((url) => ({ url, prompt, timestamp }));
        });

        // Also merge with standard gallery reducer for complete coverage
        const gallery = buildGeneratedImagesGallery(relayCommands, relayResponses, []);

        const map = new Map<string, { url: string; prompt: string; timestamp?: number }>();
        [...responseImages, ...gallery].forEach((img) => {
            if (!map.has(img.url)) {
                map.set(img.url, img);
            }
        });

        return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [relayCommands, relayResponses]);

    const handleGenerateFlyer = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = flyerPrompt.trim();
        if (!trimmed || isGenerating) return;

        setIsGenerating(true);
        triggerHaptic([40, 80]);

        try {
            // Send image generation command to desktop
            await remoteRelayService.sendCommand(
                `[GENERATE_IMAGE] ${trimmed}`,
                'creative',
                {
                    type: 'generate_image',
                    aspectRatio: '4:5', // Best aspect ratio for flyers
                }
            );
            toast.success('Flyer request sent to desktop studio.');
            setFlyerPrompt('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to send flyer request.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async (url: string, filename = 'studio-work.png') => {
        triggerHaptic(40);
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            downloadCapturedMedia(blob, filename);
            toast.success('Downloaded to phone.');
        } catch {
            // Fallback: open directly in new tab for saving to camera roll
            window.open(url, '_blank');
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden font-sans">
            {/* Sub-navigation Segmented Control */}
            <div className="flex items-center justify-center px-4 pt-1 pb-3">
                <div className="flex items-center p-1 bg-white/[0.05] border border-white/10 rounded-2xl w-full max-w-xs shadow-inner">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic(30);
                            setSubTab('outputs');
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-display ${
                            subTab === 'outputs'
                                ? 'bg-[#00ff66] text-[#061806] shadow-sm'
                                : 'text-stone-400 hover:text-white'
                        }`}
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Flyers & Outputs</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic(30);
                            setSubTab('chat');
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-display ${
                            subTab === 'chat'
                                ? 'bg-[#00ff66] text-[#061806] shadow-sm'
                                : 'text-stone-400 hover:text-white'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Agent Chat</span>
                    </button>
                </div>
            </div>

            {/* SubTab Views */}
            {subTab === 'chat' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <Suspense fallback={<div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#00ff66]" /></div>}>
                        <AgentChat isPaired={isPaired} onSendCommand={onSendCommand || (() => {})} />
                    </Suspense>
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Quick Flyer Prompt Bar */}
                    <form onSubmit={handleGenerateFlyer} className="px-4 pb-3">
                        <div className="relative flex items-center">
                            <Sparkles className="w-4 h-4 absolute left-3.5 text-stone-500 pointer-events-none" />
                            <input
                                type="text"
                                value={flyerPrompt}
                                onChange={(e) => setFlyerPrompt(e.target.value)}
                                placeholder="Create a flyer for Friday night show..."
                                className="w-full h-11 pl-10 pr-12 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#00ff66]/50 transition-all font-sans"
                            />
                            <button
                                type="submit"
                                disabled={!flyerPrompt.trim() || isGenerating}
                                className="absolute right-1.5 w-8 h-8 rounded-xl bg-[#00ff66] text-[#061806] flex items-center justify-center disabled:opacity-30 disabled:bg-white/10 disabled:text-stone-500 hover:bg-[#36D96F] transition-all cursor-pointer"
                            >
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </form>

                    {/* Outputs Grid */}
                    <div className="flex-1 overflow-y-auto px-4 pb-28 custom-scrollbar">
                        {allImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400 space-y-3 bg-[#181411]/60 border border-white/5 rounded-3xl p-6">
                                <div className="w-12 h-12 rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/20 flex items-center justify-center text-[#00ff66]">
                                    <ImageIcon className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-bold text-stone-200 font-display">No Studio Outputs Yet</h4>
                                <p className="text-xs text-stone-500 max-w-[240px]">
                                    Tell your desktop AI to make a flyer or generate artwork, and the high-res results will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {allImages.map((img, idx) => (
                                    <motion.div
                                        key={`${img.url}-${idx}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#181411] shadow-lg aspect-square flex flex-col justify-end"
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.prompt || 'Studio output'}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                                        <div className="relative p-2.5 flex items-center justify-between z-10">
                                            <p className="text-[10px] text-stone-200 font-medium line-clamp-1 flex-1 pr-1 font-sans">
                                                {img.prompt}
                                            </p>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedImage(img)}
                                                    className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all cursor-pointer"
                                                    title="View Fullscreen"
                                                >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownload(img.url, `flyer-${idx + 1}.png`)}
                                                    className="w-7 h-7 rounded-lg bg-[#00ff66] text-[#061806] flex items-center justify-center hover:bg-[#36D96F] transition-all cursor-pointer"
                                                    title="Download"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Fullscreen Image Preview Lightbox */}
            <AnimatePresence>
                {selectedImage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
                        <button
                            type="button"
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer z-50"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="max-w-md w-full flex flex-col items-center gap-4">
                            <div className="w-full max-h-[70vh] rounded-2xl overflow-hidden border border-white/15 bg-black flex items-center justify-center shadow-2xl">
                                <img
                                    src={selectedImage.url}
                                    alt={selectedImage.prompt}
                                    className="max-h-[70vh] w-full object-contain"
                                />
                            </div>

                            <p className="text-xs text-stone-300 text-center font-medium px-4 line-clamp-2">
                                {selectedImage.prompt}
                            </p>

                            <button
                                type="button"
                                onClick={() => handleDownload(selectedImage.url, 'studio-flyer.png')}
                                className="h-12 px-6 rounded-2xl bg-[#00ff66] text-[#061806] font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#00ff66]/20 hover:bg-[#36D96F] transition-all cursor-pointer font-display"
                            >
                                <Download className="w-4 h-4" />
                                <span>Save to Phone</span>
                            </button>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
