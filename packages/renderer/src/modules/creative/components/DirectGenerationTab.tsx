import React, { useState } from 'react';
import { 
    Loader2, Image as ImageIcon, Video, Send, Settings2, Download, 
    ChevronDown, ChevronUp, Film, Sparkles, Cpu, Wand2, Globe, Shield, RefreshCw, Layers, Compass, Pin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IngredientDropZone } from './IngredientDropZone';
import { CreativeVideoPlayer } from './CreativeVideoPlayer';
import { IntelligencePromptInput } from './veo/IntelligencePromptInput';
import { useDirectGeneration } from '../hooks/useDirectGeneration';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { VideoGenerationProgress } from './veo/VideoGenerationProgress';
import { WhiskService } from '@/services/WhiskService';
import { useToast } from '@/core/context/ToastContext';

export default function DirectGenerationTab() {
    const toast = useToast();
    const { 
        setGenerationMode, 
        isPromptBuilderOpen, 
        togglePromptBuilder, 
        whiskState,
        setStudioControls,
        pinToClipboard
    } = useStore(useShallow(state => ({
        setGenerationMode: state.setGenerationMode,
        isPromptBuilderOpen: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder,
        whiskState: state.whiskState,
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

    const [activeSection, setActiveSection] = useState<'basics' | 'advanced'>('basics');

    const videoClipCount = results.filter(r => r.type === 'video').length;

    const synthesizedPrompt = localPrompt.trim() 
        ? (mode === 'image' 
            ? WhiskService.synthesizeWhiskPrompt(localPrompt, whiskState)
            : WhiskService.synthesizeVideoPrompt(localPrompt, whiskState))
        : '';
    const hasWhiskModifiers = synthesizedPrompt !== localPrompt && synthesizedPrompt.length > 0;

    const quickModifiers = [
        'Cinematic Lighting',
        '8k Photorealistic',
        'Watercolor Vibe',
        'Cyberpunk Neo-Noir',
        'Leica SL2 50mm',
        'Analog Film Grain',
        '3D Octane Render',
        'Surrealist Dream'
    ];

    const aspectRatios = [
        { id: '1:1', label: 'Square', desc: 'Cover Art / Social', w: 'w-6', h: 'h-6' },
        { id: '16:9', label: 'Cinema', desc: 'YouTube / Widescreen', w: 'w-8', h: 'h-4.5' },
        { id: '9:16', label: 'Vertical', desc: 'TikTok / Canvas', w: 'w-4.5', h: 'h-8' },
        { id: '4:3', label: 'Classic', desc: 'Traditional NTSC', w: 'w-7', h: 'h-5.25' },
        { id: '3:4', label: 'Portrait', desc: 'Editorial / Poster', w: 'w-5.25', h: 'h-7' }
    ] as const;

    const cameraMovements = [
        'Static',
        'Pan Left',
        'Pan Right',
        'Zoom In',
        'Zoom Out',
        'Dynamic Tilt',
        'Orbiting Sweep'
    ] as const;

    const durationOptions = [4, 6, 8, 10] as const;

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-[#050406] text-foreground select-none overflow-hidden">
            {/* LEFT COLUMN: Premium Glassmorphic Control Console */}
            <div className="w-full md:w-[38%] border-b md:border-b-0 md:border-r border-white/5 bg-[#0a090c]/80 backdrop-blur-3xl p-6 flex flex-col justify-between overflow-y-auto shrink-0 select-none h-full relative">
                
                {/* Glowing subtle top gradient mesh for a premium look */}
                <div className="absolute top-0 left-0 right-0 h-40 bg-radial-gradient from-dept-creative/10 to-transparent pointer-events-none" />

                <div className="flex flex-col gap-6 z-10">
                    {/* Console Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-dept-creative/10 border border-dept-creative/20 text-dept-creative shadow-[0_0_12px_rgba(var(--color-dept-creative-rgb),0.1)]">
                                <Wand2 size={16} />
                            </div>
                            <div>
                                <h2 className="text-xs uppercase font-extrabold tracking-widest text-white/90">Creative Hub</h2>
                                <p className="text-[10px] text-gray-500 font-medium">Bypass Autonomous Swarms</p>
                            </div>
                        </div>
                        {/* Dynamic Active Model Status Badge */}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-wider">
                                {mode === 'image' 
                                    ? (studioControls.model === 'pro' ? 'Nano Banana Pro' : 'Nano Banana 2') 
                                    : 'Veo 3.1'}
                            </span>
                        </div>
                    </div>

                    {/* Mode Toggle Tabs */}
                    <div className="flex bg-white/4 rounded-xl p-1 border border-white/5 shadow-inner">
                        <button
                            onClick={() => handleModeSwitch('image')}
                            data-testid="direct-image-mode-btn"
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-300 relative ${mode === 'image'
                                ? 'bg-gradient-to-r from-dept-creative/25 to-dept-creative/10 text-white border border-dept-creative/30 font-bold shadow-lg shadow-dept-creative/10'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/3'
                                }`}
                        >
                            <ImageIcon size={14} className={mode === 'image' ? 'text-dept-creative' : ''} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Image Creator</span>
                        </button>
                        <button
                            onClick={() => handleModeSwitch('video')}
                            data-testid="direct-video-mode-btn"
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-300 relative ${mode === 'video'
                                ? 'bg-gradient-to-r from-purple-500/25 to-pink-500/10 text-white border border-purple-500/30 font-bold shadow-lg shadow-purple-500/10'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/3'
                                }`}
                        >
                            <Video size={14} className={mode === 'video' ? 'text-purple-400' : ''} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Video Creator</span>
                        </button>
                    </div>

                    {/* Settings Navigation */}
                    <div className="flex gap-4 border-b border-white/5 pb-1">
                        <button 
                            onClick={() => setActiveSection('basics')}
                            className={`text-[10px] uppercase font-extrabold tracking-wider pb-1.5 transition-all relative ${activeSection === 'basics' ? 'text-white border-b border-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Basics
                        </button>
                        <button 
                            onClick={() => setActiveSection('advanced')}
                            className={`text-[10px] uppercase font-extrabold tracking-wider pb-1.5 transition-all relative ${activeSection === 'advanced' ? 'text-white border-b border-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Advanced Config
                        </button>
                    </div>

                    {/* Dynamic Configurations Panel */}
                    <div className="flex flex-col gap-5 min-h-[220px]">
                        {activeSection === 'basics' ? (
                            <>
                                {/* Aspect Ratio Cards */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                                        <Layers size={10} /> Choose Aspect Ratio
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {aspectRatios.map((ratio) => {
                                            const isSelected = studioControls.aspectRatio === ratio.id;
                                            return (
                                                <button
                                                    key={ratio.id}
                                                    onClick={() => setStudioControls({ aspectRatio: ratio.id })}
                                                    className={`p-2.5 rounded-xl border flex flex-col items-start gap-2.5 transition-all group ${isSelected 
                                                        ? 'bg-white/4 border-white/20 shadow-md shadow-white/3' 
                                                        : 'bg-white/2 border-white/5 hover:border-white/10 hover:bg-white/3'}`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="text-[11px] font-bold text-white/95">{ratio.label}</span>
                                                        <span className="text-[9px] font-mono text-gray-500 group-hover:text-gray-400 font-bold">{ratio.id}</span>
                                                    </div>
                                                    <div className="h-10 w-full flex items-center justify-center bg-black/35 rounded-lg border border-white/3">
                                                        <div className={`${ratio.w} ${ratio.h} border-2 ${isSelected ? 'border-dept-creative bg-dept-creative/10 shadow-[0_0_8px_rgba(var(--color-dept-creative-rgb),0.2)]' : 'border-gray-600'} rounded-sm transition-all`} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Dynamic Video Parameters */}
                                {mode === 'video' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col gap-4 border-t border-white/5 pt-4"
                                    >
                                        {/* Camera Motion Pills */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                                                <Compass size={10} /> Camera Movement
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {cameraMovements.map((move) => {
                                                    const isSelected = studioControls.cameraMovement === move;
                                                    return (
                                                        <button
                                                            key={move}
                                                            onClick={() => setStudioControls({ cameraMovement: move })}
                                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${isSelected
                                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                                                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                                                        >
                                                            {move}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Duration Preset pills */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                Sequence Duration
                                            </label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {durationOptions.map((dur) => {
                                                    const isSelected = studioControls.duration === dur;
                                                    return (
                                                        <button
                                                            key={dur}
                                                            onClick={() => setStudioControls({ duration: dur })}
                                                            className={`py-2 rounded-lg text-[10px] font-mono font-bold uppercase border transition-all ${isSelected
                                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                                                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/4'}`}
                                                        >
                                                            {dur}s
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Motion Strength slider preset cards */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                    Motion Strength
                                                </label>
                                                <span className="text-[10px] font-mono font-extrabold text-purple-400">{Math.round(studioControls.motionStrength * 100)}%</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
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
                                                            className={`py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${isSelected
                                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                                                                : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col gap-4 text-xs"
                            >
                                {/* Advanced configs */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Engine Resolution Preset</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {['720p', '1080p', '4k'].map((res) => {
                                            const isSelected = studioControls.resolution === res;
                                            return (
                                                <button
                                                    key={res}
                                                    onClick={() => setStudioControls({ resolution: res as any })}
                                                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${isSelected
                                                        ? 'bg-white/5 border-white/25 text-white font-extrabold shadow-sm'
                                                        : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                                >
                                                    {res}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">API Engine Grade</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {['lite', 'fast', 'pro'].map((tier) => {
                                            const isSelected = studioControls.model === tier;
                                            return (
                                                <button
                                                    key={tier}
                                                    onClick={() => setStudioControls({ model: tier as any })}
                                                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${isSelected
                                                        ? 'bg-white/5 border-white/25 text-white font-extrabold shadow-sm'
                                                        : 'bg-white/2 border-white/5 text-gray-500 hover:text-gray-300'}`}
                                                >
                                                    {tier}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Grounding Toggles */}
                                <div className="flex flex-col gap-2 bg-white/2 p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Globe size={13} className="text-gray-400" />
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white">Google Search Grounding</h4>
                                                <p className="text-[9px] text-gray-500">Injects real-time knowledge</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setStudioControls({ useGrounding: !studioControls.useGrounding })}
                                            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${studioControls.useGrounding ? 'bg-dept-creative' : 'bg-white/10'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${studioControls.useGrounding ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 bg-white/2 p-3 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Shield size={13} className="text-gray-400" />
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white">Safety Policy Grade</h4>
                                                <p className="text-[9px] text-gray-500">Filters adult or unsafe contents</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setStudioControls({ 
                                                personGeneration: studioControls.personGeneration === 'allow_adult' ? 'dont_allow' : 'allow_adult' 
                                            })}
                                            className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase border transition-all ${studioControls.personGeneration === 'allow_adult'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                                        >
                                            {studioControls.personGeneration === 'allow_adult' ? 'Standard' : 'Strict'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Bottom docked capsule for input & prompt builder */}
                <div className="flex flex-col gap-3 mt-6 z-10 pt-4 border-t border-white/5 bg-[#0a090c]/40">
                    
                    {/* Inline Modifiers Quick-list */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {quickModifiers.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setLocalPrompt(localPrompt ? `${localPrompt}, ${tag}` : tag)}
                                className="px-2 py-1 rounded-full bg-white/3 border border-white/5 text-[9px] text-gray-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap"
                            >
                                + {tag}
                            </button>
                        ))}
                    </div>

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
                            rows={3}
                            data-testid="direct-prompt-input"
                            className="w-full bg-transparent border-none text-xs text-white placeholder-gray-500 focus:ring-0 focus:outline-none resize-none px-2 py-1.5 no-scrollbar"
                        />

                        {/* Expandable synthesized prompt */}
                        {hasWhiskModifiers && (
                            <div className="mx-2 mb-2 px-2.5 py-1.5 bg-white/2 border border-white/5 rounded-lg text-left">
                                <p className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Synthesized Output Prompt</p>
                                <p className="text-[10px] text-gray-400 italic line-clamp-2">{synthesizedPrompt}</p>
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

            {/* RIGHT COLUMN: Spacious Visual Canvas & Results Gallery */}
            <div className="flex-1 bg-[#060507] p-8 overflow-y-auto flex flex-col justify-start relative select-none h-full">
                
                {/* mesh background accent */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-radial-gradient from-purple-900/10 to-transparent pointer-events-none filter blur-3xl" />

                {results.length === 0 && activeJobs.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="h-full w-full flex flex-col items-center justify-center text-center max-w-lg mx-auto"
                    >
                        <div className="relative mb-6">
                            {/* Glowing animated orb */}
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-dept-creative via-purple-500 to-pink-500 opacity-20 blur-xl animate-pulse" />
                            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center text-dept-creative shadow-2xl relative">
                                <Sparkles size={28} className="animate-bounce" />
                            </div>
                        </div>

                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">Direct Creative Canvas</h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-6">
                            Welcome to the Direct Generation Hub. Bypass autonomous orchestration algorithms to generate photorealistic release art and high-fidelity video canvases.
                        </p>

                        <div className="grid grid-cols-2 gap-4 w-full text-left">
                            <div className="p-3 bg-white/2 rounded-xl border border-white/5">
                                <h4 className="text-[10px] uppercase font-bold text-white mb-1">Text-to-Image</h4>
                                <p className="text-[9.5px] text-gray-500 leading-normal">Fast, high-fidelity cover arts, poster mockups, and visual merchandise concepts.</p>
                            </div>
                            <div className="p-3 bg-white/2 rounded-xl border border-white/5">
                                <h4 className="text-[10px] uppercase font-bold text-white mb-1">Text-to-Video</h4>
                                <p className="text-[9.5px] text-gray-500 leading-normal">Cinematic camera pans, high dynamic motion, and full Spotify vertical loops.</p>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full z-10">
                        {/* Interactive Gallery Header */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <div>
                                <h3 className="text-[11px] uppercase font-extrabold tracking-widest text-white/95">Studio Gallery</h3>
                                <p className="text-[9.5px] text-gray-500">Live assets generated during this session</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-2 py-0.5 bg-white/3 rounded-md text-[8.5px] font-mono text-gray-400 border border-white/5 font-bold uppercase">
                                    {results.length} Asset{results.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Grid container with spring animation */}
                        <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                            <AnimatePresence mode="popLayout">
                                {activeJobs.map((job) => (
                                    <VideoGenerationProgress key={job.id} job={job} onCancel={cancelJob} />
                                ))}
                                {results.filter(r => !activeJobs.some(j => j.id === r.id)).map((item) => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
                                        key={item.id}
                                        className="group relative aspect-square bg-white/2 rounded-2xl overflow-hidden border border-white/5 hover:border-white/15 hover:shadow-2xl hover:shadow-purple-500/5 transition-all cursor-pointer"
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
                                                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 border border-white/5 backdrop-blur-md flex items-center gap-1 pointer-events-none">
                                                    <Video size={9} className="text-purple-400" />
                                                    <span className="text-[8px] font-bold text-white uppercase tracking-widest font-mono">Video</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full relative">
                                                <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                                                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 border border-white/5 backdrop-blur-md flex items-center gap-1 pointer-events-none">
                                                    <ImageIcon size={9} className="text-emerald-400" />
                                                    <span className="text-[8px] font-bold text-white uppercase tracking-widest font-mono">Image</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hover Overlay styling */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-end">
                                            <p className="text-white text-[10px] leading-normal font-medium line-clamp-2 mb-3">{item.prompt}</p>
                                            <div className="flex justify-between items-center border-t border-white/10 pt-2">
                                                <span className="text-[8.5px] uppercase font-bold tracking-widest text-dept-creative">Open Editor</span>
                                                <div className="flex items-center gap-1.5">
                                                    <button 
                                                        aria-label="Pin to visual clipboard" 
                                                        className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-violet-400 hover:text-white hover:bg-violet-600/35 transition-colors" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            pinToClipboard({
                                                                id: item.id,
                                                                url: item.url,
                                                                prompt: item.prompt || 'Direct Asset',
                                                                type: item.type as 'image' | 'video',
                                                                timestamp: Date.now()
                                                            });
                                                            toast.success("Pinned to Creative Clipboard!");
                                                        }}
                                                    >
                                                        <Pin size={11} />
                                                    </button>
                                                    <button 
                                                        aria-label="Download asset" 
                                                        className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Simple download anchor logic
                                                            const a = document.createElement('a');
                                                            a.href = item.url;
                                                            a.download = `${item.type}_${item.id}.png`;
                                                            a.click();
                                                        }}
                                                    >
                                                        <Download size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </div>

            {/* Bottom sticky Premium Action Overlay */}
            <AnimatePresence>
                {results.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 right-6 border border-white/6 bg-[#0c0b0e]/90 backdrop-blur-xl p-4 flex justify-between items-center gap-6 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] z-50 select-none max-w-sm border-l-dept-creative border-l-2"
                    >
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Ready to Proceed?</h3>
                            <p className="text-[10px] text-gray-400 leading-normal">
                                {videoClipCount >= 2 
                                    ? `Mix your ${videoClipCount} generated clips in the production workflow.` 
                                    : "Edit and refine your asset in the Creative Editor."}
                            </p>
                        </div>
                        <button
                            data-testid="bottom-action-btn"
                            onClick={() => {
                                if (videoClipCount >= 2) {
                                    setGenerationMode('video');
                                    setViewMode('video_production');
                                } else {
                                    setSelectedItem(results[0] || null);
                                    setViewMode('editor');
                                }
                            }}
                            className="px-4 py-2 bg-white text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl hover:bg-gray-200 transition-colors shadow-lg flex items-center gap-1.5 shrink-0 active:scale-95 duration-200"
                        >
                            {videoClipCount >= 2 ? (
                                <>
                                    <Film size={12} />
                                    Produce
                                </>
                            ) : (
                                <>
                                    <Settings2 size={12} />
                                    Edit
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
