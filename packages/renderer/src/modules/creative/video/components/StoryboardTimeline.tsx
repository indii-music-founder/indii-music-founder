import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Music, Play, Pause, Trash2, Cpu, Eye, Check, AlertTriangle, 
    Sparkles, RefreshCw, Layers, Link as LinkIcon, Volume2, CloudLightning
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from '../store/videoEditorStore';
import type { StoryboardSlot, StoryboardProject } from '../schemas/storyboard';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { renderService } from '@/services/video/RenderService';
import { logger } from '@/utils/logger';

function readAudioDuration(audioUrl: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                resolve(audio.duration);
            } else {
                reject(new Error('Unable to read audio duration from uploaded file.'));
            }
        };
        audio.onerror = () => reject(new Error('Unable to read audio metadata from uploaded file.'));
        audio.src = audioUrl;
    });
}

export function StoryboardTimeline() {
    const toast = useToast();
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Global Store
    const { userProfile, clipboardItems } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        clipboardItems: state.clipboardItems || []
    })));

    // Video Editor Store
    const {
        storyboardProject,
        setStoryboardProject,
        updateStoryboardSlot,
        generateStoryboardSlots
    } = useVideoEditorStore(useShallow(state => ({
        storyboardProject: state.storyboardProject,
        setStoryboardProject: state.setStoryboardProject,
        updateStoryboardSlot: state.updateStoryboardSlot,
        generateStoryboardSlots: state.generateStoryboardSlots
    })));

    // Local Component State
    const [audioFileName, setAudioFileName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
    const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

    const [isIsolatingStems, setIsIsolatingStems] = useState<boolean>(false);

    // Handle audio upload and trigger automatic beat mapping
    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAudioFileName(file.name);
        setIsIsolatingStems(true);
        toast.info("Importing audio metadata...");

        try {
            const audioUrl = URL.createObjectURL(file);
            const durationSeconds = await readAudioDuration(audioUrl);
            const editableGridBpm = 120;

            setStoryboardProject({
                id: 'sb-' + Date.now(),
                name: file.name.replace(/\.[^/.]+$/, "") + " Storyboard",
                audioUrl,
                bpm: editableGridBpm,
                key: undefined,
                durationSeconds,
                slots: []
            });

            generateStoryboardSlots(editableGridBpm, durationSeconds);
            toast.warning("Audio imported. Beat, key, and stem analysis are not configured; using an editable 120 BPM grid.");
        } catch (err) {
            logger.error('[StoryboardTimeline] Audio metadata import failed:', err);
            toast.error(err instanceof Error ? err.message : 'Unable to import audio metadata.');
        } finally {
            setIsIsolatingStems(false);
        }
    };

    // Storyboard drift score heuristic comparing prompt styling descriptors with visual brand kit anchors.
    const calculateDriftScore = (promptText: string): number => {
        if (!promptText.trim()) return 0;
        
        // Retrieve brand description keys
        const brandKitBio = userProfile?.brandKit?.brandDescription?.toLowerCase() || '';
        const keywords = ['cyberpunk', 'vaporwave', 'psychedelic', 'retro', 'orchestral', 'dark', 'neon', 'minimalist', 'gothic', 'cinematic'];
        
        let matchCount = 0;
        let activeKeywords = 0;

        keywords.forEach(keyword => {
            const inBrand = brandKitBio.includes(keyword);
            const inPrompt = promptText.toLowerCase().includes(keyword);
            if (inBrand) activeKeywords++;
            if (inBrand && inPrompt) matchCount++;
        });

        if (activeKeywords === 0) return 0.12; // Baseline variance
        const similarity = matchCount / activeKeywords;
        
        // Drift is inverse of similarity
        return Math.max(0, Math.min(1, 1 - similarity));
    };

    // Drag-and-drop clipboard image item onto storyboard slot
    const handleDragOver = (e: React.DragEvent, slotId: string) => {
        e.preventDefault();
        setDragOverSlotId(slotId);
    };

    const handleDragLeave = () => {
        setDragOverSlotId(null);
    };

    const handleDropOnSlot = (e: React.DragEvent, slotId: string) => {
        e.preventDefault();
        setDragOverSlotId(null);
        
        try {
            const rawData = e.dataTransfer.getData('text/plain');
            if (!rawData) return;
            
            // Check if dropped item matches an item from the creative clipboard
            const clipboardItem = clipboardItems.find(item => item.id === rawData);
            if (clipboardItem) {
                updateStoryboardSlot(slotId, {
                    videoUrl: clipboardItem.url,
                    prompt: clipboardItem.prompt || 'Imported graphic'
                });
                toast.success("Creative graphic pinned to storyboard slot successfully!");
            }
        } catch (err) {
            logger.error('[StoryboardTimeline] Drop failed:', err);
        }
    };

    // Render Veo 3.1 video clip generation for slot
    const renderSlotVideo = async (slot: StoryboardSlot, index: number) => {
        if (!slot.prompt.trim()) {
            toast.error("Please enter a storyboard description before rendering.");
            return;
        }

        updateStoryboardSlot(slot.id, { isGenerating: true, progress: 10 });
        toast.info(`Armed slot ${index + 1}: Render starting...`);

        try {
            // Continuity: Extract visual frame from previous segment
            let firstFrame: string | undefined;
            if (slot.useDaisyChain && index > 0 && storyboardProject) {
                const prevSlot = storyboardProject.slots[index - 1];
                if (prevSlot?.videoUrl) {
                    firstFrame = prevSlot.videoUrl;
                    logger.info(`[Storyboard] Daisy-chain continuous framing applied for slot ${index + 1}`);
                }
            }

            let vocalAudio: string | undefined;
            if (slot.useVocalSync) {
                if (!slot.vocalConditioningAudioUrl) {
                    updateStoryboardSlot(slot.id, { isGenerating: false, progress: 0 });
                    toast.error("Vocal sync requires a real isolated vocal stem URL.");
                    return;
                }
                vocalAudio = slot.vocalConditioningAudioUrl;
                logger.info(`[Storyboard] Vocal stem conditioning enabled for slot ${index + 1}`);
            }

            // Trigger Veo 3.1 generation
            const result = await VideoGeneration.generateVideo({
                prompt: slot.prompt,
                resolution: '1080p',
                aspectRatio: '16:9',
                firstFrame,
                inputAudio: vocalAudio,
                duration: 8, // 4 bars typically at ~120BPM is ~8 seconds
                durationSeconds: 8,
                model: 'veo-3.1-generate-preview'
            });

            if (result && result.length > 0) {
                const clip = result[0]!;
                
                // Track progress
                let currentProgress = 20;
                const progressInterval = setInterval(() => {
                    currentProgress += 15;
                    if (currentProgress >= 90) {
                        clearInterval(progressInterval);
                    } else {
                        updateStoryboardSlot(slot.id, { progress: currentProgress });
                    }
                }, 1000);

                // Check background job status or URL
                if (clip.url) {
                    clearInterval(progressInterval);
                    updateStoryboardSlot(slot.id, {
                        isGenerating: false,
                        progress: 100,
                        videoUrl: clip.url,
                        driftScore: calculateDriftScore(slot.prompt)
                    });
                    toast.success(`Slot ${index + 1} generated successfully!`);
                } else {
                    // Poll for job updates
                    const checkJob = () => {
                        const unsub = VideoGeneration.subscribeToJob(clip.id, (data) => {
                            if (data) {
                                if (data.progress !== undefined) {
                                    updateStoryboardSlot(slot.id, { progress: data.progress });
                                }
                                if (data.status === 'completed' && data.videoUrl) {
                                    unsub();
                                    updateStoryboardSlot(slot.id, {
                                        isGenerating: false,
                                        progress: 100,
                                        videoUrl: data.videoUrl,
                                        driftScore: calculateDriftScore(slot.prompt)
                                    });
                                    toast.success(`Slot ${index + 1} rendering complete!`);
                                } else if (data.status === 'failed') {
                                    unsub();
                                    updateStoryboardSlot(slot.id, { isGenerating: false, progress: 0 });
                                    toast.error(`Slot ${index + 1} rendering failed.`);
                                }
                            }
                        });
                    };
                    checkJob();
                }
            }
        } catch (err: any) {
            logger.error('[StoryboardTimeline] Render failed:', err);
            updateStoryboardSlot(slot.id, { isGenerating: false, progress: 0 });
            toast.error(`Veo 3.1 generation failed: ${err.message || 'Unknown error'}`);
        }
    };

    // Compile entire showreel video
    const handleCompileVideo = async () => {
        if (!storyboardProject) return;
        
        const renderedCount = storyboardProject.slots.filter(s => !!s.videoUrl).length;
        if (renderedCount === 0) {
            toast.error("Please render at least one storyboard slot before compiling.");
            return;
        }

        toast.info("Dispatching Showreel render to Cloud Run...");
        try {
            const result = await renderService.renderComposition({
                compositionId: 'Showreel',
                inputProps: { project: storyboardProject },
                outputLocation: 'local_ignored.mp4',
                useCloudQueue: true
            });
            
            toast.success(`Showreel dispatched successfully! URL: ${result}`);
        } catch (error: any) {
            logger.error('[StoryboardTimeline] Showreel render failed:', error);
            toast.error(`Failed to render Showreel: ${error.message || String(error)}`);
        }
    };

    return (
        <div className="h-full flex flex-col bg-bg-dark text-white selection:bg-purple-500/20 selection:text-white relative">
            {/* Header / Audio Import Panel */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 bg-[#0e1117]/60 p-5 shrink-0 backdrop-blur-xl gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
                        <Music size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                            Beat-Quantized Storyboard Timeline
                            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-widest">Veo 3.1 Audio-Conditioned</span>
                        </h2>
                        <p className="text-[10px] text-neutral-500 mt-1 font-mono uppercase tracking-wider">
                            {storyboardProject
                                ? `Active: ${storyboardProject.name} · Grid: ${storyboardProject.bpm} BPM${storyboardProject.key ? ` · Key: ${storyboardProject.key}` : ' · Key: not analyzed'}`
                                : "Upload audio to generate bar-aligned video segments"
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input
                        type="file"
                        ref={audioInputRef}
                        onChange={handleAudioUpload}
                        className="hidden"
                        accept="audio/*"
                    />

                    {isIsolatingStems ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold uppercase tracking-wider">
                            <RefreshCw size={14} className="animate-spin" />
                            Isolating vocal stems...
                        </div>
                    ) : (
                        <button
                            onClick={() => audioInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            <Music size={14} />
                            {audioFileName ? 'Change Track' : 'Load Audio Track'}
                        </button>
                    )}

                    {storyboardProject && (
                        <button
                            onClick={handleCompileVideo}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FFE135] hover:bg-[#FFD700] text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-yellow-500/10"
                        >
                            <Sparkles size={14} />
                            Compile Showreel
                        </button>
                    )}
                </div>
            </div>

            {/* Main timeline scroll container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-black/45 flex items-center p-6 gap-6 relative select-none">
                {!storyboardProject ? (
                    <div className="w-full max-w-md mx-auto text-center space-y-4 py-16">
                        <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-neutral-500 animate-bounce">
                            <CloudLightning size={28} className="text-purple-400/50" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                                Import master audio to begin storyboarding
                            </p>
                            <p className="text-[10px] text-neutral-600 leading-normal max-w-sm mx-auto uppercase">
                                The engine will automatically segment your track into beat-quantized four-bar cards, ready for sequential video generation.
                            </p>
                        </div>
                        <button
                            onClick={() => audioInputRef.current?.click()}
                            className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-500/20"
                        >
                            Select Audio File
                        </button>
                    </div>
                ) : (
                    <AnimatePresence>
                        {storyboardProject.slots.map((slot, index) => {
                            const isHovered = hoveredCardId === slot.id;
                            const isDragOver = dragOverSlotId === slot.id;
                            const isDriftWarning = slot.driftScore !== undefined && slot.driftScore > 0.35;

                            return (
                                <motion.div
                                    key={slot.id}
                                    initial={{ opacity: 0, scale: 0.9, x: 50 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    onMouseEnter={() => setHoveredCardId(slot.id)}
                                    onMouseLeave={() => setHoveredCardId(null)}
                                    onDragOver={(e) => handleDragOver(e, slot.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDropOnSlot(e, slot.id)}
                                    className={`relative w-80 h-[480px] shrink-0 rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden backdrop-blur-xl ${
                                        isDragOver
                                            ? 'border-cyan-500 bg-cyan-950/25 ring-2 ring-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.15)] scale-[1.03]'
                                            : isHovered
                                                ? 'border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.5)] scale-[1.01]'
                                                : 'border-white/5 bg-white/[0.02]'
                                    }`}
                                >
                                    {/* Waveform Beat Segment Indicator */}
                                    <div className="px-4 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0 font-mono">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                BAR {slot.startBar + 1}-{slot.startBar + slot.durationBars}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest">
                                            Segment {index + 1}
                                        </span>
                                    </div>

                                    {/* Visual Preview / Upload Drop-zone */}
                                    <div className="flex-1 bg-black/50 relative overflow-hidden flex items-center justify-center select-none group">
                                        {slot.videoUrl ? (
                                            <div className="w-full h-full relative">
                                                <video
                                                    src={slot.videoUrl}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    loop
                                                    playsInline
                                                    autoPlay
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => updateStoryboardSlot(slot.id, { videoUrl: undefined })}
                                                        className="p-2.5 rounded-full bg-red-600/90 text-white hover:bg-red-500 transition-colors"
                                                        title="Delete clip"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : slot.isGenerating ? (
                                            <div className="text-center space-y-3 px-4">
                                                <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                                                    <div className="absolute inset-0 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                                    <Cpu size={18} className="text-purple-400 animate-pulse" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-purple-300">Veo 3.1 generating...</p>
                                                    <p className="text-[9px] text-neutral-500 font-mono">{slot.progress}%</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center p-6 space-y-2 pointer-events-none select-none">
                                                <Layers size={24} className="text-neutral-600 mx-auto group-hover:text-purple-400 transition-colors duration-300" />
                                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                                    Drag visual asset here
                                                </p>
                                                <p className="text-[8px] text-neutral-600 uppercase tracking-widest">
                                                    or write prompt and render
                                                </p>
                                            </div>
                                        )}

                                        {/* Drift Warning Overlay */}
                                        {isDriftWarning && (
                                            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600/90 text-white px-2 py-0.5 rounded border border-red-500 text-[8px] font-black tracking-widest uppercase shadow-lg animate-pulse z-15">
                                                <AlertTriangle size={8} />
                                                Drift Radar Alert
                                            </div>
                                        )}
                                    </div>

                                    {/* Prompts & Generation parameters */}
                                    <div className="p-4 bg-[#0e1117]/80 border-t border-white/5 space-y-3 shrink-0 flex flex-col justify-between">
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-gray-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500/40 resize-none h-16 transition-colors"
                                                placeholder="Describe scene visual prompt details..."
                                                value={slot.prompt}
                                                onChange={(e) => updateStoryboardSlot(slot.id, { prompt: e.target.value })}
                                            />

                                            {/* Control Toggles */}
                                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-[9px]">
                                                {/* Vocal Conditioning Isolator */}
                                                <button
                                                    onClick={() => updateStoryboardSlot(slot.id, { useVocalSync: !slot.useVocalSync })}
                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded border font-bold uppercase tracking-wider transition-colors ${
                                                        slot.useVocalSync 
                                                            ? 'bg-purple-600/10 border-purple-500/30 text-purple-400' 
                                                            : 'bg-black/30 border-white/5 text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                >
                                                    <Volume2 size={10} />
                                                    🎙️ Sync vocals
                                                </button>

                                                {/* Daisy-Chain Continuity Checkbox */}
                                                <button
                                                    onClick={() => updateStoryboardSlot(slot.id, { useDaisyChain: !slot.useDaisyChain })}
                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded border font-bold uppercase tracking-wider transition-colors ${
                                                        slot.useDaisyChain 
                                                            ? 'bg-cyan-600/10 border-cyan-500/30 text-cyan-400' 
                                                            : 'bg-black/30 border-white/5 text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                >
                                                    <LinkIcon size={10} />
                                                    Continuity
                                                </button>
                                            </div>
                                        </div>

                                        {/* Render Trigger */}
                                        <button
                                            disabled={slot.isGenerating}
                                            onClick={() => renderSlotVideo(slot, index)}
                                            className="w-full flex items-center justify-center gap-2.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/40 disabled:text-neutral-500 text-xs font-bold uppercase tracking-widest transition-all mt-1"
                                        >
                                            <CloudLightning size={12} className="text-purple-300 animate-pulse" />
                                            {slot.videoUrl ? 'Re-render Block' : 'Render Segment'}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
