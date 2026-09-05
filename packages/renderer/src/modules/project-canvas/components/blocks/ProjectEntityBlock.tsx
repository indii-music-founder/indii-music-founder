/**
 * ProjectEntityBlock.tsx
 *
 * Project Canvas representation of canonical reusable project entities
 * (Artist Identity, Release, Campaign, Song).
 *
 * Architectural Guarantees:
 * 1. Canonical records remain authoritative in their respective domains
 *    (Profile, Distribution, Campaign).
 * 2. Canvas stores only entity reference, spatial placement, and presentation settings.
 * 3. "Remove from canvas" removes spatial placement only.
 * 4. Navigates to source module without mutating or duplicating records.
 */

import React, { useState, useEffect } from 'react';
import {
    User,
    Disc,
    Megaphone,
    Music2,
    ExternalLink,
    MoreVertical,
    X,
    Sparkles,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { EntityResolver } from '../../resolvers/EntityResolver';
import type { ProjectCanvasBlock, ResolvedProjectEntityData, ProjectEntityType } from '../../types';

interface ProjectEntityBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const ProjectEntityBlock: React.FC<ProjectEntityBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const setModule = useStore((state) => state.setModule);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [resolvedData, setResolvedData] = useState<ResolvedProjectEntityData | null>(null);

    const entityType: ProjectEntityType = (block.entityRef?.versionId || 'artist') as ProjectEntityType;

    useEffect(() => {
        let isMounted = true;

        if (block.entityRef) {
            EntityResolver.resolve<ResolvedProjectEntityData>(block.entityRef).then((res) => {
                if (isMounted && res.status === 'resolved' && res.data) {
                    setResolvedData(res.data);
                }
            });
        }

        return () => {
            isMounted = false;
        };
    }, [block.entityRef]);

    const title = resolvedData?.title || block.snapshot?.title || `${entityType.toUpperCase()}`;
    const subtitle = resolvedData?.subtitle || block.snapshot?.excerpt || 'Canonical Entity';
    const description = resolvedData?.description || '';
    const metadata = resolvedData?.metadata || {};

    const getEntityIcon = () => {
        switch (entityType) {
            case 'artist':
                return <User size={13} className="text-pink-400" />;
            case 'release':
                return <Disc size={13} className="text-cyan-400" />;
            case 'campaign':
                return <Megaphone size={13} className="text-amber-400" />;
            case 'song':
            default:
                return <Music2 size={13} className="text-purple-400" />;
        }
    };

    const handleOpenInModule = () => {
        switch (entityType) {
            case 'artist':
                setModule('brand');
                break;
            case 'release':
                setModule('distribution');
                break;
            case 'campaign':
                setModule('marketing');
                break;
            case 'song':
            default:
                setModule('creative');
                break;
        }
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(block.id, e.shiftKey || e.metaKey);
            }}
            className={`w-full h-full rounded-2xl flex flex-col bg-zinc-900/95 backdrop-blur-md border transition-all select-none overflow-hidden shadow-xl ${
                isSelected
                    ? 'ring-2 ring-pink-500 border-pink-500/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                        {getEntityIcon()}
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate" title={title}>
                        {title}
                    </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInModule();
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title={`Open in ${entityType} module`}
                    >
                        <ExternalLink size={13} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Options"
                    >
                        <MoreVertical size={13} />
                    </button>

                    {isMenuOpen && (
                        <div
                            onMouseLeave={() => setIsMenuOpen(false)}
                            className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 text-xs"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    handleOpenInModule();
                                }}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <ExternalLink size={13} />
                                <span>Open in Module</span>
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
            <div className="flex-1 p-3.5 flex flex-col justify-between overflow-hidden text-xs">
                <div className="space-y-2 overflow-y-auto min-h-0">
                    <div>
                        <div className="text-[11px] font-medium text-zinc-400">{subtitle}</div>
                        {description && (
                            <p className="text-zinc-500 text-xs mt-1 line-clamp-3 leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Metadata fields */}
                    {Object.keys(metadata).length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                            {Object.entries(metadata).slice(0, 3).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-500 capitalize">{k}:</span>
                                    <span className="text-zinc-300 font-mono truncate max-w-[140px]">
                                        {Array.isArray(v) ? v.join(', ') : String(v)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer status */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1 text-pink-400 font-medium">
                        <Sparkles size={10} /> Canonical Reference
                    </span>
                    <span className="font-mono text-zinc-500 uppercase">{entityType}</span>
                </div>
            </div>
        </div>
    );
};
