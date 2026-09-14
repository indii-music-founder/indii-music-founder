/**
 * packages/renderer/src/modules/settings/settings-panel/MasterPlaybookSection.tsx
 *
 * Tier 0 Artist Master Directive (Living User Skill) Settings Panel.
 *
 * Provides a bi-directional interface for the human artist to view, edit,
 * and refine their supreme directives across Sonic Specs, Business & Legal,
 * Brand & Aesthetics, Release & Distribution, and Custom Playbooks.
 */

import React, { useEffect, useState } from 'react';
import {
    Sliders,
    Shield,
    Palette,
    Radio,
    FileText,
    Plus,
    X,
    RotateCcw,
    Save,
    Sparkles,
    CheckCircle2,
    LucideIcon,
} from 'lucide-react';
import { SectionHeader } from './SettingsShared';
import { useToast } from '@/core/context/ToastContext';
import { artistDirectiveService } from '@/services/agent/skills/ArtistDirectiveService';
import {
    DEFAULT_ARTIST_MASTER_DIRECTIVE,
    compileDirectiveToMarkdown,
    type ArtistMasterDirective,
    type DirectiveSectionKey,
} from '@indii/shared';
import { getColorForModule } from '@/core/theme/moduleColors';
import { logger } from '@/utils/logger';

interface SectionMeta {
    key: DirectiveSectionKey;
    label: string;
    icon: LucideIcon;
}

const SECTION_METAS: SectionMeta[] = [
    { key: 'sonicSpecs', label: 'Sonic & Mastering', icon: Sliders },
    { key: 'businessLegal', label: 'Business & Legal', icon: Shield },
    { key: 'brandingAesthetics', label: 'Brand & Aesthetics', icon: Palette },
    { key: 'releaseDistribution', label: 'Release & Distribution', icon: Radio },
    { key: 'customPlaybook', label: 'Custom Playbook', icon: FileText },
];

