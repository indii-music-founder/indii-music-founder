/**
 * CanvasEdgeLayer.tsx
 *
 * SVG overlay rendering non-executing semantic relationships
 * between Project Canvas blocks.
 *
 * Relationship Types:
 * - 'association': general connection (solid zinc)
 * - 'lineage': derived version / parent-child (cyan with directional arrow)
 * - 'context': contextual reference (dashed amber)
 * - 'sequence': intended viewing order (dotted indigo)
 */

import React from 'react';
import type { ProjectCanvasBlock, ProjectCanvasEdge, CanvasRelationshipType } from '../../types';

interface CanvasEdgeLayerProps {
    edges: ProjectCanvasEdge[];
    blocks: ProjectCanvasBlock[];
    onRemoveEdge?: (id: string) => void;
    isLowLOD?: boolean;
}
const RELATIONSHIP_METADATA: Record<
    CanvasRelationshipType,
    {
        name: string;
        glyph: string;
        ariaLabel: string;
        stroke: string;
        strokeWidth: number;
        strokeDasharray: string;
        markerEnd: string;
    }
> = {
    lineage: {
        name: 'Derived from',
        glyph: '↳',
        ariaLabel: 'Lineage: target derived from source',
        stroke: '#06b6d4', // cyan-500
        strokeWidth: 2,
        strokeDasharray: 'none',
        markerEnd: 'url(#arrow-lineage)',
    },
    context: {
        name: 'Used as context',
        glyph: '✦',
        ariaLabel: 'Context: source supplies context to target',
        stroke: '#f59e0b', // amber-500
        strokeWidth: 1.5,
        strokeDasharray: '4 4',
        markerEnd: 'url(#arrow-context)',
    },
    sequence: {
        name: 'Comes before',
        glyph: '→',
        ariaLabel: 'Sequence: source comes before target',
        stroke: '#6366f1', // indigo-500
        strokeWidth: 1.5,
        strokeDasharray: '2 3',
        markerEnd: 'url(#arrow-sequence)',
    },
    association: {
        name: 'Related to',
        glyph: '—',
        ariaLabel: 'Association: items belong together',
        stroke: '#71717a', // zinc-500
        strokeWidth: 1.5,
        strokeDasharray: 'none',
        markerEnd: 'none',
    },
};

export const CanvasEdgeLayer: React.FC<CanvasEdgeLayerProps> = ({
    edges,
    blocks,
    onRemoveEdge,
    isLowLOD = false,
}) => {
    // Map blocks by ID for fast coordinate lookup
    const blockMap = new Map<string, ProjectCanvasBlock>();
    for (const b of blocks) {
        blockMap.set(b.id, b);
    }

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0"
            aria-label="Project Canvas Semantic Relationships"
            data-lod={isLowLOD ? 'true' : 'false'}
            role="region"
        >
            <defs>
                <marker
                    id="arrow-lineage"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                </marker>
                <marker
                    id="arrow-context"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                </marker>
                <marker
                    id="arrow-sequence"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
            </defs>

            {edges.map((edge) => {
                const source = blockMap.get(edge.sourceBlockId);
                const target = blockMap.get(edge.targetBlockId);
                if (!source || !target) return null;

                const sx = source.position.x + source.size.width / 2;
                const sy = source.position.y + source.size.height / 2;
                const tx = target.position.x + target.size.width / 2;
                const ty = target.position.y + target.size.height / 2;

                const dx = tx - sx;
                const cx1 = sx + dx * 0.4;
                const cy1 = sy;
                const cx2 = sx + dx * 0.6;
                const cy2 = ty;

                const pathData = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
                const meta = RELATIONSHIP_METADATA[edge.relationship] || RELATIONSHIP_METADATA.association;
                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;
                const displayText = edge.label ? `${meta.glyph} ${edge.label}` : meta.glyph;
                const badgeWidth = Math.max(32, displayText.length * 7 + 16);

                return (
                    <g
                        key={edge.id}
                        className="group pointer-events-auto"
                        aria-label={`${meta.ariaLabel}${edge.label ? `: ${edge.label}` : ''}`}
                        role="img"
                    >
                        {/* Interactive path */}
                        <path
                            d={isLowLOD ? `M ${sx} ${sy} L ${tx} ${ty}` : pathData}
                            fill="none"
                            stroke={meta.stroke}
                            strokeWidth={isLowLOD ? Math.max(1, meta.strokeWidth * 0.75) : meta.strokeWidth}
                            strokeDasharray={isLowLOD ? 'none' : meta.strokeDasharray}
                            markerEnd={isLowLOD ? 'none' : meta.markerEnd}
                            className="transition-all hover:stroke-white hover:stroke-width-[3px] cursor-pointer"
                            onClick={() => onRemoveEdge?.(edge.id)}
                        >
                            <title>{`Click to remove relationship (${meta.name})`}</title>
                        </path>

                        {/* Midpoint Accessible Badge (Non-color relationship indicator, omitted in Low LOD) */}
                        {!isLowLOD && (
                            <g
                                transform={`translate(${midX}, ${midY})`}
                                className="cursor-pointer"
                                onClick={() => onRemoveEdge?.(edge.id)}
                            >
                                <rect
                                    x={-badgeWidth / 2}
                                    y="-10"
                                    width={badgeWidth}
                                    height="20"
                                    rx="10"
                                    fill="#18181b"
                                    stroke={meta.stroke}
                                    strokeWidth="1"
                                    className="group-hover:stroke-white transition-colors"
                                />
                                <text
                                    textAnchor="middle"
                                    dy="3.5"
                                    fill="#e4e4e7"
                                    fontSize="10"
                                    fontFamily="sans-serif"
                                    fontWeight="bold"
                                    className="select-none pointer-events-none tracking-tight"
                                >
                                    {displayText}
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};
