/**
 * AddEntityModal.tsx
 *
 * Modal dialog for pinning canonical entities (Notes, Workflows, Assets)
 * to the Project Canvas, or creating new canonical notes directly from the canvas.
 */

import React, { useState, useEffect } from 'react';
import {
    Search,
    StickyNote,
    GitFork,
    Image,
    Plus,
    X,
    Check,
    Loader2,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { getUserWorkflows } from '@/modules/workflow/services/workflowPersistence';
import { auth } from '@/services/firebase';
import type { SavedWorkflow } from '@/modules/workflow/types';
import type { ProjectCanvasBlock } from '../../types';

type NewCanvasBlockInput = Partial<Omit<ProjectCanvasBlock, 'id' | 'canvasId' | 'projectId' | 'createdAt' | 'updatedAt'>>;

function createNoteBlock(
    noteId: string,
    title: string,
    excerpt: string,
    center: { x: number; y: number },
    projectId: string
): NewCanvasBlockInput {
    return {
        type: 'note',
        position: { x: center.x, y: center.y },
        size: { width: 280, height: 200 },
        zIndex: 1,
        entityRef: {
            kind: 'note',
            entityId: noteId,
            projectId,
        },
        snapshot: {
            title,
            excerpt,
            cachedAt: Date.now(),
        },
    };
}

function createWorkflowBlock(
    wf: SavedWorkflow,
    center: { x: number; y: number },
    projectId: string
): NewCanvasBlockInput {
    return {
        type: 'workflow',
        position: { x: center.x, y: center.y },
        size: { width: 300, height: 220 },
        zIndex: 1,
        entityRef: {
            kind: 'workflow',
            entityId: wf.id,
            projectId,
        },
        snapshot: {
            title: wf.name || 'Creative Recipe',
            excerpt: wf.description || '',
            cachedAt: Date.now(),
        },
    };
}

function createAssetBlock(
    asset: { id: string; url: string; prompt?: string; type?: string },
    center: { x: number; y: number },
    projectId: string
): NewCanvasBlockInput {
    const rawType = (asset.type || 'image').toLowerCase();
    const mediaType = rawType.includes('audio') ? 'audio' : rawType.includes('video') ? 'video' : 'image';
    return {
        type: 'asset',
        position: { x: center.x, y: center.y },
        size: { width: 300, height: 320 },
        zIndex: 1,
        entityRef: {
            kind: 'asset',
            entityId: asset.id,
            projectId,
        },
        snapshot: {
            title: asset.prompt ? asset.prompt.slice(0, 60) : 'Asset',
            thumbnailUrl: asset.url,
            mediaType,
            cachedAt: Date.now(),
        },
    };
}

interface AddEntityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddBlock: (block: NewCanvasBlockInput) => void;
    canvasId: string;
    projectId: string;
    centerPosition: { x: number; y: number };
    defaultTab?: TabType;
}

type TabType = 'notes' | 'workflows' | 'assets' | 'create_note';

