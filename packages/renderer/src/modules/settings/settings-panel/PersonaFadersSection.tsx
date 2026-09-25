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
    Bot,
    Zap,
    Users,
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
import {
    judgePersonaPosturePreset,
    type PersonaPosturePreset,
    PERSONA_POSTURE_FADER_MAP,
} from '@/config/typesafeJudgments';
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

interface PostureArchetypeMetadata {
    id: PersonaPosturePreset;
    label: string;
    icon: string;
    description: string;
}

const POSTURE_ARCHETYPES: PostureArchetypeMetadata[] = [
    {
        id: 'MAJOR_LABEL_SHARK',
        label: 'Major Label Shark',
        icon: '🦈',
        description: 'Aggressive commercial dealmaker focusing on maximum leverage and scale.',
    },
    {
        id: 'SCRAPPY_INDIE_DIY',
        label: 'Scrappy Indie DIY',
        icon: '🎸',
        description: 'Ownership-first ally emphasizing fan community, rights retention, and independence.',
    },
    {
        id: 'NURTURING_MENTOR',
        label: 'Nurturing Mentor',
        icon: '🧑‍🏫',
        description: 'Encouraging educational guide explaining industry mechanics patiently step-by-step.',
    },
    {
        id: 'ACADEMIC_PURIST',
        label: 'Academic Purist',
        icon: '📐',
        description: 'Deep technical rigor in acoustics, copyright statutory law, and precision.',
    },
    {
        id: 'STREET_HUSTLER',
        label: 'Street Hustler',
        icon: '⚡',
        description: 'Fast, terse, viral street marketing with unfiltered blunt truth.',
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

    // Jev Auto-Calibrator State
    const [showJevCalibrator, setShowJevCalibrator] = useState(false);
    const [jevPhilosophy, setJevPhilosophy] = useState('');
    const [jevRisk, setJevRisk] = useState<'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>('MODERATE');
    const [jevStyle, setJevStyle] = useState<'FORMAL' | 'CASUAL' | 'BLUNT'>('CASUAL');
    const [isJevCalibrating, setIsJevCalibrating] = useState(false);

    // Autonomous Evolution State
    const [isAutonomousEvolution, setIsAutonomousEvolution] = useState(() => {
        try {
            return localStorage.getItem('indii_persona_autonomous_evolution') === 'true';
        } catch {
            return false;
        }
    });

    const handleToggleAutonomousEvolution = () => {
        setIsAutonomousEvolution((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('indii_persona_autonomous_evolution', String(next));
            } catch (err) {
                logger.warn('Failed to persist autonomous evolution preference:', err);
            }
            toast.showToast(
                next ? 'Autonomous personality evolution enabled.' : 'Autonomous personality evolution disabled.',
                'info'
            );
            return next;
        });
    };

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

    const handleApplyArchetype = (preset: PersonaPosturePreset) => {
        const archetypeFaders = PERSONA_POSTURE_FADER_MAP[preset];
        if (archetypeFaders) {
            setFaderValues({ ...archetypeFaders });
            setHasUnsavedChanges(true);
            toast.showToast(`Applied ${preset.replace(/_/g, ' ')} posture to ${selectedPersona.title}.`, 'info');
        }
    };

    const handleApplyToAllPersonas = async () => {
        setIsSaving(true);
        try {
            await Promise.all(
                PERSONA_LIST.map((p) => savePersonaFaderValues(p.id, faderValues))
            );
            setHasUnsavedChanges(false);
            toast.showToast('Synchronized all 40 sliders across all 8 boardroom personas.', 'success');
        } catch (err) {
            logger.error('[PersonaFadersSection] Failed to sync all personas:', err);
            toast.showToast('Failed to apply posture across all personas.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunJevCalibration = async () => {
        if (!jevPhilosophy.trim()) {
            toast.showToast('Please describe your management philosophy or goals.', 'warning');
            return;
        }

        setIsJevCalibrating(true);
        try {
            const verdict = await judgePersonaPosturePreset({
                philosophyDescription: jevPhilosophy,
                riskTolerance: jevRisk,
                communicationStyle: jevStyle,
            });

            setFaderValues({ ...verdict.calibratedFaders });
            setHasUnsavedChanges(true);
            toast.showToast(
                `Jev AI Calibrated: ${verdict.recommendedPreset.replace(/_/g, ' ')} (Score: ${verdict.alignmentScore}/5)`,
                'success'
            );
        } catch (err) {
            logger.error('[PersonaFadersSection] Jev posture calibration error:', err);
            toast.showToast('Jev calibration encountered an error.', 'error');
        } finally {
            setIsJevCalibrating(false);
        }
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

            {/* Posture Archetypes Quick-Apply Strip (Judgment 53) */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Management Posture Archetypes (Judgment 53)
                        </span>
                    </div>
                    <button
                        onClick={() => setShowJevCalibrator(!showJevCalibrator)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                    >
                        <Sparkles size={12} />
                        {showJevCalibrator ? 'Close Jev Calibrator' : 'Auto-Tune with Jev AI'}
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {POSTURE_ARCHETYPES.map((arch) => (
                        <button
                            key={arch.id}
                            onClick={() => handleApplyArchetype(arch.id)}
                            className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 transition-all text-center group"
                            title={arch.description}
                        >
                            <span className="text-lg mb-1">{arch.icon}</span>
                            <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                                {arch.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Inline Jev AI Posture Calibrator */}
                {showJevCalibrator && (
                    <div className="mt-3 p-3.5 rounded-lg bg-slate-950/80 border border-emerald-500/30 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <Sparkles size={13} />
                                TypeSafe System One (Jev) Posture Auto-Calibrator
                            </span>
                            <span className="text-[10px] text-slate-400">Sub-100ms decision engine</span>
                        </div>

                        <textarea
                            value={jevPhilosophy}
                            onChange={(e) => setJevPhilosophy(e.target.value)}
                            placeholder="Describe your management philosophy or goal (e.g. 'I want an educational team that explains the mechanics of music publishing without rushing me', or 'I want aggressive commercial negotiators who get high sync payouts')..."
                            className="w-full h-20 p-2.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-4 text-xs text-slate-300">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-mono">RISK:</span>
                                    {(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const).map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setJevRisk(r)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                jevRisk === r ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-mono">STYLE:</span>
                                    {(['FORMAL', 'CASUAL', 'BLUNT'] as const).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setJevStyle(s)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                jevStyle === s ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleRunJevCalibration}
                                disabled={isJevCalibrating || !jevPhilosophy.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-colors disabled:opacity-50"
                            >
                                {isJevCalibrating ? (
                                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <Sparkles size={13} />
                                )}
                                {isJevCalibrating ? 'Calibrating...' : 'Run Jev Auto-Tune'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

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

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={handleApplyToAllPersonas}
                        disabled={isLoading || isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 rounded-lg transition-colors border border-indigo-700/60 disabled:opacity-50"
                        title="Synchronize these 5 posture sliders to all 8 personas in the boardroom (calibrating all 40 faders at once)"
                    >
                        <Users size={13} />
                        Sync to All 8 Personas (All 40 Sliders)
                    </button>
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

            {/* Autonomous Personality Evolution Toggle */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Bot size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Autonomous Agent Personality Evolution</span>
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                                Adaptive AI
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Allows boardroom agents to fine-tune their candor, brevity, and risk tolerance autonomously based on artist velocity and interaction feedback.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleToggleAutonomousEvolution}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isAutonomousEvolution
                            ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                >
                    {isAutonomousEvolution ? 'Enabled' : 'Disabled'}
                </button>
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
