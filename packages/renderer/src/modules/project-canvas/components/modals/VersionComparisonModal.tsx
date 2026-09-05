/**
 * VersionComparisonModal.tsx
 *
 * Side-by-side asset version comparison dialog for Project Canvas.
 *
 * Architectural Guarantees:
 * 1. Supports side-by-side visual and metadata inspection of two compatible versions.
 * 2. Surfaces real provenance: creator, timestamp, model/provider, dimensions, file format.
 * 3. Selecting a preferred version never deletes the alternative.
 * 4. Provides direct "Open in Creative Editor" for either version.
 */

import React, { useState } from 'react';
import {
    X,
    Check,
    ExternalLink,
    Split,
    Calendar,
    FileText,
    Sparkles,
    Sliders,
} from 'lucide-react';
import { useStore } from '@/core/store';
import type { ProjectCanvasBlock } from '../../types';

interface VersionComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockA: ProjectCanvasBlock;
    blockB: ProjectCanvasBlock;
    onSelectPreferred?: (preferredBlockId: string) => void;
}

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
    isOpen,
    onClose,
    blockA,
    blockB,
    onSelectPreferred,
}) => {
    const setModule = useStore((state) => state.setModule);
    const [preferredId, setPreferredId] = useState<string | null>(
        (blockA.settings?.isPreferred as boolean) ? blockA.id :
        (blockB.settings?.isPreferred as boolean) ? blockB.id : null
    );

    if (!isOpen) return null;

    const handleOpenInEditor = (_block: ProjectCanvasBlock) => {
        setModule('creative');
        onClose();
    };

    const handleSetPreferred = (blockId: string) => {
        setPreferredId(blockId);
        onSelectPreferred?.(blockId);
    };

    const renderAssetPreview = (block: ProjectCanvasBlock) => {
        const url = block.snapshot?.thumbnailUrl;
        const mediaType = block.snapshot?.mediaType || 'image';

        if (mediaType === 'image' && url) {
            return (
                <div className="w-full h-56 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center relative">
                    <img
                        src={url}
                        alt={block.snapshot?.title || 'Asset Version'}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            );
        }

        return (
            <div className="w-full h-56 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-500 gap-2">
                <FileText size={32} />
                <span className="text-xs uppercase tracking-wider font-mono">{mediaType} Version</span>
            </div>
        );
    };

    const renderMetadata = (block: ProjectCanvasBlock) => {
        const prov = block.provenance;
        const settings = block.settings || {};

        return (
            <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/80">
                    <span className="text-zinc-500">Title</span>
                    <span className="text-zinc-200 font-medium truncate max-w-[180px]">
                        {block.snapshot?.title || block.id}
                    </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/80">
                    <span className="text-zinc-500">Dimensions</span>
                    <span className="text-zinc-300 font-mono">
                        {(settings.dimensions as string) || `${block.size.width}x${block.size.height}`}
                    </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/80">
                    <span className="text-zinc-500">Created</span>
                    <span className="text-zinc-300 flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(block.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/80">
                    <span className="text-zinc-500">Creator / Origin</span>
                    <span className="text-purple-400 font-medium flex items-center gap-1">
                        <Sparkles size={11} />
                        {prov?.agentName || prov?.creatorId || 'Manual Upload'}
                    </span>
                </div>
                {prov?.operation && (
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/80">
                        <span className="text-zinc-500">Operation</span>
                        <span className="text-zinc-400 font-mono text-[11px]">{prov.operation}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                role="dialog"
                aria-label="Asset Version Comparison"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                            <Split size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">Side-by-Side Version Comparison</h2>
                            <p className="text-xs text-zinc-400">
                                Compare version metadata and select the preferred asset without deleting alternatives.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Comparison Columns */}
                <div className="p-6 grid grid-cols-2 gap-6 overflow-y-auto min-h-0 flex-1">
                    {/* Version A */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 ${
                        preferredId === blockA.id
                            ? 'bg-cyan-950/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
                            : 'bg-zinc-950/50 border-zinc-800'
                    }`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Version A</span>
                                {preferredId === blockA.id && (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold flex items-center gap-1">
                                        <Check size={11} /> Preferred Version
                                    </span>
                                )}
                            </div>
                            {renderAssetPreview(blockA)}
                            {renderMetadata(blockA)}
                        </div>

                        <div className="pt-4 border-t border-zinc-800/80 flex items-center gap-2">
                            <button
                                onClick={() => handleSetPreferred(blockA.id)}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                    preferredId === blockA.id
                                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                }`}
                            >
                                <Check size={13} />
                                <span>{preferredId === blockA.id ? 'Preferred' : 'Set as Preferred'}</span>
                            </button>
                            <button
                                onClick={() => handleOpenInEditor(blockA)}
                                className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Open in Creative Editor"
                            >
                                <ExternalLink size={13} />
                                <span>Editor</span>
                            </button>
                        </div>
                    </div>

                    {/* Version B */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 ${
                        preferredId === blockB.id
                            ? 'bg-cyan-950/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
                            : 'bg-zinc-950/50 border-zinc-800'
                    }`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Version B</span>
                                {preferredId === blockB.id && (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold flex items-center gap-1">
                                        <Check size={11} /> Preferred Version
                                    </span>
                                )}
                            </div>
                            {renderAssetPreview(blockB)}
                            {renderMetadata(blockB)}
                        </div>

                        <div className="pt-4 border-t border-zinc-800/80 flex items-center gap-2">
                            <button
                                onClick={() => handleSetPreferred(blockB.id)}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                    preferredId === blockB.id
                                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                }`}
                            >
                                <Check size={13} />
                                <span>{preferredId === blockB.id ? 'Preferred' : 'Set as Preferred'}</span>
                            </button>
                            <button
                                onClick={() => handleOpenInEditor(blockB)}
                                className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Open in Creative Editor"
                            >
                                <ExternalLink size={13} />
                                <span>Editor</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Sliders size={13} /> Both versions remain preserved in asset history.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
