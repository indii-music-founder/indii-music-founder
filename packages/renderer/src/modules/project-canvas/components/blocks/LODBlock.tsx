/**
 * LODBlock.tsx
 *
 * Lightweight Level of Detail (LOD) card representation for Project Canvas
 * blocks rendered when viewport zoom is low (< 0.4) or in ultra-dense scenes.
 *
 * Minimizes DOM overhead by omitting heavy media decoders, canvas waveforms,
 * rich text editors, and nested interactive menus while preserving spatial
 * boundaries, block type identity, and selection interaction.
 */

import React from 'react';
import type { ProjectCanvasBlock, ProjectCanvasBlockType } from '../../types';

interface LODBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onSelect?: (id: string, multi?: boolean) => void;
    onRemovePlacement?: (id: string) => void;
}

const BLOCK_TYPE_THEMES: Record<
    ProjectCanvasBlockType,
    { badge: string; border: string; bg: string; text: string; dot: string }
> = {
    asset: {
        badge: 'ASSET',
        border: 'border-cyan-500/60',
        bg: 'bg-cyan-950/40',
        text: 'text-cyan-300',
        dot: 'bg-cyan-400',
    },
    workflow: {
        badge: 'WORKFLOW',
        border: 'border-violet-500/60',
        bg: 'bg-violet-950/40',
        text: 'text-violet-300',
        dot: 'bg-violet-400',
    },
    workflow_run: {
        badge: 'RUN',
        border: 'border-emerald-500/60',
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
    },
    note: {
        badge: 'NOTE',
        border: 'border-amber-500/60',
        bg: 'bg-amber-950/40',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
    },
    text: {
        badge: 'TEXT',
        border: 'border-zinc-500/60',
        bg: 'bg-zinc-900/50',
        text: 'text-zinc-300',
        dot: 'bg-zinc-400',
    },
    frame: {
        badge: 'FRAME',
        border: 'border-zinc-600/40 border-dashed',
        bg: 'bg-zinc-950/20',
        text: 'text-zinc-400',
        dot: 'bg-zinc-500',
    },
    agent_output: {
        badge: 'AGENT',
        border: 'border-purple-500/60',
        bg: 'bg-purple-950/40',
        text: 'text-purple-300',
        dot: 'bg-purple-400',
    },
    document: {
        badge: 'DOC',
        border: 'border-blue-500/60',
        bg: 'bg-blue-950/40',
        text: 'text-blue-300',
        dot: 'bg-blue-400',
    },
    project_entity: {
        badge: 'ENTITY',
        border: 'border-rose-500/60',
        bg: 'bg-rose-950/40',
        text: 'text-rose-300',
        dot: 'bg-rose-400',
    },
    approval: {
        badge: 'APPROVAL',
        border: 'border-yellow-500/60',
        bg: 'bg-yellow-950/40',
        text: 'text-yellow-300',
        dot: 'bg-yellow-400',
    },
};

export const LODBlock: React.FC<LODBlockProps> = ({
    block,
    isSelected,
    onSelect,
}) => {
    const theme = BLOCK_TYPE_THEMES[block.type] || BLOCK_TYPE_THEMES.text;
    const title =
        block.snapshot?.title ||
        (block.settings?.customTitle as string) ||
        (block.settings?.title as string) ||
        block.type.toUpperCase();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect?.(block.id, e.shiftKey);
    };

    return (
        <div
            role="region"
            aria-label={`LOD Block: ${title}`}
            data-testid="lod-block"
            data-lod="true"
            data-block-type={block.type}
            onClick={handleClick}
            className={`w-full h-full rounded-lg border-2 select-none overflow-hidden transition-all duration-75 flex flex-col justify-between p-2.5 ${
                theme.border
            } ${theme.bg} ${
                isSelected
                    ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black shadow-lg shadow-cyan-500/20'
                    : 'hover:brightness-125'
            }`}
        >
            {/* Header: Type Pill & Status Dot */}
            <div className="flex items-center justify-between gap-1">
                <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/40 ${theme.text}`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                    {theme.badge}
                </span>
                {block.snapshot?.mediaType && (
                    <span className="text-[9px] uppercase font-mono text-zinc-400">
                        {block.snapshot.mediaType}
                    </span>
                )}
            </div>

            {/* Title */}
            <div className="my-auto">
                <h4 className="text-xs font-semibold text-zinc-100 truncate leading-tight" title={title}>
                    {title}
                </h4>
                {block.snapshot?.excerpt && (
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                        {block.snapshot.excerpt}
                    </p>
                )}
            </div>

            {/* Micro footer */}
            <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                <span>{`${Math.round(block.size.width)}×${Math.round(block.size.height)}`}</span>
                {isSelected && <span className="text-cyan-400 font-bold">SELECTED</span>}
            </div>
        </div>
    );
};
