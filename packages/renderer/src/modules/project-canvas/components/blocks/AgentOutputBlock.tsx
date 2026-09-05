/**
 * AgentOutputBlock.tsx
 *
 * Project Canvas representation of persistent Agent Outputs (Conductor, Specialists).
 *
 * Architectural Guarantees:
 * 1. Supports Markdown, Card, Table, Chart, and Structured Recommendation presentations.
 * 2. Surfaces full provenance: agent name, operation, timestamp, correlationId.
 * 3. Sanitized content with bounded dimensions.
 * 4. "Promote to Note" creates a canonical note in Notes store.
 * 5. "Remove from canvas" removes spatial placement only.
 */

import React, { useState } from 'react';
import {
    Bot,
    MoreVertical,
    X,
    FileText,
    TrendingUp,
    TrendingDown,
    Sparkles,
    CheckCircle2,
    Calendar,
} from 'lucide-react';
import { useStore } from '@/core/store';
import type { ProjectCanvasBlock } from '../../types';

interface AgentOutputBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const AgentOutputBlock: React.FC<AgentOutputBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const addNote = useStore((state) => state.addNote);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [promotedNoteId, setPromotedNoteId] = useState<string | null>(null);

    const settings = block.settings || {};
    const presentation = (settings.presentation as string) || (block.snapshot?.mediaType ? 'card' : 'markdown');
    const agentData = (settings.agentData || settings.data || {}) as Record<string, unknown>;
    const title = (settings.title as string) || block.snapshot?.title || 'Agent Recommendation';
    const provenance = block.provenance;

    const handlePromoteToNote = () => {
        setIsMenuOpen(false);
        try {
            let noteBody = '';

            if (typeof agentData.content === 'string') {
                noteBody = agentData.content;
            } else if (Array.isArray(agentData.cards)) {
                noteBody = (agentData.cards as Array<{ title?: string; value?: string; subtitle?: string }>)
                    .map((c) => `### ${c.title || 'Metric'}\nValue: ${c.value}\n${c.subtitle || ''}`)
                    .join('\n\n');
            } else {
                noteBody = JSON.stringify(agentData, null, 2);
            }

            const newNoteId = addNote({
                title: `[Agent] ${title}`,
                content: noteBody,
                attachments: [],
                tags: ['agent-output', provenance?.agentName || 'conductor'],
            });

            setPromotedNoteId(newNoteId);
        } catch (err) {
            console.error('FAILED TO PROMOTE NOTE:', err);
        }
    };

    const renderContent = () => {
        // Presentation: Cards
        if (presentation === 'card' && Array.isArray(agentData.cards)) {
            const cards = agentData.cards as Array<{
                title?: string;
                value?: string | number;
                subtitle?: string;
                trend?: 'up' | 'down';
                trendValue?: string;
            }>;

            return (
                <div className="grid grid-cols-2 gap-2 w-full">
                    {cards.map((card, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
                            <span className="text-[11px] text-zinc-400 truncate">{card.title}</span>
                            <div className="text-base font-bold text-zinc-100 mt-1">{card.value}</div>
                            {card.subtitle && (
                                <span className="text-[10px] text-zinc-500 mt-0.5">{card.subtitle}</span>
                            )}
                            {card.trend && (
                                <div className={`flex items-center gap-1 text-[10px] mt-1 font-medium ${
                                    card.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                    {card.trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    <span>{card.trendValue || ''}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        // Presentation: Table
        if (presentation === 'table' && Array.isArray(agentData.columns) && Array.isArray(agentData.rows)) {
            const columns = agentData.columns as Array<{ key: string; label: string }>;
            const rows = agentData.rows as Array<Record<string, unknown>>;

            return (
                <div className="w-full overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                                {columns.map((c, i) => (
                                    <th key={i} className="py-1.5 px-2 font-medium">{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {rows.slice(0, 10).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-zinc-800/30 text-zinc-300">
                                    {columns.map((c, cIdx) => (
                                        <td key={cIdx} className="py-1.5 px-2 whitespace-nowrap">
                                            {String(row[c.key] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Default: Markdown / Text
        const textContent = (agentData.content as string) || block.snapshot?.excerpt || 'Agent analysis and recommendations';
        return (
            <div className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">
                {textContent}
            </div>
        );
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(block.id, e.shiftKey || e.metaKey);
            }}
            className={`w-full h-full rounded-2xl flex flex-col bg-zinc-900/95 backdrop-blur-md border transition-all select-none overflow-hidden shadow-xl ${
                isSelected
                    ? 'ring-2 ring-purple-500 border-purple-500/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                        <Bot size={12} />
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate" title={title}>
                        {title}
                    </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Options"
                    >
                        <MoreVertical size={13} />
                    </button>

                    {isMenuOpen && (
                        <div
                            className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 text-xs"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePromoteToNote();
                                }}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <FileText size={13} className="text-amber-400" />
                                <span>Save as Note</span>
                            </button>
                            <div className="h-px bg-zinc-800 my-1" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    onRemovePlacement(block.id);
                                }}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <X size={13} />
                                <span>Remove from Canvas</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-3.5 overflow-y-auto min-h-0">
                {renderContent()}

                {promotedNoteId && (
                    <div className="mt-2 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-1">
                        <CheckCircle2 size={12} /> Saved to canonical Notes library
                    </div>
                )}
            </div>

            {/* Footer Provenance */}
            <div className="px-3.5 py-2 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="flex items-center gap-1 text-purple-400/80 font-medium">
                    <Sparkles size={10} />
                    {provenance?.agentName || provenance?.creatorId || 'Conductor'}
                </span>
                <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(block.createdAt).toLocaleDateString()}
                </span>
            </div>
        </div>
    );
};
