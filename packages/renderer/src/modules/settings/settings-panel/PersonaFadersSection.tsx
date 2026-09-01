/**
 * Persona Faders Settings Section — AI Agent Personality & Posture Sliders
 *
 * Implements Phase T1.1–T1.3 of the Evolas Build Plan (docs/EVOLAS_BUILD_PLAN.md).
 * Lets artists configure professional posture sliders (Risk Tolerance, Brevity,
 * Directness, Formality, Reasoning Transparency) for each agent persona.
 *
 * Persisted to users/{uid}/personaFaders/{personaId} via PersonaFaderRepository.
 */

import React, { useEffect, useState } from 'react';
import {
    Sliders,
    RotateCcw,
    Save,
    Sparkles,
    FileText,
    Music,
    Megaphone,
    Truck,
    DollarSign,
    SlidersHorizontal,
    BookOpen,
    Check,
    LucideIcon,
} from 'lucide-react';
import {
    PERSONA_FADER_DEFAULT,
    type PersonaFaderAxis,
    type PersonaFaderValues,
    type PersonaId,
} from '@indii/shared';
import {
    loadPersonaFaderValues,
    savePersonaFaderValues,
    resetPersonaFaderValues,
} from '@/services/persona/PersonaFaderRepository';
import { compilePersonaPrompt } from '@/services/persona/PersonaPromptCompiler';
import { useToast } from '@/core/context/ToastContext';
import { SectionHeader } from './SettingsShared';
import { getColorForModule } from '@/core/theme/moduleColors';
import { logger } from '@/utils/logger';

interface PersonaMetadata {
    id: PersonaId;
    title: string;
    role: string;
    description: string;
    icon: LucideIcon;
    accentColor: string;
}

const PERSONA_LIST: PersonaMetadata[] = [
    {
        id: 'manager',
        title: 'Manager (Conductor)',
        role: 'Strategic Direction & Oversight',
        description: 'Guides career milestones, coordinates team resources, and manages overall project velocity.',
        icon: Sparkles,
        accentColor: 'text-amber-400',
    },
    {
        id: 'contractReader',
        title: 'Contract Reader',
        role: 'Deal Literacy & IP Clauses',
        description: 'Analyzes deal terms, flags copyright/recoupment risks, and explains legal jargon.',
        icon: FileText,
        accentColor: 'text-blue-400',
    },
    {
        id: 'aAndR',
        title: 'A&R Specialist',
        role: 'Music Quality & Sonic Direction',
        description: 'Evaluates track composition, vocal arrangements, key/BPM consistency, and market fit.',
        icon: Music,
        accentColor: 'text-purple-400',
    },
    {
        id: 'publicist',
        title: 'Publicist / PR',
        role: 'Media, Press & Brand Voice',
        description: 'Drafts press releases, coordinates PR campaigns, and shapes media outreach narratives.',
        icon: Megaphone,
        accentColor: 'text-pink-400',
    },
    {
        id: 'distributor',
        title: 'Distributor',
        role: 'DSP Ingestion & DDEX Delivery',
        description: 'Ensures DDEX XML standard compliance, validates UPC/ISRC codes, and schedules DSP delivery.',
        icon: Truck,
        accentColor: 'text-emerald-400',
    },
    {
        id: 'businessManager',
        title: 'Business Manager',
        role: 'Finances, Splits & Budgets',
        description: 'Calculates producer splits, tracks project budgets, and models streaming revenue.',
        icon: DollarSign,
        accentColor: 'text-green-400',
    },
    {
        id: 'producer',
        title: 'Producer / Audio Engineer',
        role: 'Mix, Master & Sonic Polish',
        description: 'Advises on dynamic range, LUFS standards, frequency masking, and mastering targets.',
        icon: SlidersHorizontal,
        accentColor: 'text-cyan-400',
    },
    {
        id: 'publisher',
        title: 'Publisher',
        role: 'PRO Registration & Sync Deals',
        description: 'Manages composition rights, sync licensing pitches, and performance royalty claims.',
        icon: BookOpen,
        accentColor: 'text-indigo-400',
    },
];

interface FaderAxisConfig {
    axis: PersonaFaderAxis;
    label: string;
    lowLabel: string;
    highLabel: string;
    description: string;
}

const AXIS_CONFIGS: FaderAxisConfig[] = [
    {
        axis: 'riskTolerance',
        label: 'Risk Tolerance',
        lowLabel: 'Conservative & Safe',
        highLabel: 'Bold & High-Upside',
        description: 'How aggressively the persona advises taking speculative vs. well-precedented career and financial moves.',
    },
    {
        axis: 'brevity',
        label: 'Brevity & Conciseness',
        lowLabel: 'Detailed & Exhaustive',
        highLabel: 'Terse & Direct',
        description: 'Length and density of responses — from comprehensive walkthroughs to concise bullet conclusions.',
    },
    {
        axis: 'directness',
        label: 'Directness & Candor',
        lowLabel: 'Gentle & Diplomatic',
        highLabel: 'Blunt & Unfiltered',
        description: 'Delivery style when presenting critical feedback, hard truths, or contract risks.',
    },
    {
        axis: 'formality',
        label: 'Formality & Register',
        lowLabel: 'Casual & Conversational',
        highLabel: 'Executive & Formal',
        description: 'Linguistic tone — from casual studio peer language to formal institutional precision.',
    },
    {
        axis: 'reasoningTransparency',
        label: 'Reasoning Transparency',
        lowLabel: 'Bottom-Line Only',
        highLabel: 'Full Step-by-Step Chain',
        description: 'Whether the persona explains the underlying calculations and logic or states only the final recommendation.',
    },
];

