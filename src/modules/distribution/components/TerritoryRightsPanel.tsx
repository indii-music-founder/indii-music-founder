/**
 * TerritoryRightsPanel
 *
 * UI for configuring multi-territory rights splits on a release.
 * Allows different rights holders per territory — e.g., EU publishing
 * rights to one entity, US rights to another.
 *
 * Item 220: Multi-Territory Rights Splits.
 */

import React, { useState } from 'react';
import { Globe, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import type { TerritoryRightsSplit, TerritoryRightsConfig } from '@/services/distribution/types/distributor';

const TERRITORY_GROUPS: { label: string; codes: string[] }[] = [
    { label: 'Worldwide', codes: ['WORLD'] },
    { label: 'United States', codes: ['US'] },
    { label: 'United Kingdom', codes: ['GB'] },
    { label: 'European Union', codes: ['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'NL', 'PL', 'PT', 'SE'] },
    { label: 'Canada', codes: ['CA'] },
    { label: 'Australia & NZ', codes: ['AU', 'NZ'] },
    { label: 'Japan', codes: ['JP'] },
    { label: 'Brazil', codes: ['BR'] },
    { label: 'Latin America', codes: ['AR', 'CL', 'CO', 'MX', 'PE'] },
    { label: 'Africa', codes: ['ZA', 'NG', 'KE', 'GH', 'EG'] },
];

const RIGHTS_TYPES: TerritoryRightsSplit['rightsType'][] = [
    'master', 'publishing', 'sync', 'performance', 'mechanical',
];

interface TerritoryRightsPanelProps {
    config: TerritoryRightsConfig;
    onChange: (config: TerritoryRightsConfig) => void;
}

function newSplit(): TerritoryRightsSplit {
    return {
        territories: ['US'],
        rightsHolder: '',
        percentage: 100,
        rightsType: 'master',
        accountId: '',
    };
}

function validationErrors(splits: TerritoryRightsSplit[]): string[] {
    const errors: string[] = [];
    splits.forEach((s, i) => {
        if (!s.rightsHolder.trim()) errors.push(`Split ${i + 1}: Rights holder name is required`);
        if (s.percentage <= 0 || s.percentage > 100) errors.push(`Split ${i + 1}: Percentage must be 1–100`);
        if (s.territories.length === 0) errors.push(`Split ${i + 1}: At least one territory is required`);
    });
    return errors;
}

export default function TerritoryRightsPanel({ config, onChange }: TerritoryRightsPanelProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const updateSplit = (index: number, patch: Partial<TerritoryRightsSplit>) => {
        const splits = config.splits.map((s, i) => i === index ? { ...s, ...patch } : s);
        onChange({ ...config, splits });
    };

    const addSplit = () => {
        onChange({ ...config, splits: [...config.splits, newSplit()] });
        setOpenIndex(config.splits.length);
    };

    const removeSplit = (index: number) => {
        onChange({ ...config, splits: config.splits.filter((_, i) => i !== index) });
        if (openIndex === index) setOpenIndex(null);
    };

    const errors = config.enabled ? validationErrors(config.splits) : [];

    return (
        <div className="space-y-4">
            {/* Header + toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Globe size={16} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Territory Rights Splits</h3>
                        <p className="text-[11px] text-gray-500">Override rights holders on a per-territory basis</p>
                    </div>
                </div>

                <button
                    onClick={() => onChange({ ...config, enabled: !config.enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? 'bg-purple-500' : 'bg-white/10'}`}
                    aria-label="Toggle territory splits"
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {config.enabled && (
                <>
                    {errors.length > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
                            {errors.map((e, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] text-yellow-300">
                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                    {e}
                                </div>
                            ))}
                        </div>
                    )}

                    {config.splits.length === 0 && (
                        <p className="text-[12px] text-gray-500 text-center py-4 border border-dashed border-white/10 rounded-xl">
                            No territory splits configured. Global splits apply to all territories.
                        </p>
                    )}

                    {config.splits.map((split, index) => (
                        <div key={index} className="border border-white/10 rounded-2xl overflow-hidden">
                            {/* Collapsed row */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <button
                                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                    className="flex-1 flex items-center gap-3 text-left"
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`text-gray-500 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm text-white font-medium truncate block">
                                            {split.rightsHolder || <span className="text-gray-600 italic">Unnamed holder</span>}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            {split.territories.join(', ')} · {split.percentage}% {split.rightsType}
                                        </span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => removeSplit(index)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
                                    aria-label="Remove split"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>

                            {/* Expanded form */}
                            {openIndex === index && (
                                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 bg-white/[0.01]">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Rights Holder</label>
                                        <input
                                            type="text"
                                            value={split.rightsHolder}
                                            onChange={e => updateSplit(index, { rightsHolder: e.target.value })}
                                            placeholder="Publisher name, label, or artist entity"
                                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-700"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Rights Type</label>
                                            <select
                                                value={split.rightsType}
                                                onChange={e => updateSplit(index, { rightsType: e.target.value as TerritoryRightsSplit['rightsType'] })}
                                                className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                            >
                                                {RIGHTS_TYPES.map(t => (
                                                    <option key={t} value={t} className="bg-[#0d0d0d]">
                                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Percentage</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={split.percentage}
                                                    onChange={e => updateSplit(index, { percentage: Number(e.target.value) })}
                                                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                                <span className="text-gray-500 text-sm">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Territories</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                            {TERRITORY_GROUPS.map(group => {
                                                const selected = group.codes.every(c => split.territories.includes(c));
                                                const toggle = () => {
                                                    const current = new Set(split.territories);
                                                    if (selected) {
                                                        group.codes.forEach(c => current.delete(c));
                                                    } else {
                                                        group.codes.forEach(c => current.add(c));
                                                        // If WORLD selected, clear others
                                                        if (group.codes.includes('WORLD')) {
                                                            updateSplit(index, { territories: ['WORLD'] });
                                                            return;
                                                        }
                                                        current.delete('WORLD');
                                                    }
                                                    updateSplit(index, { territories: Array.from(current) });
                                                };
                                                return (
                                                    <label
                                                        key={group.label}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            onChange={toggle}
                                                            className="accent-purple-500 w-3.5 h-3.5 rounded"
                                                        />
                                                        <span className="text-[11px] text-gray-300">{group.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-600 block mb-1">
                                            Stripe Connect Account (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={split.accountId || ''}
                                            onChange={e => updateSplit(index, { accountId: e.target.value })}
                                            placeholder="acct_..."
                                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-700 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={addSplit}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-white hover:border-white/20 text-[11px] font-bold uppercase tracking-widest transition-all"
                    >
                        <Plus size={13} />
                        Add Territory Split
                    </button>
                </>
            )}
        </div>
    );
}
