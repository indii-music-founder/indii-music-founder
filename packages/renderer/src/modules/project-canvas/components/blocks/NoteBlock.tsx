/**
 * NoteBlock.tsx
 *
 * Project Canvas representation of a canonical Note.
 *
 * Architectural Guarantees:
 * 1. Does NOT store a copy of the note body in the canvas document.
 * 2. Reads live from canonical `notesSlice` (`useStore`).
 * 3. Supports safe inline editing via `updateNote` (triggering cloud sync).
 * 4. "Remove from canvas" removes spatial placement only.
 * 5. "Delete note everywhere" is an explicit, confirmed action deleting canonical note.
 * 6. Handles missing or deleted notes gracefully with a missing-reference banner.
 */

import React, { useState } from 'react';
import {
    StickyNote,
    ExternalLink,
    Edit3,
    Trash2,
    Paperclip,
    Tag,
    MoreVertical,
    AlertCircle,
    Check,
    X,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ProjectCanvasBlock } from '../../types';

interface NoteBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const notes = useStore((state) => state.notes);
    const updateNote = useStore((state) => state.updateNote);
    const deleteNote = useStore((state) => state.deleteNote);
    const setSelectedNote = useStore((state) => state.setSelectedNote);
    const setModule = useStore((state) => state.setModule);

    const noteId = block.entityRef?.entityId;
    const note = notes.find((n) => n.id === noteId);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    const startEditing = () => {
        if (!note) return;
        setEditTitle(note.title);
        setEditContent(note.content);
        setIsEditing(true);
        setIsMenuOpen(false);
    };

    const saveInlineEdit = () => {
        if (!note) return;
        updateNote(note.id, {
            title: editTitle.trim() || 'Untitled Note',
            content: editContent,
        });
        setIsEditing(false);
    };

    const cancelInlineEdit = () => {
        setIsEditing(false);
    };

    const handleOpenInNotes = () => {
        if (!note) return;
        setSelectedNote(note.id);
        setModule('notes');
    };

    const handleDeleteCanonical = async () => {
        setIsMenuOpen(false);
        if (!note) return;

        const confirmed = await ConfirmDialog.call({
            title: 'Delete Note Everywhere?',
            message: `This will permanently delete the note "${note.title || 'Untitled'}" from your notes library and remove it from all views. This cannot be undone.`,
            confirmText: 'Delete Note',
            cancelText: 'Keep Note',
            variant: 'destructive',
        });

        if (confirmed) {
            deleteNote(note.id);
            onRemovePlacement(block.id);
        }
    };

    // Missing Reference State
    if (!note) {
        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(block.id, e.shiftKey || e.metaKey);
                }}
                className={`w-full h-full rounded-2xl p-4 flex flex-col justify-between bg-zinc-900/90 backdrop-blur-md border transition-all ${
                    isSelected ? 'ring-2 ring-rose-500 border-rose-500/50' : 'border-rose-900/40 hover:border-rose-800'
                }`}
            >
                <div className="flex items-start gap-2.5 text-rose-400">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                            Missing Note Reference
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1">
                            Note ID <code className="text-zinc-300 font-mono text-[10px]">{noteId || 'unknown'}</code> was deleted or cannot be accessed in this workspace.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/60">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(block.id);
                        }}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                    >
                        Remove Placement
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(block.id, e.shiftKey || e.metaKey);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing();
            }}
            className={`w-full h-full rounded-2xl flex flex-col bg-zinc-900/95 backdrop-blur-md border transition-all select-none overflow-hidden shadow-xl ${
                isSelected
                    ? 'ring-2 ring-amber-400 border-amber-400/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                        <StickyNote size={12} />
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-zinc-800 text-zinc-100 text-xs font-semibold px-2 py-0.5 rounded border border-amber-500/50 outline-none w-full"
                            placeholder="Note Title"
                            autoFocus
                        />
                    ) : (
                        <h3 className="text-xs font-semibold text-zinc-200 truncate" title={note.title || 'Untitled Note'}>
                            {note.title || 'Untitled Note'}
                        </h3>
                    )}
                </div>

                {/* Header Action Menu */}
                <div className="flex items-center gap-1 shrink-0 relative">
                    {isEditing ? (
                        <>
                            <button
                                onClick={saveInlineEdit}
                                className="p-1 text-emerald-400 hover:bg-zinc-800 rounded transition-colors"
                                title="Save (Ctrl+Enter)"
                            >
                                <Check size={13} />
                            </button>
                            <button
                                onClick={cancelInlineEdit}
                                className="p-1 text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                                title="Cancel"
                            >
                                <X size={13} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleOpenInNotes}
                                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                                title="Open in Notes Module"
                            >
                                <ExternalLink size={13} />
                            </button>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                                title="Options"
                            >
                                <MoreVertical size={13} />
                            </button>

                            {/* Dropdown Options */}
                            {isMenuOpen && (
                                <div
                                    onMouseLeave={() => setIsMenuOpen(false)}
                                    className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 text-xs"
                                >
                                    <button
                                        onClick={startEditing}
                                        className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                                    >
                                        <Edit3 size={13} className="text-amber-400" />
                                        <span>Edit Note</span>
                                    </button>
                                    <button
                                        onClick={handleOpenInNotes}
                                        className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                                    >
                                        <ExternalLink size={13} />
                                        <span>Open Full Note</span>
                                    </button>
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
                                    <button
                                        onClick={handleDeleteCanonical}
                                        className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                    >
                                        <Trash2 size={13} />
                                        <span>Delete Note Everywhere</span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Note Body */}
            <div className="flex-1 p-3.5 overflow-y-auto min-h-0 text-xs">
                {isEditing ? (
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-full bg-zinc-950/60 text-zinc-200 text-xs p-2 rounded-lg border border-zinc-800 outline-none resize-none font-mono"
                        placeholder="Note content..."
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                saveInlineEdit();
                            }
                        }}
                    />
                ) : (
                    <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {note.content ? (
                            note.content
                        ) : (
                            <span className="text-zinc-500 italic">Empty note</span>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Metadata */}
            <div className="px-3.5 py-2 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between gap-2 shrink-0 text-[10px] text-zinc-500">
                <div className="flex items-center gap-2 overflow-hidden">
                    {note.tags && note.tags.length > 0 ? (
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                            <Tag size={10} className="shrink-0" />
                            {note.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span>Canonical Note</span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {note.attachments && note.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-zinc-400" title={`${note.attachments.length} attachments`}>
                            <Paperclip size={10} />
                            {note.attachments.length}
                        </span>
                    )}
                    <span>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
};