export const PersonaFadersSection: React.FC = () => {
    const toast = useToast();
    const moduleColor = getColorForModule('settings');

    const [selectedPersonaId, setSelectedPersonaId] = useState<PersonaId>('manager');
    const [faderValues, setFaderValues] = useState<PersonaFaderValues>({ ...PERSONA_FADER_DEFAULT });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showPromptPreview, setShowPromptPreview] = useState(false);

    // Load persisted faders when selecting a persona
    useEffect(() => {
        let isCurrent = true;
        setIsLoading(true);
        setHasUnsavedChanges(false);

        loadPersonaFaderValues(selectedPersonaId)
            .then((loaded) => {
                if (!isCurrent) return;
                setFaderValues(loaded);
            })
            .catch((err) => {
                if (!isCurrent) return;
                logger.error('[PersonaFadersSection] Failed to load fader values:', err);
                setFaderValues({ ...PERSONA_FADER_DEFAULT });
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, [selectedPersonaId]);

    const handleFaderChange = (axis: PersonaFaderAxis, value: number) => {
        const boundedValue = Math.max(0, Math.min(100, Math.round(value)));
        setFaderValues((prev) => ({
            ...prev,
            [axis]: boundedValue,
        }));
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await savePersonaFaderValues(selectedPersonaId, faderValues);
            setHasUnsavedChanges(false);
            toast.showToast(`Saved ${selectedPersona?.title} personality posture.`, 'success');
        } catch (err) {
            logger.error('[PersonaFadersSection] Failed to save fader values:', err);
            toast.showToast('Failed to save personality sliders. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        setIsSaving(true);
        try {
            await resetPersonaFaderValues(selectedPersonaId);
            setFaderValues({ ...PERSONA_FADER_DEFAULT });
            setHasUnsavedChanges(false);
            toast.showToast(`Reset ${selectedPersona?.title} back to default posture.`, 'info');
        } catch (err) {
            logger.error('[PersonaFadersSection] Failed to reset fader values:', err);
            toast.showToast('Failed to reset personality sliders.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedPersona = PERSONA_LIST.find((p) => p.id === selectedPersonaId) || PERSONA_LIST[0]!;
    const SelectedIcon = selectedPersona.icon;

    // Compiled prompt preview
    let compiledPrompt = '';
    try {
        compiledPrompt = compilePersonaPrompt(faderValues);
    } catch {
        compiledPrompt = 'Unable to compile preview.';
    }

    return (
        <div className="space-y-6" data-testid="persona-faders-section">
            <SectionHeader
                title="AI Persona & Personality Sliders"
                description="Customize how each specialist agent thinks, communicates, and delivers advice. Calibrated along 5 professional posture axes."
            />

            {/* Persona Selector Strip */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                {PERSONA_LIST.map((persona) => {
                    const Icon = persona.icon;
                    const isSelected = persona.id === selectedPersonaId;
                    return (
                        <button
                            key={persona.id}
                            onClick={() => setSelectedPersonaId(persona.id)}
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                                isSelected
                                    ? 'bg-slate-800 text-white border-slate-600 shadow-md shadow-black/40 ring-1 ring-white/10'
                                    : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200'
                            }`}
                        >
                            <Icon size={14} className={persona.accentColor} />
                            <span>{persona.title}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active Persona Header Card */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                        <SelectedIcon size={20} className={selectedPersona.accentColor} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{selectedPersona.title}</h3>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                                {selectedPersona.role}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{selectedPersona.description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={handleReset}
                        disabled={isLoading || isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
                        title="Reset this persona back to population default positions (50/50/50/50/50)"
                    >
                        <RotateCcw size={13} />
                        Reset Defaults
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || isSaving || !hasUnsavedChanges}
                        className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
                            hasUnsavedChanges
                                ? `${moduleColor.bg} text-white hover:opacity-90 shadow-green-900/20`
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                    >
                        {isSaving ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : hasUnsavedChanges ? (
                            <Save size={13} />
                        ) : (
                            <Check size={13} className="text-emerald-400" />
                        )}
                        {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Posture' : 'Saved'}
                    </button>
                </div>
            </div>

            {/* Sliders Grid */}
            <div className="space-y-4">
                {AXIS_CONFIGS.map((config) => {
                    const val = faderValues[config.axis] ?? 50;
                    return (
                        <div
                            key={config.axis}
                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <label
                                    htmlFor={`fader-${config.axis}`}
                                    className="text-xs font-bold text-slate-200 flex items-center gap-2"
                                >
                                    <span>{config.label}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                        {val} / 100
                                    </span>
                                </label>
                                <span className="text-[11px] font-medium text-slate-400">
                                    {val <= 20
                                        ? 'Band 1: Very Low'
                                        : val <= 40
                                        ? 'Band 2: Low-Mid'
                                        : val <= 60
                                        ? 'Band 3: Balanced'
                                        : val <= 80
                                        ? 'Band 4: Mid-High'
                                        : 'Band 5: Very High'}
                                </span>
                            </div>

                            <p className="text-[11px] text-slate-400 mb-3">{config.description}</p>

                            {/* Slider input */}
                            <div className="space-y-1.5">
                                <input
                                    id={`fader-${config.axis}`}
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={val}
                                    disabled={isLoading || isSaving}
                                    onChange={(e) => handleFaderChange(config.axis, Number(e.target.value))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                    <span>← {config.lowLabel}</span>
                                    <span>{config.highLabel} →</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Prompt Compiler Preview Drawer */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Sliders size={13} className="text-emerald-400" />
                        <span className="font-semibold">Live Compiled Persona Posture (Under the Hood)</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {showPromptPreview ? 'Hide Details' : 'Inspect Prompt Block'}
                    </span>
                </button>

                {showPromptPreview && (
                    <div className="p-4 border-t border-slate-800/80 bg-slate-950 text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all">
                        {compiledPrompt}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonaFadersSection;