export const AddEntityModal: React.FC<AddEntityModalProps> = ({
    isOpen,
    onClose,
    onAddBlock,
    canvasId: _canvasId,
    projectId,
    centerPosition,
    defaultTab = 'notes',
}) => {
    const notes = useStore((state) => state.notes);
    const addNote = useStore((state) => state.addNote);
    const generatedHistory = useStore((state) => state.generatedHistory || []);
    const uploadedImages = useStore((state) => state.uploadedImages || []);

    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
    const [prevDefaultTab, setPrevDefaultTab] = useState<TabType>(defaultTab);

    if (defaultTab !== prevDefaultTab) {
        setPrevDefaultTab(defaultTab);
        setActiveTab(defaultTab);
    }

    const [searchQuery, setSearchQuery] = useState('');
    const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

    // New note form fields
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [newNoteTags, setNewNoteTags] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const userId = auth.currentUser?.uid;
        if (userId) {
            let isCurrent = true;
            Promise.resolve().then(() => {
                if (isCurrent) setIsLoadingWorkflows(true);
            });
            getUserWorkflows(userId)
                .then((list) => {
                    if (!isCurrent) return;
                    setWorkflows(list);
                    setIsLoadingWorkflows(false);
                })
                .catch(() => {
                    if (!isCurrent) return;
                    setIsLoadingWorkflows(false);
                });
            return () => {
                isCurrent = false;
            };
        }
    }, [isOpen]);

    const handlePinNote = (noteId: string) => {
        const note = notes.find((n) => n.id === noteId);
        onAddBlock(
            createNoteBlock(
                noteId,
                note?.title || 'Untitled Note',
                note?.content ? note.content.slice(0, 160) : '',
                centerPosition,
                projectId
            )
        );
        onClose();
    };

    const handleCreateAndPinNote = () => {
        const title = newNoteTitle.trim() || 'New Note';
        const content = newNoteContent.trim();
        const tags = newNoteTags
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean);

        const newId = addNote({
            title,
            content,
            attachments: [],
            tags,
        });

        onAddBlock(createNoteBlock(newId, title, content.slice(0, 160), centerPosition, projectId));
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteTags('');
        onClose();
    };

    const handlePinWorkflow = (wf: SavedWorkflow) => {
        onAddBlock(createWorkflowBlock(wf, centerPosition, projectId));
        onClose();
    };

    const handlePinAsset = (asset: { id: string; url: string; prompt?: string; type?: string }) => {
        onAddBlock(createAssetBlock(asset, centerPosition, projectId));
        onClose();
    };

    // Filter notes
    const filteredNotes = notes.filter((n) => {
        const q = searchQuery.toLowerCase();
        return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
    });

    // Filter workflows
    const filteredWorkflows = workflows.filter((w) => {
        const q = searchQuery.toLowerCase();
        return (w.name || '').toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q);
    });

    // Combined assets
    const allAssets = [...generatedHistory, ...uploadedImages];
    const filteredAssets = allAssets.filter((a) => {
        const q = searchQuery.toLowerCase();
        return (a.prompt || a.id || '').toLowerCase().includes(q);
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        Place on Project Canvas
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800 px-5 pt-2 gap-4 text-xs font-semibold">
                    <button
                        onClick={() => setActiveTab('notes')}
                        className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                            activeTab === 'notes'
                                ? 'text-amber-400 border-b-2 border-amber-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <StickyNote size={14} /> Notes ({notes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('create_note')}
                        className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                            activeTab === 'create_note'
                                ? 'text-amber-400 border-b-2 border-amber-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Plus size={14} /> New Note
                    </button>
                    <button
                        onClick={() => setActiveTab('workflows')}
                        className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                            activeTab === 'workflows'
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <GitFork size={14} /> Workflows ({workflows.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                            activeTab === 'assets'
                                ? 'text-cyan-400 border-b-2 border-cyan-400'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <Image size={14} /> Assets ({allAssets.length})
                    </button>
                </div>

                {/* Search Bar (except for create_note) */}
                {activeTab !== 'create_note' && (
                    <div className="p-4 border-b border-zinc-800/60">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs text-zinc-300">
                            <Search size={14} className="text-zinc-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search ${activeTab}...`}
                                className="bg-transparent border-none outline-none w-full text-zinc-200 placeholder-zinc-500"
                            />
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 min-h-[260px]">
                    {/* Notes Tab */}
                    {activeTab === 'notes' && (
                        <div className="space-y-2">
                            {filteredNotes.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500 text-xs">
                                    No notes found. Switch to "New Note" to create one.
                                </div>
                            ) : (
                                filteredNotes.map((note) => (
                                    <div
                                        key={note.id}
                                        onClick={() => handlePinNote(note.id)}
                                        className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800/40 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                                    >
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-amber-400">
                                                {note.title || 'Untitled Note'}
                                            </h4>
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                                {note.content || 'Empty note'}
                                            </p>
                                        </div>
                                        <button className="px-2.5 py-1 bg-zinc-800 group-hover:bg-amber-500/20 group-hover:text-amber-300 text-zinc-300 rounded-lg text-xs font-medium shrink-0 transition-colors">
                                            Pin
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Create New Note Tab */}
                    {activeTab === 'create_note' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                    Note Title
                                </label>
                                <input
                                    type="text"
                                    value={newNoteTitle}
                                    onChange={(e) => setNewNoteTitle(e.target.value)}
                                    placeholder="e.g. Single Release Creative Brief"
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 outline-none focus:border-amber-500/60"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                    Note Content
                                </label>
                                <textarea
                                    value={newNoteContent}
                                    onChange={(e) => setNewNoteContent(e.target.value)}
                                    placeholder="Write your note, brief, lyrics, or instructions..."
                                    rows={5}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 outline-none focus:border-amber-500/60 resize-none font-sans"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                    Tags (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={newNoteTags}
                                    onChange={(e) => setNewNoteTags(e.target.value)}
                                    placeholder="lyrics, marketing, cover-art"
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 outline-none focus:border-amber-500/60"
                                />
                            </div>
                            <button
                                onClick={handleCreateAndPinNote}
                                className="w-full mt-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Check size={14} /> Create Note & Place on Canvas
                            </button>
                        </div>
                    )}

                    {/* Workflows Tab */}
                    {activeTab === 'workflows' && (
                        <div className="space-y-2">
                            {isLoadingWorkflows ? (
                                <div className="text-center py-8 text-zinc-500 text-xs flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading saved recipes...
                                </div>
                            ) : filteredWorkflows.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500 text-xs">
                                    No saved recipes found in Workflow Lab.
                                </div>
                            ) : (
                                filteredWorkflows.map((wf) => (
                                    <div
                                        key={wf.id}
                                        onClick={() => handlePinWorkflow(wf)}
                                        className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/40 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                                    >
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-indigo-400">
                                                {wf.name || 'Creative Recipe'}
                                            </h4>
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                                {wf.description || `${wf.nodes?.length || 0} nodes`}
                                            </p>
                                        </div>
                                        <button className="px-2.5 py-1 bg-zinc-800 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 text-zinc-300 rounded-lg text-xs font-medium shrink-0 transition-colors">
                                            Pin
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Assets Tab */}
                    {activeTab === 'assets' && (
                        <div className="grid grid-cols-3 gap-2">
                            {filteredAssets.length === 0 ? (
                                <div className="col-span-3 text-center py-8 text-zinc-500 text-xs">
                                    No assets found in project history.
                                </div>
                            ) : (
                                filteredAssets.slice(0, 18).map((asset) => (
                                    <div
                                        key={asset.id}
                                        onClick={() => handlePinAsset(asset)}
                                        className="rounded-xl overflow-hidden border border-zinc-800 hover:border-cyan-500 cursor-pointer transition-all aspect-square bg-zinc-950 relative group"
                                    >
                                        <img
                                            src={asset.url}
                                            alt={asset.prompt || 'Asset'}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="px-2 py-1 bg-cyan-500 text-zinc-950 font-bold text-[10px] rounded-lg">
                                                Place
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
