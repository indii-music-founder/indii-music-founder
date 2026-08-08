import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Search, Trash2, FileText, ImageIcon, Image as ImageIconRegular, Cloud, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotesModule() {
    const { notes, selectedNoteId, addNote, updateNote, deleteNote, setSelectedNote, user, notesLoading, notesSyncError } = useStore(
        useShallow(state => ({
            notes: state.notes,
            selectedNoteId: state.selectedNoteId,
            addNote: state.addNote,
            updateNote: state.updateNote,
            deleteNote: state.deleteNote,
            setSelectedNote: state.setSelectedNote,
            user: state.user,
            notesLoading: state.notesLoading,
            notesSyncError: state.notesSyncError,
        }))
    );

    const [searchQuery, setSearchQuery] = useState('');

    const filteredNotes = notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeNote = notes.find(n => n.id === selectedNoteId);
    const syncStatus = notesLoading
        ? {
            icon: Cloud,
            label: 'Checking cloud notes…',
            tone: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
        }
        : user && notesSyncError
            ? {
                icon: HardDrive,
                label: notesSyncError,
                tone: 'border-red-500/20 bg-red-500/10 text-red-300',
            }
            : user ? {
            icon: Cloud,
            label: 'Cloud sync enabled; recent changes may still be pending',
            tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        }
        : {
            icon: HardDrive,
            label: 'Saved on this device only until you sign in',
            tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        };

    const handleCreateNote = () => {
        const newId = addNote({
            title: 'Untitled Note',
            content: '',
            attachments: [],
            tags: []
        });
        setSelectedNote(newId);
    };

    const isMediaAttachment = (url: string) => {
        return url.match(/\.(jpeg|jpg|gif|png|mp4|webm|mov)$/i) != null || url.includes('firebasestorage');
    };

    return (
        <div className="flex h-full bg-[#0a0a0a] text-white">
            {/* Sidebar */}
            <div className="w-80 border-r border-white/10 flex flex-col bg-[#0f0f0f]">
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold font-display">Notes</h2>
                        <button
                            onClick={handleCreateNote}
                            className="p-2 bg-[#2E2EFE] hover:bg-[#2E2EFE]/80 text-white rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#2E2EFE]"
                        />
                    </div>
                    <div className={cn("mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", syncStatus.tone)}>
                        <syncStatus.icon size={14} className="mt-0.5 shrink-0" />
                        <span>{syncStatus.label}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredNotes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <FileText size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No notes found</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {filteredNotes.map(note => (
                                <button
                                    key={note.id}
                                    onClick={() => setSelectedNote(note.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg transition-all border",
                                        selectedNoteId === note.id
                                            ? "bg-[#2E2EFE]/10 border-[#2E2EFE]/30"
                                            : "bg-transparent border-transparent hover:bg-white/5"
                                    )}
                                >
                                    <div className="font-medium text-sm text-gray-200 truncate">
                                        {note.title || 'Untitled Note'}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate mt-1">
                                        {note.content || 'No additional text'}
                                    </div>
                                    {note.attachments.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-[#2E2EFE]">
                                            <ImageIconRegular size={12} />
                                            <span>{note.attachments.length} attachments</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Pane */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {activeNote ? (
                    <>
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a] z-10">
                            <input
                                type="text"
                                value={activeNote.title}
                                onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                                className="bg-transparent text-2xl font-bold text-white focus:outline-none flex-1"
                                placeholder="Note Title"
                            />
                            <button
                                onClick={() => deleteNote(activeNote.id)}
                                className="p-2 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-4"
                                title="Delete Note"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-[#050505]">
                            <textarea
                                value={activeNote.content}
                                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                                className="w-full h-full bg-transparent text-gray-300 resize-none focus:outline-none leading-relaxed text-base placeholder-gray-600 font-sans"
                                placeholder="Start typing..."
                            />

                            {/* Render Attachments */}
                            {activeNote.attachments.length > 0 && (
                                <div className="mt-8 border-t border-white/10 pt-6">
                                    <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                                        <ImageIcon size={16} /> Attached Media
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {activeNote.attachments.map((url, idx) => (
                                            <div key={idx} className="relative rounded-xl overflow-hidden border border-white/10 bg-[#111] aspect-video group">
                                                {isMediaAttachment(url) ? (
                                                    url.includes('video') || url.includes('.mp4') ? (
                                                        <video src={url} controls className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    )
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-2">
                                                        <FileText size={32} />
                                                        <span className="text-xs">Document</span>
                                                    </div>
                                                )}
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <FileText size={64} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-gray-400">Select a note or create a new one</p>
                    </div>
                )}
            </div>
        </div>
    );
}
