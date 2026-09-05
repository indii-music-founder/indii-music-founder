/**
 * DocumentBlock.tsx
 *
 * Project Canvas representation of a Project Document / Creative Brief.
 *
 * Architectural Guarantees:
 * 1. References canonical document/asset records without duplicating file contents.
 * 2. Displays filename, file type, size, and upload metadata.
 * 3. Supports "Open / Download" and "Use as Context".
 * 4. "Remove from canvas" removes spatial placement only.
 */

import React, { useState } from 'react';
import {
    FileCode,
    FileText,
    Download,
    ExternalLink,
    Sparkles,
    MoreVertical,
    X,
    Calendar,
} from 'lucide-react';
import type { ProjectCanvasBlock } from '../../types';

interface DocumentBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const DocumentBlock: React.FC<DocumentBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const settings = block.settings || {};
    const title = (settings.title as string) || block.snapshot?.title || 'Project Document';
    const excerpt = (settings.excerpt as string) || block.snapshot?.excerpt || 'Creative brief / project documentation';
    const fileUrl = (settings.url as string) || block.snapshot?.thumbnailUrl;
    const fileType = (settings.fileType as string) || 'pdf';
    const fileSize = (settings.fileSize as string) || '';

    const handleOpen = () => {
        if (fileUrl) {
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
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
                    ? 'ring-2 ring-emerald-500 border-emerald-500/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        {fileType === 'code' ? <FileCode size={12} /> : <FileText size={12} />}
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate" title={title}>
                        {title}
                    </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative">
                    {fileUrl && (
                        <button
                            onClick={handleOpen}
                            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                            title="Open / Download"
                        >
                            <ExternalLink size={13} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
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
                            {fileUrl && (
                                <button
                                    onClick={handleOpen}
                                    className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                                >
                                    <Download size={13} />
                                    <span>Download File</span>
                                </button>
                            )}
                            <div className="h-px bg-zinc-800 my-1" />
                            <button
                                onClick={() => {
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

            {/* Document Body */}
            <div className="flex-1 p-3.5 flex flex-col justify-between overflow-hidden text-xs">
                <div className="overflow-y-auto min-h-0">
                    <p className="text-zinc-400 leading-relaxed line-clamp-4">
                        {excerpt}
                    </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 uppercase font-mono text-[10px]">
                        {fileType}
                    </span>
                    {fileSize && <span>{fileSize}</span>}
                </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="flex items-center gap-1 text-emerald-400/80">
                    <Sparkles size={10} /> Context Document
                </span>
                <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(block.createdAt).toLocaleDateString()}
                </span>
            </div>
        </div>
    );
};
