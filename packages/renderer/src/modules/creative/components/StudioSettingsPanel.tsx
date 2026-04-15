import React, { useCallback } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Monitor, Smartphone, Square, Zap, Brain, Sparkles,
    Shield, Eye, RotateCcw, ChevronLeft, ChevronRight
} from 'lucide-react';

interface CycleOption<T extends string> {
    value: T;
    label: string;
    sublabel?: string;
    icon?: React.ReactNode;
}

/**
 * A single-click cyclable control. Tap to advance to the next option.
 * Long-press or right-click shows all options inline.
 */
function CyclableControl<T extends string>({
    label,
    options,
    value,
    onChange,
    testId
}: {
    label: string;
    options: CycleOption<T>[];
    value: T;
    onChange: (val: T) => void;
    testId: string;
}) {
    const currentIdx = options.findIndex(o => o.value === value);
    const current = options[currentIdx] ?? options[0]!;

    const cycle = useCallback((direction: 1 | -1) => {
        const next = (currentIdx + direction + options.length) % options.length;
        onChange(options[next]!.value);
    }, [currentIdx, options, onChange]);

    return (
        <div className="group" data-testid={testId}>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => cycle(-1)}
                    className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={`Previous ${label}`}
                >
                    <ChevronLeft size={12} />
                </button>

                <button
                    onClick={() => cycle(1)}
                    data-testid={`${testId}-value`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                        bg-white/4 border border-white/8 hover:border-purple-500/30
                        hover:bg-purple-500/5 transition-all cursor-pointer select-none"
                >
                    {current.icon && <span className="text-purple-400">{current.icon}</span>}
                    <div className="text-center">
                        <div className="text-xs font-bold text-gray-200">{current.label}</div>
                        {current.sublabel && (
                            <div className="text-[9px] text-gray-500 mt-0.5">{current.sublabel}</div>
                        )}
                    </div>
                </button>

                <button
                    onClick={() => cycle(1)}
                    className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={`Next ${label}`}
                >
                    <ChevronRight size={12} />
                </button>
            </div>
            {/* Option dots */}
            <div className="flex justify-center gap-1 mt-1.5">
                {options.map((opt, i) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                            i === currentIdx
                                ? 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.5)]'
                                : 'bg-white/10 hover:bg-white/20'
                        }`}
                        aria-label={opt.label}
                    />
                ))}
            </div>
        </div>
    );
}

const RESOLUTION_OPTIONS: CycleOption<'720p' | '1080p' | '4k'>[] = [
    { value: '720p', label: '720p', sublabel: 'Fast preview', icon: <Monitor size={12} /> },
    { value: '1080p', label: '1080p', sublabel: 'Production', icon: <Monitor size={12} /> },
    { value: '4k', label: '4K', sublabel: 'Ultra quality', icon: <Monitor size={12} /> },
];

const ASPECT_RATIO_OPTIONS: CycleOption<'16:9' | '9:16'>[] = [
    { value: '16:9', label: '16:9', sublabel: 'Landscape', icon: <Monitor size={12} /> },
    { value: '9:16', label: '9:16', sublabel: 'Portrait', icon: <Smartphone size={12} /> },
];

const MODEL_OPTIONS: CycleOption<'fast' | 'pro'>[] = [
    { value: 'fast', label: 'Flash', sublabel: 'Speed optimized', icon: <Zap size={12} /> },
    { value: 'pro', label: 'Pro', sublabel: 'Quality optimized', icon: <Brain size={12} /> },
];

const PERSON_GEN_OPTIONS: CycleOption<'allow_adult' | 'dont_allow' | 'allow_all'>[] = [
    { value: 'allow_adult', label: 'Adults Only', sublabel: 'Default', icon: <Shield size={12} /> },
    { value: 'dont_allow', label: 'No People', sublabel: 'Objects/scenes', icon: <Square size={12} /> },
    { value: 'allow_all', label: 'All Ages', sublabel: 'Unrestricted', icon: <Eye size={12} /> },
];

const MEDIA_RES_OPTIONS: CycleOption<'low' | 'medium' | 'high'>[] = [
    { value: 'low', label: 'Low', sublabel: 'Fast input', icon: <Sparkles size={12} /> },
    { value: 'medium', label: 'Medium', sublabel: 'Balanced', icon: <Sparkles size={12} /> },
    { value: 'high', label: 'High', sublabel: 'Max detail', icon: <Sparkles size={12} /> },
];

export default function StudioSettingsPanel({ onClose }: { onClose: () => void }) {
    const { studioControls, setStudioControls, generationMode } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        generationMode: state.generationMode
    })));

    const resetDefaults = useCallback(() => {
        setStudioControls({
            resolution: '720p',
            aspectRatio: '16:9',
            model: 'fast',
            negativePrompt: '',
            seed: '',
            thinking: false,
            useGrounding: false,
            mediaResolution: 'medium',
            personGeneration: 'allow_adult',
        });
    }, [setStudioControls]);

    return (
        <div className="border-b border-white/6 bg-[#0a0a0f]/80 backdrop-blur-xl">
            <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                        Studio Settings
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetDefaults}
                            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-amber-400
                                px-2 py-0.5 rounded border border-white/6 hover:border-amber-500/30 transition-all"
                            data-testid="settings-reset-btn"
                        >
                            <RotateCcw size={10} />
                            Reset
                        </button>
                        <button
                            onClick={onClose}
                            className="text-[9px] text-gray-600 hover:text-gray-300 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <CyclableControl
                        label="Resolution"
                        options={RESOLUTION_OPTIONS}
                        value={studioControls.resolution}
                        onChange={(val) => setStudioControls({ resolution: val })}
                        testId="settings-resolution"
                    />

                    <CyclableControl
                        label="Aspect Ratio"
                        options={ASPECT_RATIO_OPTIONS}
                        value={studioControls.aspectRatio}
                        onChange={(val) => setStudioControls({ aspectRatio: val })}
                        testId="settings-aspect-ratio"
                    />

                    <CyclableControl
                        label="Model"
                        options={MODEL_OPTIONS}
                        value={studioControls.model}
                        onChange={(val) => setStudioControls({ model: val })}
                        testId="settings-model"
                    />

                    <CyclableControl
                        label="Person Generation"
                        options={PERSON_GEN_OPTIONS}
                        value={studioControls.personGeneration}
                        onChange={(val) => setStudioControls({ personGeneration: val })}
                        testId="settings-person-gen"
                    />

                    <CyclableControl
                        label="Input Resolution"
                        options={MEDIA_RES_OPTIONS}
                        value={studioControls.mediaResolution}
                        onChange={(val) => setStudioControls({ mediaResolution: val })}
                        testId="settings-media-res"
                    />
                </div>

                {/* Toggle Row */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/4">
                    <label className="flex items-center gap-2 cursor-pointer" data-testid="settings-thinking-toggle">
                        <input
                            type="checkbox"
                            checked={studioControls.thinking}
                            onChange={(e) => setStudioControls({ thinking: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-white/10 peer-checked:bg-purple-500/50 rounded-full relative transition-colors">
                            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-gray-400 peer-checked:bg-purple-300 rounded-full transition-all peer-checked:translate-x-3" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">Thinking</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer" data-testid="settings-grounding-toggle">
                        <input
                            type="checkbox"
                            checked={studioControls.useGrounding}
                            onChange={(e) => setStudioControls({ useGrounding: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-white/10 peer-checked:bg-blue-500/50 rounded-full relative transition-colors">
                            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-gray-400 peer-checked:bg-blue-300 rounded-full transition-all peer-checked:translate-x-3" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">Grounding</span>
                    </label>

                    {generationMode === 'video' && (
                        <label className="flex items-center gap-2 cursor-pointer" data-testid="settings-audio-toggle">
                            <input
                                type="checkbox"
                                checked={studioControls.generateAudio}
                                onChange={(e) => setStudioControls({ generateAudio: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-7 h-4 bg-white/10 peer-checked:bg-emerald-500/50 rounded-full relative transition-colors">
                                <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-gray-400 peer-checked:bg-emerald-300 rounded-full transition-all peer-checked:translate-x-3" />
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">Audio</span>
                        </label>
                    )}

                    {/* Negative Prompt */}
                    <div className="flex-1 min-w-0">
                        <input
                            type="text"
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            placeholder="Negative prompt..."
                            data-testid="settings-negative-prompt"
                            className="w-full bg-white/3 border border-white/6 rounded-md px-2.5 py-1
                                text-[10px] text-gray-300 placeholder:text-gray-600 focus:outline-none
                                focus:border-purple-500/30 transition-colors"
                        />
                    </div>

                    {/* Seed */}
                    <div className="w-20">
                        <input
                            type="text"
                            value={studioControls.seed}
                            onChange={(e) => setStudioControls({ seed: e.target.value.replace(/\D/g, '') })}
                            placeholder="Seed"
                            data-testid="settings-seed"
                            className="w-full bg-white/3 border border-white/6 rounded-md px-2.5 py-1
                                text-[10px] text-gray-300 placeholder:text-gray-600 font-mono text-center
                                focus:outline-none focus:border-purple-500/30 transition-colors"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
