/**
 * FrameBlock.tsx
 *
 * Grouping container/frame for organizing Project Canvas sections.
 * Sits in the canvas background to frame groups of assets, notes, and workflows.
 */

import React, { useState } from 'react';
import { Layout, Trash2, Edit2, Check } from 'lucide-react';
import type { ProjectCanvasBlock } from '../../types';

interface FrameBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate: (id: string, patch: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (id: string) => void;
    onSelect: (id: string, multi: boolean) => void;
}

export const FrameBlock: React.FC<FrameBlockProps> = ({
    block,
    isSelected,
    onUpdate,
    onRemovePlacement,
    onSelect,
}) => {
    const initialTitle = (block.settings?.title as string) || block.snapshot?.title || 'Group Frame';
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initialTitle);

    const handleSaveTitle = () => {
        setIsEditing(false);
        onUpdate(block.id, {
            settings: { ...block.settings, title },
            snapshot: {
                ...block.snapshot,
                title,
                cachedAt: Date.now(),
            },
        });
    };

    return (
        <div
            className={`w-full h-full rounded-2xl border-2 transition-all select-none flex flex-col ${
                isSelected
                    ? 'border-cyan-500 bg-cyan-950/10 shadow-lg ring-2 ring-cyan-500/20'
                    : 'border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700'
            }`}
            onClick={(e) => onSelect(block.id, e.shiftKey || e.metaKey)}
            role="group"
            aria-label={`Frame: ${title}`}
        >
            {/* Frame Title Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/40 rounded-t-2xl border-b border-zinc-800/40">
                <div className="flex items-center gap-2">
                    <Layout size={14} className="text-zinc-400" />
                    {isEditing ? (
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-zinc-800 text-xs font-semibold text-zinc-100 px-2 py-0.5 rounded border border-zinc-700 focus:outline-none focus:border-cyan-500 w-44"
                            autoFocus
                        />
                    ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            {title}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {isEditing ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSaveTitle();
                            }}
                            className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                            title="Done editing"
                        >
                            <Check size={12} />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                            title="Rename frame"
                        >
                            <Edit2 size={12} />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(block.id);
                        }}
                        className="p-1 text-zinc-600 hover:text-rose-400 rounded"
                        title="Remove frame"
                        aria-label="Remove frame"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Frame Inner Area (Passes through clicks to nested items) */}
            <div className="flex-1 pointer-events-none" />
        </div>
    );
};