export const MasterPlaybookSection: React.FC = () => {
    const { success, error, info } = useToast();
    const moduleColor = getColorForModule('settings');

    const [directive, setDirective] = useState<ArtistMasterDirective>(DEFAULT_ARTIST_MASTER_DIRECTIVE);
    const [selectedKey, setSelectedKey] = useState<DirectiveSectionKey>('sonicSpecs');
    const [mode, setMode] = useState<'structured' | 'markdown'>('structured');
    const [newRule, setNewRule] = useState('');
    const [rawMarkdown, setRawMarkdown] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadDirective = async () => {
            try {
                const loaded = await artistDirectiveService.getDirective();
                if (isMounted) {
                    setDirective(loaded);
                    setRawMarkdown(compileDirectiveToMarkdown(loaded));
                    setIsLoading(false);
                }
            } catch (err) {
                logger.error('[MasterPlaybookSection] Failed to load directive:', err);
                if (isMounted) setIsLoading(false);
            }
        };

        loadDirective();

        const unsubscribe = artistDirectiveService.subscribeToDirective(undefined, (updated) => {
            if (isMounted) {
                setDirective(updated);
                setRawMarkdown(compileDirectiveToMarkdown(updated));
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const activeSection = directive.sections[selectedKey];

    const handleAddRule = () => {
        const trimmed = newRule.trim();
        if (!trimmed) return;

        if (activeSection.rules.includes(trimmed)) {
            info('Rule already exists in this section');
            return;
        }

        const updatedRules = [...activeSection.rules, trimmed];
        const updatedDirective: ArtistMasterDirective = {
            ...directive,
            lastModifiedBy: 'user',
            lastModifiedReason: `User added rule to ${activeSection.title}`,
            sections: {
                ...directive.sections,
                [selectedKey]: {
                    ...activeSection,
                    rules: updatedRules,
                    content: updatedRules.map((r) => `- ${r}`).join('\n'),
                    updatedAt: new Date().toISOString(),
                },
            },
        };

        setDirective(updatedDirective);
        setRawMarkdown(compileDirectiveToMarkdown(updatedDirective));
        setNewRule('');
    };

    const handleRemoveRule = (ruleIndex: number) => {
        const updatedRules = activeSection.rules.filter((_, i) => i !== ruleIndex);
        const updatedDirective: ArtistMasterDirective = {
            ...directive,
            lastModifiedBy: 'user',
            lastModifiedReason: `User removed rule from ${activeSection.title}`,
            sections: {
                ...directive.sections,
                [selectedKey]: {
                    ...activeSection,
                    rules: updatedRules,
                    content: updatedRules.map((r) => `- ${r}`).join('\n'),
                    updatedAt: new Date().toISOString(),
                },
            },
        };

        setDirective(updatedDirective);
        setRawMarkdown(compileDirectiveToMarkdown(updatedDirective));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let toSave = directive;

            if (mode === 'markdown') {
                toSave = {
                    ...directive,
                    customRawMarkdown: rawMarkdown,
                    lastModifiedBy: 'user',
                    lastModifiedReason: 'User edited custom raw markdown',
                };
            }

            const result = await artistDirectiveService.saveDirective(
                toSave,
                'user',
                'User updated Master Playbook in Studio UI'
            );

            if (result.success) {
                success('Artist Master Directive saved successfully');
            } else {
                error(`Save failed: ${result.error || 'Unknown error'}`);
            }
        } catch (err) {
            logger.error('[MasterPlaybookSection] Save error:', err);
            error('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetDefaults = () => {
        setDirective(DEFAULT_ARTIST_MASTER_DIRECTIVE);
        setRawMarkdown(compileDirectiveToMarkdown(DEFAULT_ARTIST_MASTER_DIRECTIVE));
        info('Reset to baseline master directives. Click Save to persist.');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-400">
                <Sparkles className="animate-spin mr-2" size={18} />
                <span>Loading Artist Master Directive...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Artist Master Directive"
                description="Living supreme rules, sonic specs, legal red lines, and custom playbooks that override all agent defaults. Co-authored by you and your AI Conductor."
            />

            {/* Last Modified Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-300">Playbook State:</span>
                    <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                            directive.lastModifiedBy === 'agent'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                    >
                        {directive.lastModifiedBy === 'agent' ? 'AI Conductor Refined' : 'Artist Co-Authored'}
                    </span>
                    {directive.lastModifiedReason && (
                        <span className="text-slate-400 truncate max-w-xs md:max-w-md">
                            — {directive.lastModifiedReason}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('structured')}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
                            mode === 'structured'
                                ? `${moduleColor.bg} ${moduleColor.text} border ${moduleColor.border}`
                                : 'text-slate-400 hover:text-white bg-slate-900/40'
                        }`}
                    >
                        Structured Rules
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('markdown')}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
                            mode === 'markdown'
                                ? `${moduleColor.bg} ${moduleColor.text} border ${moduleColor.border}`
                                : 'text-slate-400 hover:text-white bg-slate-900/40'
                        }`}
                    >
                        Markdown View
                    </button>
                </div>
            </div>

            {mode === 'structured' ? (
                <div className="space-y-4">
                    {/* Section Selector Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {SECTION_METAS.map((meta) => {
                            const Icon = meta.icon;
                            const isSelected = selectedKey === meta.key;
                            const count = directive.sections[meta.key]?.rules?.length || 0;

                            return (
                                <button
                                    key={meta.key}
                                    type="button"
                                    onClick={() => setSelectedKey(meta.key)}
                                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? `${moduleColor.bg} ${moduleColor.border} text-white shadow-sm`
                                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Icon size={16} className={isSelected ? moduleColor.text : 'text-slate-500'} />
                                        <span className="text-xs font-semibold truncate">{meta.label}</span>
                                    </div>
                                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-slate-400">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Section Rule Editor */}
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-white">{activeSection.title}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{activeSection.description}</p>
                        </div>

                        {/* Rules List */}
                        <div className="space-y-2">
                            {activeSection.rules.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">
                                    No rules defined for this section yet. Add a rule below or let your Conductor infer one.
                                </p>
                            ) : (
                                activeSection.rules.map((rule, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 group"
                                    >
                                        <div className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
                                            <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                            <span>{rule}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRule(idx)}
                                            aria-label={`Remove rule: ${rule}`}
                                            className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Rule Input */}
                        <div className="flex gap-2 pt-2 border-t border-slate-700/40">
                            <input
                                type="text"
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddRule();
                                }}
                                placeholder={`Add instruction to ${activeSection.title}...`}
                                className={`flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:${moduleColor.ring}`}
                            />
                            <button
                                type="button"
                                onClick={handleAddRule}
                                disabled={!newRule.trim()}
                                className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border ${moduleColor.bg} ${moduleColor.text} ${moduleColor.border} disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                <Plus size={14} />
                                Add Rule
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Markdown View / Raw Editor */
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-white">Direct Playbook Document</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Real-time compiled Markdown injected into the Conductor prompt stack.
                            </p>
                        </div>
                    </div>
                    <textarea
                        rows={16}
                        value={rawMarkdown}
                        onChange={(e) => setRawMarkdown(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                    <RotateCcw size={14} />
                    Reset Baseline
                </button>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg text-white transition-all shadow-md ${
                        isSaving
                            ? 'bg-emerald-700 opacity-60 cursor-wait'
                            : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                    }`}
                >
                    {isSaving ? (
                        <>
                            <Sparkles className="animate-spin" size={14} />
                            Persisting...
                        </>
                    ) : (
                        <>
                            <Save size={14} />
                            Save Directive
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default MasterPlaybookSection;
