/**
 * AssetBlock.tsx
 *
 * Multi-modal asset card for Project Canvas.
 * Supports image, audio, video, and document representations with lazy media loading.
 * Provides entry point to the authoritative Creative Editor.
 */

import React, { useState, useEffect } from 'react';
import {
    Image as ImageIcon,
    Music,
    Video,
    FileText,
    ExternalLink,
    Trash2,
    Sparkles,
    AlertCircle,
} from 'lucide-react';
import type { ProjectCanvasBlock } from '../../types';
import { EntityResolver, type ResolvedAssetData } from '../../resolvers/EntityResolver';
import { useStore } from '@/core/store';

interface AssetBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onRemovePlacement: (id: string) => void;
    onSelect: (id: string, multi: boolean) => void;
}

export const AssetBlock: React.FC<AssetBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const [resolvedData, setResolvedData] = useState<ResolvedAssetData | null>(null);
    const [status, setStatus] = useState<'loading' | 'resolved' | 'missing' | 'error'>(
        block.entityRef ? 'loading' : 'resolved'
    );
    const openImage = useStore((state) => state.openImage);
    const setModule = useStore((state) => state.setModule);

    useEffect(() => {
        if (!block.entityRef) return;
        let isMounted = true;
        EntityResolver.resolve<ResolvedAssetData>(block.entityRef).then((res) => {
            if (!isMounted) return;
            setStatus(res.status === 'resolved' ? 'resolved' : 'missing');
            if (res.data) setResolvedData(res.data);
        });
        return () => {
            isMounted = false;
        };
    }, [block.entityRef]);

    const title = resolvedData?.title || block.snapshot?.title || 'Asset';
    const mediaType = resolvedData?.mediaType || block.snapshot?.mediaType || 'image';
    const url = resolvedData?.url || block.snapshot?.thumbnailUrl;

    const handleOpenInEditor = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (url && (mediaType === 'image' || !mediaType)) {
            openImage(url, block.projectId);
            setModule('creative');
        }
    };

    const getMediaIcon = () => {
        switch (mediaType) {
            case 'audio':
                return <Music size={14} className="text-emerald-400" />;
            case 'video':
                return <Video size={14} className="text-purple-400" />;
            case 'document':
                return <FileText size={14} className="text-amber-400" />;
            default:
                return <ImageIcon size={14} className="text-cyan-400" />;
        }
    };

    return (
        <div
            className={`flex flex-col h-full bg-zinc-900/90 backdrop-blur-md rounded-xl border transition-all select-none overflow-hidden ${
                isSelected
                    ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/30'
                    : 'border-zinc-800 hover:border-zinc-700'
            }`}
            onClick={(e) => onSelect(block.id, e.shiftKey || e.metaKey)}
            role="region"
            aria-label={`Asset Card: ${title}`}
            tabIndex={0}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/60 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 min-w-0">
                    {getMediaIcon()}
                    <span className="text-xs font-medium text-zinc-200 truncate">{title}</span>
                </div>
                <div className="flex items-center gap-1">
                    {url && mediaType === 'image' && (
                        <button
                            onClick={handleOpenInEditor}
                            className="p-1 text-zinc-400 hover:text-cyan-400 rounded transition-colors"
                            title="Open in Creative Editor"
                            aria-label="Open in Creative Editor"
                        >
                            <ExternalLink size={12} />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(block.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                        title="Remove placement from canvas"
                        aria-label="Remove placement from canvas"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Media Body */}
            <div className="flex-1 min-h-0 bg-black/40 flex items-center justify-center p-2 relative group">
                {status === 'missing' ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-500">
                        <AlertCircle size={24} className="text-amber-500 mb-1" />
                        <p className="text-xs font-medium text-zinc-300">Reference Unresolved</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Underlying asset not found in storage.</p>
                    </div>
                ) : url ? (
                    mediaType === 'image' ? (
                        <img
                            src={url}
                            alt={title}
                            loading="lazy"
                            className="w-full h-full object-contain rounded"
                        />
                    ) : mediaType === 'audio' ? (
                        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Music size={20} className="text-emerald-400" />
                            </div>
                            <audio controls src={url} className="w-full h-8 mt-2" />
                        </div>
                    ) : mediaType === 'video' ? (
                        <video
                            src={url}
                            controls
                            className="w-full h-full object-contain rounded"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                            <FileText size={28} className="text-zinc-400 mb-1" />
                            <span className="text-xs text-zinc-300 font-mono">{title}</span>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-600 text-xs">
                        <ImageIcon size={24} className="mb-1 text-zinc-700" />
                        <span>No preview available</span>
                    </div>
                )}
            </div>

            {/* Footer tags / provenance */}
            <div className="px-3 py-1.5 bg-zinc-950/40 border-t border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="truncate">
                    {block.provenance?.agentName ? (
                        <span className="inline-flex items-center gap-1 text-cyan-400/80">
                            <Sparkles size={10} /> {block.provenance.agentName}
                        </span>
                    ) : (
                        mediaType.toUpperCase()
                    )}
                </span>
                {block.entityRef?.versionId && (
                    <span className="font-mono text-zinc-400 text-[9px] bg-zinc-800 px-1 py-0.5 rounded">
                        {block.entityRef.versionId.slice(0, 7)}
                    </span>
                )}
            </div>
        </div>
    );
};
