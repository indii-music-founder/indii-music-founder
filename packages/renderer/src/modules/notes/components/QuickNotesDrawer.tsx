import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    StickyNote,
    Plus,
    X,
    ExternalLink,
    LayoutGrid,
    Search,
    Trash2,
    Check,
    Mic,
    Image as ImageIcon,
    Video as VideoIcon,
    Music as AudioIcon,
    FileText,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { cn } from '@/lib/utils';
import type { Note } from '@/core/store/slices/notesSlice';

export interface QuickNotesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ActiveNoteEditorProps {
    note: Note | null;
    currentProjectId: string | null;
    updateNote: (id: string, updates: Partial<Note>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addCanvasBlock: (block: any) => void;
}

const ActiveNoteEditor: React.FC<ActiveNoteEditorProps> = ({
    note,
    currentProjectId,
    updateNote,
    addCanvasBlock,
}) => {
    const toast = useToast();
    const [titleInput, setTitleInput] = useState(note?.title || '');
    const [contentInput, setContentInput] = useState(note?.content || '');
    const [isPinned, setIsPinned] = useState(false);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTitleInput(val);
        if (note?.id) {
            updateNote(note.id, { title: val || 'Untitled Note' });
        }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContentInput(val);
        if (note?.id) {
            updateNote(note.id, { content: val });
        }
    };

    const handlePinToCanvas = () => {
        if (!note) return;

        try {
            addCanvasBlock({
                type: 'note',
                position: { x: 280, y: 220 },
                size: { width: 280, height: 200 },
                zIndex: 1,
                entityRef: {
                    kind: 'note',
                    entityId: note.id,
                    projectId: currentProjectId || 'default',
                },
                snapshot: {
                    title: note.title || 'Untitled Note',
                    excerpt: note.content?.slice(0, 100) || '',
                    cachedAt: Date.now(),
                },
            });
            setIsPinned(true);
            toast?.success?.(`"${note.title || 'Note'}" pinned to Project Canvas`);
        } catch {
            toast?.error?.('Failed to pin note to canvas');
        }
    };

