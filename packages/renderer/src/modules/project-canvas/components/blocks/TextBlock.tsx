/**
 * TextBlock.tsx
 *
 * Canvas-native text / markdown card for Project Canvas.
 * Supports inline editing, titles, and non-destructive spatial manipulation.
 */

import React, { useState } from 'react';
import { Type, Trash2, Edit3, Check } from 'lucide-react';
import type { ProjectCanvasBlock } from '../../types';

interface TextBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate: (id: string, patch: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (id: string) => void;
    onSelect: (id: string, multi: boolean) => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({
    block,
    isSelected,
    onUpdate,
    onRemovePlacement,
    onSelect,
}) => {
    const blockContent = (block.settings?.content as string) || block.snapshot?.excerpt || '';
    const blockTitle = block.snapshot?.title || 'Note';

    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(blockTitle);
    const [content, setContent] = useState(blockContent);
    const [prevContent, setPrevContent] = useState(blockContent);
    const [prevTitle, setPrevTitle] = useState(blockTitle);

    if (blockContent !== prevContent || blockTitle !== prevTitle) {
        setPrevContent(blockContent);
        setPrevTitle(blockTitle);
        if (!isEditing) {
            setContent(blockContent);
            setTitle(blockTitle);
        }
    }

    const handleSave = () => {
        setIsEditing(false);
        onUpdate(block.id, {
            settings: { ...block.settings, content },
            snapshot: {
                ...block.snapshot,
                title,
                excerpt: content,
                cachedAt: Date.now(),
            },
        });
    };

    return (
        <div
            className={`flex flex-col h-full bg-zinc-900/95 backdrop-blur-md rounded-xl border transition-all select-none overflow-hidden ${
                isSelected
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                    : 'border-zinc-800 hover:border-zinc-700'
            }`}
            onClick={(e) => onSelect(block.id, e.shiftKey || e.metaKey)}
            role="region"
            aria-label={`Text Block: ${title}`}
            tabIndex={0}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/60 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 min-w-0">
                    <Type size={14} className="text-indigo-400 shrink-0" />
                    {isEditing ? (
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-zinc-800 text-xs font-medium text-zinc-100 px-1.5 py-0.5 rounded border border-zinc-700 focus:outline-none focus:border-indigo-500 w-32"
                            autoFocus
                        />
                    ) : (
                        <span className="text-xs font-medium text-zinc-200 truncate">{title}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {isEditing ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSave();
                            }}
                            className="p-1 text-emerald-400 hover:text-emerald-300 rounded transition-colors"
                            title="Done editing"
                            aria-label="Save text changes"
                        >
                            <Check size={12} />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="p-1 text-zinc-400 hover:text-indigo-400 rounded transition-colors"
                            title="Edit text"
                            aria-label="Edit text"
                        >
                            <Edit3 size={12} />
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

            {/* Content Area */}
            <div className="flex-1 min-h-0 p-3 overflow-y-auto">
                {isEditing ? (
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Type text or markdown here..."
                        className="w-full h-full bg-zinc-950/70 text-xs text-zinc-200 p-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500 font-sans resize-none"
                    />
                ) : (
                    <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {content || <span className="text-zinc-600 italic">Empty text card. Click edit to add notes.</span>}
                    </div>
                )}
            </div>
        </div>
    );
};
