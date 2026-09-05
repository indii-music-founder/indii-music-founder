/**
 * ClusterBlock.tsx
 *
 * Hardware-accelerated aggregate cluster block for ultra-dense Project Canvas
 * scenes (>500 blocks). Collapses hundreds of DOM elements in a spatial sector
 * into a single high-performance card displaying entity counts and type breakdowns.
 */

import React from 'react';
import { Layers, ZoomIn, Music, FileText, GitBranch, Cpu, Folder } from 'lucide-react';
import type { CanvasClusterSummary } from '../../types';

export interface ClusterBlockProps {
    summary: CanvasClusterSummary;
    onZoomToCluster?: (summary: CanvasClusterSummary) => void;
}

export function ClusterBlock({ summary, onZoomToCluster }: ClusterBlockProps) {
    const { center, bounds, blockCount, typeCounts } = summary;
    const width = Math.max(220, Math.min(bounds.maxX - bounds.minX, 360));
    const height = Math.max(140, Math.min(bounds.maxY - bounds.minY, 240));

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'asset':
                return <Music className="w-3 h-3 text-cyan-400" />;
            case 'note':
                return <FileText className="w-3 h-3 text-amber-400" />;
            case 'workflow':
            case 'workflow_run':
                return <GitBranch className="w-3 h-3 text-violet-400" />;
            case 'agent_output':
                return <Cpu className="w-3 h-3 text-emerald-400" />;
            default:
                return <Folder className="w-3 h-3 text-zinc-400" />;
        }
    };

    return (
        <div
            data-testid={`cluster-block-${summary.id}`}
            className="absolute rounded-xl bg-zinc-900/90 border border-zinc-700/80 shadow-2xl backdrop-blur-md p-3 flex flex-col justify-between cursor-pointer hover:border-cyan-500/80 transition-all group select-none"
            style={{
                transform: `translate3d(${center.x - width / 2}px, ${center.y - height / 2}px, 0)`,
                width: `${width}px`,
                height: `${height}px`,
                zIndex: 10,
            }}
            onClick={() => onZoomToCluster?.(summary)}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onZoomToCluster?.(summary);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Cluster of ${blockCount} items`}
        >
            {/* Header with Cluster Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        <Layers className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-zinc-200">
                            Cluster Region
                        </div>
                        <div className="text-[10px] text-zinc-400">
                            {blockCount} entities aggregated
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onZoomToCluster?.(summary);
                    }}
                    className="p-1 rounded bg-zinc-800/60 hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-300 transition-colors opacity-0 group-hover:opacity-100"
                    title="Zoom in to inspect cluster"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Entity Breakdown Pills */}
            <div className="flex flex-wrap gap-1.5 my-auto max-h-[80px] overflow-hidden">
                {Object.entries(typeCounts).map(([type, count]) => (
                    <div
                        key={type}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/70 border border-zinc-700/50 text-[10px] text-zinc-300"
                    >
                        {getTypeIcon(type)}
                        <span className="capitalize">{type.replace('_', ' ')}:</span>
                        <span className="font-semibold text-zinc-100">{count}</span>
                    </div>
                ))}
            </div>

            {/* Footer Prompt */}
            <div className="text-[9px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-800/50">
                <span>Click or zoom in to inspect</span>
                <span className="text-cyan-400/80 group-hover:text-cyan-300 font-medium">Expand &rarr;</span>
            </div>
        </div>
    );
}
