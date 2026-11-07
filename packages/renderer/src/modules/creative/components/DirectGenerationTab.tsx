import React, { useState, useEffect } from 'react';
import { 
    Loader2, Image as ImageIcon, Video, Send, Settings2, Download, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ChevronDown, ChevronUp, Film, MoreHorizontal, Cpu, Wand2, Globe, Shield, RefreshCw, Layers, Compass, Pin
} from 'lucide-react';
import { motion } from 'motion/react';
import { IngredientDropZone } from './IngredientDropZone';
import { CreativeVideoPlayer } from './CreativeVideoPlayer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IntelligencePromptInput } from './veo/IntelligencePromptInput';
import { useDirectGeneration } from '../hooks/useDirectGeneration';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { VideoGenerationProgress } from './veo/VideoGenerationProgress';
import { WhiskService } from '@/services/WhiskService';
import { useToast } from '@/core/context/ToastContext';
import { useOptionalAdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspaceContext';
import { SavedArtworkPanel } from './CanvasEditor/SavedArtworkPanel';
import {
    judgeCreativePromptModeIntent,
    judgeCreativeStudioConfigPreset,
    deterministicCreativeStudioConfigFallback,
    type CreativePromptModeVerdict,
    type CreativeStudioConfigPresetVerdict,
} from '@/config/typesafeJudgments';

// ISSUE-788: the backend only special-cases '9:16' for a Veo video request
// and silently coerces every other aspect ratio to '16:9'
// (gateway.ts normalizeVideoAspectRatio) — 1:1/4:3/3:4 look selectable in
// video mode but have zero effect once submitted.
const VALID_VIDEO_ASPECT_RATIOS = new Set(['16:9', '9:16']);
import { normalizeVideoDuration, normalizeVideoResolution } from '@indii/shared';
import { DropdownMenu, DropdownMenuTriggerButton, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { BrandPromptAdditivesMenu } from './BrandPromptAdditivesMenu';

export default function DirectGenerationTab() {
    const toast = useToast();
    const workspaceMode = useOptionalAdaptiveWorkspace()?.mode ?? 'wide';
    const currentProjectId = useStore(state => state.currentProjectId);
    const { 
        isPromptBuilderOpen, 
        togglePromptBuilder, 
        whiskState,
        videoInputs,
        characterReferences,
        setStudioControls,
        pinToClipboard
    } = useStore(useShallow(state => ({
        isPromptBuilderOpen: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder,
        whiskState: state.whiskState,
        videoInputs: state.videoInputs,
        characterReferences: state.characterReferences,
        setStudioControls: state.setStudioControls,
        pinToClipboard: state.pinToClipboard
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
        studioControls,
        activeJobs,
        cancelJob
    } = useDirectGeneration();

    const [, setActiveSection] = useState<'basics' | 'advanced'>('basics');
    const [previewedAssetId, setPreviewedAssetId] = useState<string | null>(null);
    const latestItem = results.find(item => item.type === mode);
    const isAssetPreviewOpen = !!latestItem && previewedAssetId === latestItem.id;

    const videoClipCount = results.filter(r => r.type === 'video').length;

    const synthesizedPrompt = localPrompt.trim() 
        ? (mode === 'image' 
            ? WhiskService.synthesizeWhiskPrompt(localPrompt, whiskState)
            : WhiskService.synthesizeVideoPrompt(localPrompt, whiskState))
        : '';
    const hasWhiskModifiers = synthesizedPrompt !== localPrompt && synthesizedPrompt.length > 0;
    const videoInputSummary = mode === 'video' ? [
        ...(videoInputs.firstFrame?.url ? ['First frame: selected anchor'] : ['First frame: none selected (references will not become an anchor)']),
        ...(videoInputs.lastFrame?.url ? ['Last frame: selected end anchor'] : []),
        ...(mappedIngredients.length ? [`Ingredients: ${mappedIngredients.length} reference${mappedIngredients.length === 1 ? '' : 's'}`] : []),
        ...(characterReferences.length ? [`Characters: ${characterReferences.length} reference${characterReferences.length === 1 ? '' : 's'}`] : []),
    ] : [];


    const aspectRatios = [
        { id: '1:1', label: 'Square', desc: 'Cover Art / Social', w: 'w-6', h: 'h-6' },
        { id: '4:5', label: 'Feed Portrait', desc: 'Instagram Feed', w: 'w-5', h: 'h-6' },
        { id: '16:9', label: 'Cinema', desc: 'YouTube / Widescreen', w: 'w-8', h: 'h-4.5' },
        { id: '9:16', label: 'Vertical', desc: 'TikTok / Canvas', w: 'w-4.5', h: 'h-8' },
        { id: '4:3', label: 'Classic', desc: 'Traditional NTSC', w: 'w-7', h: 'h-5.25' },
        { id: '3:4', label: 'Portrait', desc: 'Editorial / Poster', w: 'w-5.25', h: 'h-7' }
    ] as const;

    // Image generation (Nano Banana) has no aspect-ratio restriction, so
    // only video mode is filtered against VALID_VIDEO_ASPECT_RATIOS.
    const visibleAspectRatios = mode === 'video'
        ? aspectRatios.filter(ratio => VALID_VIDEO_ASPECT_RATIOS.has(ratio.id))
        : aspectRatios;

    const cameraMovements = [
        'Static',
        'Pan Left',
        'Pan Right',
        'Zoom In',
        'Zoom Out',
        'Dynamic Tilt',
        'Orbiting Sweep'
    ] as const;

    // ISSUE-788: Veo 3.1 only supports 4/6/8-second lengths — the backend
    // clamps anything else (VideoGenerationService.ts), so "10s" looked
    // selectable but never produced a 10-second video.
    const hasFrameInput = !!videoInputs.firstFrame?.url || mappedIngredients.length > 0 || characterReferences.length > 0;
    const effectiveResolution = normalizeVideoResolution(studioControls.resolution, studioControls.model);
    const resolvedDuration = normalizeVideoDuration(studioControls.duration, effectiveResolution, hasFrameInput);
    
    // Determine which options to show based on the current configuration
    const durationOptions = (effectiveResolution !== '720p' || hasFrameInput)
        ? [8] as const
        : [4, 6, 8] as const;

    const directorFps = studioControls.fps || 24;
    const directorFrames = Math.round((resolvedDuration || 0) * directorFps);

    const [promptModeVerdict, setPromptModeVerdict] = useState<CreativePromptModeVerdict | null>(null);
    const [configPresetVerdict, setConfigPresetVerdict] = useState<CreativeStudioConfigPresetVerdict>(() =>
        deterministicCreativeStudioConfigFallback({
            mode: mode === 'video' ? 'video' : 'image',
            prompt: localPrompt,
            aspectRatio: studioControls.aspectRatio,
            model: studioControls.model,
        }),
    );

    // JEV System One: Evaluate unified studio configuration preset (Basics + Advanced)
    useEffect(() => {
        const activeMode: 'image' | 'video' = mode === 'video' ? 'video' : 'image';
        setConfigPresetVerdict(
            deterministicCreativeStudioConfigFallback({
                mode: activeMode,
                prompt: localPrompt,
                aspectRatio: studioControls.aspectRatio,
                model: studioControls.model,
            }),
        );

        let isCurrent = true;
        const timer = setTimeout(() => {
            if (typeof judgeCreativeStudioConfigPreset !== 'function') return;
            void judgeCreativeStudioConfigPreset({
                mode: activeMode,
                prompt: localPrompt,
                aspectRatio: studioControls.aspectRatio,
                model: studioControls.model,
            }).then((verdict) => {
                if (isCurrent && verdict) {
                    setConfigPresetVerdict(verdict);
                }
            });
        }, 220);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [mode, localPrompt, studioControls.aspectRatio, studioControls.model]);

    // JEV System One: Ambiently evaluate prompt intent and offer smart mode switch
    useEffect(() => {
        const text = localPrompt.trim();
        if (text.length < 5) {
            setPromptModeVerdict(null);
            return;
        }

        let isCurrent = true;
        const timer = setTimeout(() => {
            void judgeCreativePromptModeIntent(text, mode as 'image' | 'video' | 'omni').then((verdict) => {
                if (!isCurrent) return;
                // Only suggest if different from current mode and high confidence
                if (verdict.suggestedMode !== mode && verdict.confidence >= 0.70) {
                    setPromptModeVerdict(verdict);
                } else {
                    setPromptModeVerdict(null);
                }
            });
        }, 300);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [localPrompt, mode]);

    // Snap to a real video aspect ratio when entering video mode with an
    // image-only selection still active, so the UI never shows nothing
    // selected (or a choice that would silently become 16:9 anyway).
    useEffect(() => {
        if (mode === 'video' && !VALID_VIDEO_ASPECT_RATIOS.has(studioControls.aspectRatio)) {
            setStudioControls({ aspectRatio: '16:9' });
        }
    }, [mode, studioControls.aspectRatio, setStudioControls]);

    const handleApplyJevPreset = () => {
        const patch = configPresetVerdict.controlsPatch;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStudioControls(patch as any);
        toast.info(`Applied ${configPresetVerdict.label}`);
    };

    return (
        <div
            className={`flex flex-col h-full min-h-0 w-full bg-[#050406] text-foreground select-none overflow-y-auto ${
                workspaceMode === 'focused' ? 'flex-col' : ''
            }`}
            data-testid="direct-generation-workspace"
            data-workspace-mode={workspaceMode}
        >
            {/* Unified Fixed-Proportion Creative Hub Console */}
            <div
                className="w-full flex-1 flex flex-col justify-between shrink-0 select-none relative p-3 sm:p-4 max-w-4xl mx-auto"
                data-testid="direct-generation-controls"
            >
                
                {/* Glowing subtle top gradient mesh for a premium look */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-radial-gradient from-dept-creative/10 to-transparent pointer-events-none" />

                <div className="flex flex-col gap-2.5 z-10 w-full">
                    {/* Compact Console Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-dept-creative/10 border border-dept-creative/20 text-dept-creative shadow-[0_0_12px_rgba(var(--color-dept-creative-rgb),0.1)]">
                                <Wand2 size={14} />
                            </div>
                            <div>
                                <h2 className="text-xs uppercase font-extrabold tracking-widest text-white/95">Creative Hub</h2>
                                <p className="text-[9.5px] text-gray-400 font-medium">Direct Creative Generation Studio</p>
                            </div>
                        </div>

                        {/* Mode Toggle Tabs (Inline Fixed Width) */}
                        <div className="inline-flex bg-white/4 rounded-xl p-0.5 border border-white/8 shadow-inner">
                            <button
                                onClick={() => handleModeSwitch('image')}
                                data-testid="direct-image-mode-btn"
                                className={`px-3 py-1 flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200 ${mode === 'image'
                                    ? 'bg-gradient-to-r from-dept-creative/25 to-dept-creative/10 text-white border border-dept-creative/30 font-bold shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                            >
                                <ImageIcon size={12} className={mode === 'image' ? 'text-dept-creative' : ''} />
                                <span className="text-[9.5px] font-bold uppercase tracking-wider">Image Creator</span>
                            </button>
                            <button
                                onClick={() => handleModeSwitch('video')}
                                data-testid="direct-video-mode-btn"
                                className={`px-3 py-1 flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200 ${mode === 'video'
                                    ? 'bg-gradient-to-r from-green-500/25 to-pink-500/10 text-white border border-green-500/30 font-bold shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                            >
                                <Video size={12} className={mode === 'video' ? 'text-green-400' : ''} />
                                <span className="text-[9.5px] font-bold uppercase tracking-wider">Video Creator</span>
                            </button>
                        </div>

                        {/* Quick Header Actions */}
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                                <span className="text-[9px] font-mono text-gray-300 font-bold uppercase tracking-wider">
                                    {mode === 'image' 
                                        ? (studioControls.model === 'pro' ? 'Nano Banana Pro' : 'Nano Banana 2') 
                                        : 'Veo 3.1'}
                                </span>
                            </div>

                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = async (event) => {
                                                const dataUrl = event.target?.result as string;
                                                const newId = `upload_${Date.now()}`;
                                                const { useStore } = await import('@/core/store');
                                                const { addUploadedImage, currentProjectId, openImage, setRightPanelTab } = useStore.getState();
                                                
                                                const uploadedItem = {
                                                    id: newId,
                                                    url: dataUrl,
                                                    prompt: 'Uploaded Photo',
                                                    type: 'image' as const,
                                                    timestamp: Date.now(),
                                                    projectId: currentProjectId,
                                                    origin: 'uploaded' as const
                                                };
                                                
                                                setRightPanelTab('assets');
                                                openImage(dataUrl, currentProjectId ?? 'project_default');

                                                addUploadedImage(uploadedItem).then((success) => {
                                                    if (success) {
                                                        toast.success('Photo saved to Project Assets');
                                                    } else {
                                                        toast.error('Photo available locally but failed to backup to cloud');
                                                    }
                                                }).catch(() => {
                                                    toast.error('Photo available locally but failed to backup to cloud');
                                                });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    };
                                    input.click();
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9.5px] font-bold text-white transition-all flex items-center gap-1.5"
                            >
                                <ImageIcon size={11} />
                                Upload Photo
                            </button>
                            
                            <button
                                onClick={async () => {
                                    const { useStore } = await import('@/core/store');
                                    useStore.getState().setRightPanelTab('assets');
                                }}
                                className="px-2 py-1 bg-dept-creative/20 hover:bg-dept-creative/30 border border-dept-creative/30 rounded-lg text-[9.5px] font-bold text-dept-creative transition-all flex items-center gap-1.5"
                            >
                                <Layers size={11} />
                                Project Assets
                            </button>
                        </div>
                    </div>

                    {/* Unified Configuration Bar */}
                    <div
                        data-testid="jev-creative-config-preset"
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dept-creative/25 bg-dept-creative/[0.06] px-3 py-1.5"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center gap-1 rounded-md bg-dept-creative/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-dept-creative">
                                <Wand2 size={10} /> Recommended
                            </span>
                            <span className="text-[11px] font-bold text-white truncate">
                                {configPresetVerdict.label}
                            </span>
                            <span className="hidden sm:inline text-[10px] text-gray-400 truncate">
                                — {configPresetVerdict.summary}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyJevPreset}
                            data-testid="jev-apply-config-preset-btn"
                            className="px-2.5 py-1 rounded-lg bg-dept-creative/20 hover:bg-dept-creative/35 border border-dept-creative/30 text-[10px] font-bold uppercase tracking-wider text-dept-creative hover:text-white transition-all shrink-0"
                        >
                            Apply Preset
                        </button>
                    </div>

                    {mode === 'image' && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
                            <SavedArtworkPanel key={currentProjectId ?? 'project_default'} projectId={currentProjectId ?? 'project_default'} />
                        </div>
                    )}

                    {/* Unified Single-Page Studio Configuration Grid (Basics + Advanced Side-by-Side) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                        {/* LEFT COLUMN: Basics (Format, Aspect Ratio & Sequence Timing) */}
                        <div className="lg:col-span-6 flex flex-col gap-2.5 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('basics')}
                                    className="text-[9.5px] uppercase font-extrabold tracking-wider text-white flex items-center gap-1.5"
                                >
                                    <Layers size={10} className="text-dept-creative" />
                                    Basics
                                </button>
                                <span className="text-[8.5px] font-mono uppercase tracking-wider text-gray-500">
                                    Canvas & Framing
                                </span>
                            </div>

                            {/* Aspect Ratio Cards — Compact 3-Column Fixed Tiles */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                                    Choose Aspect Ratio
                                </label>
                                <div className={`grid gap-1.5 ${mode === 'video' ? 'grid-cols-2 max-w-[280px]' : 'grid-cols-3'}`}>
                                    {visibleAspectRatios.map((ratio) => {
                                        const isSelected = studioControls.aspectRatio === ratio.id;
                                        return (
                                            <button
                                                key={ratio.id}
                                                onClick={() => setStudioControls({ aspectRatio: ratio.id })}
                                                className={`p-1.5 rounded-xl border flex flex-col items-start gap-1 transition-all group ${isSelected 
                                                    ? 'bg-white/6 border-dept-creative/40 shadow-sm' 
                                                    : 'bg-white/2 border-white/5 hover:border-white/15 hover:bg-white/4'}`}
                                            >
                                                <div className="flex items-center justify-between w-full gap-1">
                                                    <span className="text-[9.5px] font-bold text-white/95 truncate">{ratio.label}</span>
                                                    <span className="text-[8px] font-mono text-gray-500 group-hover:text-gray-400 font-bold shrink-0">{ratio.id}</span>
                                                </div>
                                                <div className="h-6 w-full flex items-center justify-center bg-black/40 rounded-lg border border-white/5">
                                                    <div className={`${ratio.w} ${ratio.h} scale-60 border-2 ${isSelected ? 'border-dept-creative bg-dept-creative/15' : 'border-gray-600'} rounded-sm transition-all`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dynamic Video Parameters */}
                            {mode === 'video' && (
                                <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
                                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-2.5 py-1.5">
                                        <div>
                                            <p className="text-[8.5px] uppercase tracking-widest text-gray-500 font-bold">Director timing</p>
                                            <p className="text-[10px] font-mono font-bold text-white/85">{directorFps} fps · {directorFrames} frames</p>
                                        </div>
                                        <span className="text-[8.5px] uppercase tracking-widest text-green-300 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5">
                                            24 FPS locked
                                        </span>
                                    </div>

                                    {/* Duration Preset pills — Fixed Inline Segmented Group */}
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                            Sequence Duration
                                        </label>
                                        <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8">
                                            {durationOptions.map((dur) => {
                                                const isSelected = studioControls.duration === dur;
                                                return (
                                                    <button
                                                        key={dur}
                                                        onClick={() => setStudioControls({ duration: dur })}
                                                        className={`min-w-[44px] px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold uppercase border transition-all ${isSelected
                                                            ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-white'}`}
                                                    >
                                                        {dur}s
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Camera Motion Pills */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                                            <Compass size={10} /> Camera Movement
                                        </label>
                                        <div className="flex flex-wrap gap-1">
                                            {cameraMovements.map((move) => {
                                                const isSelected = studioControls.cameraMovement === move;
                                                return (
                                                    <button
                                                        key={move}
                                                        onClick={() => setStudioControls({ cameraMovement: move })}
                                                        className={`px-2 py-0.5 rounded-lg text-[8.5px] font-bold uppercase border transition-all ${isSelected
                                                            ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                                            : 'bg-white/3 border-white/8 text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {move}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Motion Strength — Fixed Inline Segmented Group */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                                Motion Strength
                                            </label>
                                            <span className="text-[9.5px] font-mono font-extrabold text-green-400">
                                                {Math.round(studioControls.motionStrength * 100)}%
                                            </span>
                                        </div>
                                        <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8">
                                            {[
                                                { label: 'Subtle', val: 0.3 },
                                                { label: 'Cinematic', val: 0.7 },
                                                { label: 'Dynamic', val: 0.95 }
                                            ].map((preset) => {
                                                const isSelected = Math.abs(studioControls.motionStrength - preset.val) < 0.05;
                                                return (
                                                    <button
                                                        key={preset.label}
                                                        onClick={() => setStudioControls({ motionStrength: preset.val })}
                                                        className={`px-2 py-0.5 rounded-lg text-[8.5px] font-bold uppercase border transition-all ${isSelected
                                                            ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-white'}`}
                                                    >
                                                        {preset.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Advanced Config (Always Visible, Fixed-Size Controls) */}
                        <div className="lg:col-span-6 flex flex-col gap-2.5 rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-xs">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('advanced')}
                                    className="text-[9.5px] uppercase font-extrabold tracking-wider text-white flex items-center gap-1.5"
                                >
                                    <Settings2 size={10} className="text-dept-creative" />
                                    Advanced Config
                                </button>
                                <span className="text-[8.5px] font-mono uppercase tracking-wider text-gray-500">
                                    Engine & Output
                                </span>
                            </div>

                            {/* Row 1: Output Size / Resolution + API Engine Grade (Compact Fixed Pills) */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                {mode === 'video' ? (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                            Engine Resolution Preset
                                        </label>
                                        <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                            {['720p', '1080p', '4k'].map((res) => {
                                                const isSelected = studioControls.resolution === res;
                                                return (
                                                    <button
                                                        key={res}
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        onClick={() => setStudioControls({ resolution: res as any })}
                                                        className={`min-w-[48px] px-2 py-0.5 rounded-lg text-[9.5px] font-bold uppercase border transition-all ${isSelected
                                                            ? 'bg-white/10 border-white/25 text-white font-extrabold shadow-sm'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {res}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                            Image Output Size
                                        </label>
                                        <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                            {(studioControls.model === 'fast' ? ['0.5K', '1K', '2K'] : ['1K', '2K', '4K']).map((size) => {
                                                const isSelected = (studioControls.imageSize || '2K') === size;
                                                return (
                                                    <button
                                                        key={size}
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        onClick={() => setStudioControls({ imageSize: size as any })}
                                                        className={`min-w-[46px] px-2 py-0.5 rounded-lg text-[9.5px] font-bold uppercase border transition-all ${isSelected
                                                            ? 'bg-white/10 border-white/25 text-white font-extrabold shadow-sm'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {size}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1">
                                    <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                        API Engine Grade
                                    </label>
                                    <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                        {['fast', 'pro'].map((tier) => {
                                            const isSelected = studioControls.model === tier
                                                || (tier === 'fast' && studioControls.model === 'lite');
                                            return (
                                                <button
                                                    key={tier}
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    onClick={() => setStudioControls({ model: tier as any })}
                                                    className={`min-w-[52px] px-2.5 py-0.5 rounded-lg text-[9.5px] font-bold uppercase border transition-all ${isSelected
                                                        ? 'bg-white/10 border-white/25 text-white font-extrabold shadow-sm'
                                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                >
                                                    {tier}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {mode === 'image' && (
                                <>
                                    {/* Row 2: Thinking Level + Batch Count + Response Format */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                                Thinking Level
                                            </label>
                                            <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                                {(studioControls.model === 'fast' ? ['none', 'minimal', 'high'] : ['high']).map((level) => (
                                                    <button
                                                        key={level}
                                                        data-testid={`direct-thinking-${level}`}
                                                        onClick={() => setStudioControls({ thinkingLevel: level as 'none' | 'minimal' | 'high' })}
                                                        className={`min-w-[48px] px-2 py-0.5 rounded-lg text-[8.5px] font-bold uppercase border transition-all ${studioControls.thinkingLevel === level || (studioControls.model === 'pro' && level === 'high')
                                                            ? 'bg-green-500/15 border-green-500/40 text-green-300'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {studioControls.model === 'pro' ? 'High' : level}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                                Image Count
                                            </label>
                                            <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                                {[1, 2, 3, 4].map(count => (
                                                    <button
                                                        key={count}
                                                        data-testid={`direct-batch-${count}`}
                                                        onClick={() => setStudioControls({ batchCount: count })}
                                                        className={`min-w-[32px] px-1.5 py-0.5 rounded-lg text-[8.5px] font-bold border transition-all ${studioControls.batchCount === count
                                                            ? 'bg-white/10 border-white/25 text-white'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {count}×
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9.5px] uppercase font-bold text-gray-400 tracking-wider">
                                                Response
                                            </label>
                                            <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/8 w-fit">
                                                {([
                                                    ['image_only', 'Image'],
                                                    ['image_and_text', '+ Text'],
                                                ] as const).map(([format, label]) => (
                                                    <button
                                                        key={format}
                                                        data-testid={`direct-response-${format}`}
                                                        onClick={() => setStudioControls({ responseFormat: format })}
                                                        className={`min-w-[48px] px-2 py-0.5 rounded-lg text-[8.5px] font-bold uppercase border transition-all ${studioControls.responseFormat === format
                                                            ? 'bg-white/10 border-white/25 text-white'
                                                            : 'bg-transparent border-transparent text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Compact Toggles (Grounding & Thought Summary) */}
                                    <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                                        <div className="flex flex-col gap-1.5 bg-black/30 px-2.5 py-1.5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Globe size={12} className="text-gray-400 shrink-0" />
                                                    <div>
                                                        <h4 className="text-[9.5px] font-bold text-white">Google Search Grounding</h4>
                                                        <p className="text-[8.5px] text-gray-500">Injects current web knowledge</p>
                                                    </div>
                                                </div>
                                                <button
                                                    aria-label="Toggle Google Search grounding"
                                                    data-testid="direct-google-search-toggle"
                                                    onClick={() => setStudioControls({
                                                        useGrounding: !studioControls.useGrounding,
                                                        useImageSearch: studioControls.useGrounding ? false : studioControls.useImageSearch,
                                                    })}
                                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors shrink-0 ${studioControls.useGrounding ? 'bg-dept-creative' : 'bg-white/10'}`}
                                                >
                                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${studioControls.useGrounding ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                            {studioControls.useGrounding && studioControls.model === 'fast' && (
                                                <div className="flex justify-between items-center border-t border-white/5 pt-1.5">
                                                    <div>
                                                        <h4 className="text-[9.5px] font-bold text-white">Include Image Search</h4>
                                                        <p className="text-[8.5px] text-gray-500">Use visual search results as grounding</p>
                                                    </div>
                                                    <button
                                                        aria-label="Toggle Image Search grounding"
                                                        data-testid="direct-image-search-toggle"
                                                        onClick={() => setStudioControls({ useImageSearch: !studioControls.useImageSearch })}
                                                        className={`w-8 h-4 rounded-full p-0.5 transition-colors shrink-0 ${studioControls.useImageSearch ? 'bg-cyan-500' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${studioControls.useImageSearch ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            data-testid="direct-include-thoughts-toggle"
                                            onClick={() => setStudioControls({ includeThoughts: !studioControls.includeThoughts })}
                                            className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition-all ${studioControls.includeThoughts
                                                ? 'border-green-500/30 bg-green-500/10 text-green-200'
                                                : 'border-white/5 bg-black/30 text-gray-400'}`}
                                        >
                                            <span>
                                                <span className="block text-[9.5px] font-bold uppercase">Return thought summary</span>
                                                <span className="block text-[8.5px] text-gray-500">Stores the provider summary with the generated asset</span>
                                            </span>
                                            <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/5">{studioControls.includeThoughts ? 'On' : 'Off'}</span>
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Video-only Safety Policy Grade */}
                            {mode === 'video' && (
                                <div className="flex flex-col gap-1.5 bg-black/30 px-2.5 py-1.5 rounded-xl border border-white/5 mt-0.5">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Shield size={12} className="text-gray-400" />
                                            <div>
                                                <h4 className="text-[9.5px] font-bold text-white">Safety Policy Grade</h4>
                                                <p className="text-[8.5px] text-gray-500">Filters adult or unsafe contents</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setStudioControls({
                                                personGeneration: studioControls.personGeneration === 'allow_adult' ? 'dont_allow' : 'allow_adult'
                                            })}
                                            className={`px-2 py-0.5 rounded-lg text-[8.5px] font-extrabold uppercase border transition-all ${studioControls.personGeneration === 'allow_adult'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                                        >
                                            {studioControls.personGeneration === 'allow_adult' ? 'Standard' : 'Strict'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom docked capsule for input & prompt builder */}
                <div className="flex flex-col gap-2 mt-3 z-10 pt-2 border-t border-white/5 bg-[#0a090c]/40">
                    
                    {/* Brand & Prompt Additives Menu — Drawn directly from brand kit preferences + tracked frequent descriptors */}
                    <BrandPromptAdditivesMenu
                        onSelectAdditive={(tag) => {
                            setLocalPrompt(localPrompt ? `${localPrompt}, ${tag}` : tag);
                        }}
                    />

                    {/* Integrated Reference Dropzone inline */}
                    {mode === 'video' && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="overflow-hidden mb-1"
                        >
                            <IngredientDropZone 
                                ingredients={mappedIngredients} 
                                onChange={handleIngredientsChange} 
                                mode="reference" 
                            />
                            <div data-testid="video-input-summary" className="mt-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[10px] text-gray-400">
                                <span className="mr-2 font-bold uppercase tracking-wider text-gray-500">Render inputs</span>
                                {videoInputSummary.join(' · ')}
                            </div>
                        </motion.div>
                    )}

                    {/* Prompt input capsule */}
                    <div className="flex flex-col bg-[#111014] border border-white/6 rounded-2xl p-2 relative shadow-2xl">
                        <textarea
                            value={localPrompt}
                            onChange={(e) => setLocalPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleGenerate();
                                }
                            }}
                            placeholder={`Describe your ${mode}...`}
                            disabled={isGenerating}
                            rows={2}
                            data-testid="direct-prompt-input"
                            className="w-full bg-transparent border-none text-xs text-white placeholder-gray-500 focus:ring-0 focus:outline-none resize-none px-2 py-1 no-scrollbar"
                        />

                        {/* Expandable synthesized prompt */}
                        {hasWhiskModifiers && (
                            <div className="mx-2 mb-2 px-2.5 py-1.5 bg-white/2 border border-white/5 rounded-lg text-left">
                                <p className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Synthesized Output Prompt</p>
                                <p className="text-[10px] text-gray-400 italic line-clamp-2">{synthesizedPrompt}</p>
                            </div>
                        )}

                        {/* Jev System One Smart Mode Suggestion */}
                        {promptModeVerdict && (
                            <div 
                                data-testid="jev-prompt-mode-suggestion"
                                className="mx-2 mb-2 px-3 py-1.5 bg-dept-creative/10 border border-dept-creative/30 rounded-xl flex items-center justify-between gap-2 text-left animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Wand2 size={12} className="text-dept-creative shrink-0 animate-pulse" />
                                    <span className="text-[11px] text-gray-200 truncate">
                                        Prompt matches <strong className="text-white">{promptModeVerdict.suggestedMode.charAt(0).toUpperCase() + promptModeVerdict.suggestedMode.slice(1)} Studio</strong> ({Math.round(promptModeVerdict.confidence * 100)}% match)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (promptModeVerdict.suggestedMode === 'omni') {
                                            setViewMode('omni');
                                        } else {
                                            handleModeSwitch(promptModeVerdict.suggestedMode as 'image' | 'video');
                                        }
                                        setPromptModeVerdict(null);
                                    }}
                                    data-testid="jev-switch-mode-btn"
                                    className="px-2.5 py-1 bg-dept-creative/20 hover:bg-dept-creative/40 text-dept-creative hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1"
                                >
                                    <span>Switch</span>
                                </button>
                            </div>
                        )}

                        <div className="flex justify-between items-center px-1 border-t border-white/5 pt-2">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={togglePromptBuilder}
                                    data-testid="toggle-prompt-builder"
                                    className="p-1 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
                                    title={isPromptBuilderOpen ? 'Hide Assistant Tags' : 'Show Assistant Tags'}
                                >
                                    {isPromptBuilderOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <span className="text-[9px] text-gray-600 uppercase font-mono font-extrabold px-2 select-none">
                                    {studioControls.model.toUpperCase()}
                                </span>
                            </div>

                            <button
                                onClick={handleGenerate}
                                data-testid="direct-generate-btn"
                                disabled={isGenerating || !localPrompt.trim()}
                                className={`py-1.5 px-4 flex items-center gap-1.5 rounded-xl font-bold uppercase transition-all duration-300 relative shadow-lg ${
                                    isGenerating 
                                        ? 'bg-white/10 text-white/50 cursor-not-allowed'
                                        : !localPrompt.trim()
                                            ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                            : 'bg-white text-black hover:bg-white/90 shadow-white/3 active:scale-95'
                                }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin text-white" />
                                        <span className="text-[9px] tracking-wider text-white">Rendering</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={12} />
                                        <span className="text-[9px] tracking-wider">Generate</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Generation Results & Active Jobs */}
            <div data-testid="direct-generation-results" className="min-w-0 w-full max-w-4xl mx-auto px-5 pb-3">
                {activeJobs.length > 0 && (
                    <div className="flex flex-col gap-3 mb-4">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" />
                            In-Flight Generation
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeJobs.map((job) => (
                                <VideoGenerationProgress key={job.id} job={job} onCancel={cancelJob} />
                            ))}
                        </div>
                    </div>
                )}
                {latestItem && (
                    <section aria-label="Latest asset" className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden" data-testid={`direct-result-${latestItem.id}`}>
                        <div className="flex flex-wrap items-center gap-2 p-2">
                            <button
                                type="button"
                                onClick={() => setPreviewedAssetId(isAssetPreviewOpen ? null : latestItem.id)}
                                aria-label={isAssetPreviewOpen ? 'Hide asset preview' : 'Preview latest asset'}
                                aria-expanded={isAssetPreviewOpen}
                                aria-controls={`asset-preview-${latestItem.id}`}
                                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/40 border border-white/10 hover:border-dept-creative/50 focus-visible:ring-2 focus-visible:ring-dept-creative"
                            >
                                {latestItem.type === 'image' ? (
                                    <img src={latestItem.thumbnailUrl || latestItem.url} alt="" className="h-full w-full object-cover" />
                                ) : <Film size={18} className="m-auto text-gray-400" />}
                            </button>
                            <div className="min-w-[80px] flex-1">
                                <div className="text-[10px] font-semibold text-gray-500">Latest {latestItem.type}</div>
                                <p className="truncate text-xs text-gray-300" title={latestItem.prompt}>{latestItem.prompt || 'Untitled asset'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                    type="button"
                                    aria-label={latestItem.type === 'image' ? 'Open in Canvas Editor' : 'Edit latest video'}
                                    onClick={() => {
                                        if (latestItem.type === 'video') {
                                            setSelectedItem(latestItem);
                                            setViewMode('editor');
                                            return;
                                        }
                                        void import('@/services/storage/resolveStorageUrl').then(async ({ resolveStorageUrl }) => {
                                            const src = await resolveStorageUrl(latestItem.url);
                                            if (src.startsWith('gs://')) throw new Error('The image could not be opened from storage');
                                            const { currentProjectId, openImage } = useStore.getState();
                                            openImage(src, currentProjectId ?? 'project_default');
                                        }).catch(failure => toast.error(failure instanceof Error ? failure.message : 'The image could not be opened'));
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg bg-dept-creative/15 px-3 py-2 text-[10px] font-semibold text-dept-creative hover:bg-dept-creative/25"
                                >
                                    <Settings2 size={12} /> Edit
                                </button>
                                {mode === 'video' && videoClipCount >= 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('video_production')}
                                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-[10px] text-gray-300 hover:bg-white/10"
                                    >
                                        <Film size={12} /> Timeline
                                    </button>
                                )}
                                <button
                                    type="button"
                                    aria-label="Open Project Assets"
                                    title="Project Assets"
                                    onClick={async () => {
                                        const { useStore } = await import('@/core/store');
                                        useStore.getState().setRightPanelTab('assets');
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                                >
                                    <Layers size={14} /><span className="hidden sm:inline text-[10px]">Assets</span>
                                </button>
                                <DropdownMenu>
                                    <DropdownMenuTriggerButton aria-label="More asset actions" className="p-2">
                                        <MoreHorizontal size={14} />
                                    </DropdownMenuTriggerButton>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => {
                                            pinToClipboard({
                                                id: latestItem.id,
                                                url: latestItem.url,
                                                prompt: latestItem.prompt || 'Direct Asset',
                                                type: latestItem.type as 'image' | 'video',
                                                timestamp: Date.now(),
                                            });
                                            toast.success('Pinned to Creative Clipboard!');
                                        }}>
                                            <Pin size={12} /> Pin to visual clipboard
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => {
                                            void (async () => {
                                                try {
                                                    if (!latestItem.url) {
                                                        toast.error('This asset is not ready to download yet.');
                                                        return;
                                                    }
                                                    const { resolveStorageUrl } = await import('@/services/storage/resolveStorageUrl');
                                                    const { downloadAsset } = await import('@/utils/download');
                                                    const resolvedUrl = await resolveStorageUrl(latestItem.url);
                                                    if (!resolvedUrl) {
                                                        toast.error('This asset is not ready to download yet.');
                                                        return;
                                                    }
                                                    const ext = latestItem.type === 'video' ? 'mp4' : 'png';
                                                    const started = await downloadAsset(resolvedUrl, `${latestItem.type}_${latestItem.id}.${ext}`);
                                                    if (!started) {
                                                        toast.error('Could not start the download. Try again.');
                                                        return;
                                                    }
                                                    toast.info('Download started. Check your browser downloads.');
                                                } catch {
                                                    toast.error('Could not start the download. Try again.');
                                                }
                                            })();
                                        }}>
                                            <Download size={12} /> Download asset
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        {isAssetPreviewOpen && (
                            <div id={`asset-preview-${latestItem.id}`} className="border-t border-white/5 bg-black/30 p-3">
                                {latestItem.type === 'video' ? (
                                    <CreativeVideoPlayer jobId={latestItem.url ? undefined : latestItem.id} url={latestItem.url || undefined} autoPlay={false} className="max-h-64 mx-auto" />
                                ) : (
                                    <img src={latestItem.url} alt={latestItem.prompt || 'Latest generated image'} className="mx-auto max-h-64 max-w-full rounded-lg object-contain" />
                                )}
                            </div>
                        )}
                    </section>
                )}
            </div>


        </div>
    );
}