    return (
        <div className="flex-1 flex flex-col p-5 overflow-hidden gap-3">
            <input
                type="text"
                value={titleInput}
                onChange={handleTitleChange}
                placeholder="Note title..."
                className="w-full bg-transparent text-base font-semibold text-white placeholder-gray-500 outline-none border-b border-white/10 pb-2 focus:border-amber-400/50 transition-colors"
            />

            <textarea
                value={contentInput}
                onChange={handleContentChange}
                placeholder="Jot down lyrics, chord progressions, tour logistics, or marketing angles..."
                className="flex-1 w-full bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-sm text-gray-200 placeholder-gray-600 outline-none resize-none custom-scrollbar focus:border-amber-400/30 transition-colors font-sans leading-relaxed min-h-[100px]"
            />

            {/* Media Attachments Player & Gallery */}
            {note && Array.isArray(note.attachments) && note.attachments.length > 0 && (
                <div className="flex flex-col gap-2 p-3 bg-black/40 border border-white/10 rounded-xl overflow-y-auto max-h-56 custom-scrollbar">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <ImageIcon size={12} className="text-amber-400" />
                        Attached Media ({note.attachments.length})
                    </span>
                    <div className="flex flex-col gap-2.5">
                        {note.attachments.map((url, idx) => {
                            const isVideo = url.includes('.mp4') || url.includes('.webm') || url.includes('video');
                            const isAudio = url.includes('.m4a') || url.includes('.webm') || url.includes('.mp3') || url.includes('.wav') || url.includes('voice_memo') || url.includes('audio');
                            const isImage = !isVideo && !isAudio;

                            if (isVideo) {
                                return (
                                    <div key={idx} className="rounded-lg overflow-hidden border border-white/10 bg-black">
                                        <video src={url} controls playsInline preload="metadata" className="w-full max-h-40 object-cover" />
                                    </div>
                                );
                            }

                            if (isAudio) {
                                return (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                                        <AudioIcon size={14} className="text-emerald-400 shrink-0" />
                                        <audio src={url} controls preload="metadata" className="w-full h-8" />
                                    </div>
                                );
                            }

                            return (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-white/10 bg-black group relative">
                                    <img src={url} alt="Attachment" className="w-full max-h-36 object-contain" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white">
                                        Click to open
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Canvas Pin & Audio Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-1">
                <button
                    onClick={handlePinToCanvas}
                    disabled={!note}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                        isPinned
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                    title="Pin this note as a live card on the active Project Canvas"
                >
                    {isPinned ? <Check size={14} /> : <LayoutGrid size={14} className="text-amber-400" />}
                    <span>{isPinned ? 'Pinned to Canvas' : 'Pin to Current Canvas'}</span>
                </button>

                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Mic size={12} className="text-gray-400" />
                    <span>Mobile remote sync active</span>
                </div>
            </div>
        </div>
    );
};

interface QuickNotesDrawerContentProps {
    onClose: () => void;
}

const QuickNotesDrawerContent: React.FC<QuickNotesDrawerContentProps> = ({ onClose }) => {
    const {
        notes,
        notesLoading,
        selectedNoteId,
        addNote,
        updateNote,
        deleteNote,
        setSelectedNote,
        setModule,
        currentProjectId,
        addCanvasBlock,
    } = useStore(
        useShallow((state) => ({
            notes: Array.isArray(state.notes) ? state.notes : [],
            notesLoading: Boolean(state.notesLoading),
            selectedNoteId: state.selectedNoteId,
            addNote: state.addNote || (() => 'note-1'),
            updateNote: state.updateNote || (() => {}),
            deleteNote: state.deleteNote || (() => {}),
            setSelectedNote: state.setSelectedNote || (() => {}),
            setModule: state.setModule || (() => {}),
            currentProjectId: state.currentProjectId,
            addCanvasBlock: state.addCanvasBlock || (() => {}),
        }))
    );

    const [searchQuery, setSearchQuery] = useState('');

    // Escape shortcut to close drawer
    useGlobalShortcut(
        {
            id: 'quick-notes-escape',
            key: 'Escape',
            priority: 'modal',
            ignoreInput: false,
            handler: () => onClose(),
        },
        [onClose],
        true
    );

    // Ensure there is an active note or create one if empty
    useEffect(() => {
        if (!selectedNoteId && notes.length > 0) {
            const firstValidNote = notes.find((n) => Boolean(n?.id));
            if (firstValidNote?.id) {
                setSelectedNote(firstValidNote.id);
            }
        } else if (!notesLoading && notes.length === 0 && addNote) {
            const newId = addNote({
                title: 'Quick Capture',
                content: '',
                attachments: [],
                tags: ['quick-capture'],
            });
            if (newId) setSelectedNote(newId);
        }
    }, [selectedNoteId, notes, notesLoading, addNote, setSelectedNote]);

    const activeNote = useMemo(
        () => (notes.length > 0 ? notes.find((n) => n?.id === selectedNoteId) || notes[0] : null),
        [notes, selectedNoteId]
    );

    const handleCreateNewNote = () => {
        const newId = addNote({
            title: 'New Idea',
            content: '',
            attachments: [],
            tags: ['quick-capture'],
        });
        if (newId) setSelectedNote(newId);
    };

    const handleOpenFullNotes = () => {
        onClose();
        if (activeNote) {
            setSelectedNote(activeNote.id);
        }
        setModule('notes');
    };

    const filteredNotes = useMemo(() => {
        if (!notes || !Array.isArray(notes)) return [];
        if (!searchQuery.trim()) return notes;
        const q = searchQuery.toLowerCase();
        return notes.filter(
            (n) => n?.title?.toLowerCase().includes(q) || n?.content?.toLowerCase().includes(q)
        );
    }, [notes, searchQuery]);

    return (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
                aria-hidden="true"
            />

            {/* Slide-over Panel */}
            <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Quick Notes Drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[#0c1015] border-l border-white/10 shadow-2xl flex flex-col z-50 text-white"
            >
                {/* Drawer Header */}
                <div className="p-4 px-5 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                            <StickyNote size={16} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-white tracking-wide">Quick Notes</h2>
                                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-gray-400">
                                    ⌘J
                                </kbd>
                            </div>
                            <p className="text-[10px] text-gray-400">Instant capture across all departments</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCreateNewNote}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="New Note"
                            aria-label="Create new note"
                        >
                            <Plus size={18} />
                        </button>
                        <button
                            onClick={handleOpenFullNotes}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Open in Full Notes Module"
                            aria-label="Open in full notes module"
                        >
                            <ExternalLink size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Close (Esc)"
                            aria-label="Close drawer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Active Note Editor with key to reset state cleanly */}
                <ActiveNoteEditor
                    key={activeNote?.id || 'new-note'}
                    note={activeNote}
                    currentProjectId={currentProjectId}
                    updateNote={updateNote}
                    addCanvasBlock={addCanvasBlock}
                />

                {/* Recent Notes Tray */}
                <div className="border-t border-white/10 p-4 bg-black/20 flex flex-col gap-2 max-h-56">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            Recent Notes ({notes.length})
                        </span>
                        <div className="relative w-40">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-white/5 border border-white/10 rounded-md py-1 pl-7 pr-2 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-white/20"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto space-y-1 custom-scrollbar pr-1 max-h-36">
                        {filteredNotes.map((note) => {
                            const isSelected = activeNote?.id === note.id;
                            return (
                                <div
                                    key={note.id}
                                    onClick={() => setSelectedNote(note.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group",
                                        isSelected
                                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                            : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <StickyNote size={12} className={isSelected ? "text-amber-400" : "text-gray-500"} />
                                        <span className="truncate font-medium">{note.title || 'Untitled Note'}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteNote(note.id);
                                            }}
                                            className="p-1 hover:text-red-400 text-gray-500 transition-colors"
                                            title="Delete Note"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.aside>
        </div>
    );
};

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && <QuickNotesDrawerContent onClose={onClose} />}
        </AnimatePresence>
    );
};

export default QuickNotesDrawer;
