import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import { Upload, Search, Loader2, Book, Sparkles, X, StickyNote, Brain } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/core/context/ToastContext';
import { knowledgeBaseService, KnowledgeDoc } from '@/modules/knowledge/services/KnowledgeBaseService';
import { DocumentCard } from '@/modules/knowledge/components/DocumentCard';
import { KnowledgeChat } from '@/modules/knowledge/components/KnowledgeChat';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ISSUE-1442 Stage 2: the "what the system remembers" surfaces fold into one
// destination. Memory and Notes keep their module ids (deep links and the
// Quick Notes drawer keep working) but are no longer separate nav destinations.
const NotesModuleLazy = lazy(() => import('@/modules/notes/NotesModule'));
const MemoryDashboardLazy = lazy(() => import('@/modules/memory/MemoryDashboard'));

type KnowledgeTab = 'knowledge' | 'notes' | 'memory';

function readInitialTab(): KnowledgeTab {
    try {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (tab === 'notes' || tab === 'memory') return tab;
    } catch {
        // Non-browser environment — default below.
    }
    return 'knowledge';
}

export default function KnowledgeBase() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<KnowledgeTab>(readInitialTab);
    const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // Chat & View State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [activeChatDoc, setActiveChatDoc] = useState<KnowledgeDoc | null>(null);
    const [viewingDoc, setViewingDoc] = useState<KnowledgeDoc | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadDocuments = useCallback(async () => {
        setIsLoading(true);
        try {
            const docs = await knowledgeBaseService.getDocuments();
            setDocuments(docs);
        } catch (_error: unknown) {
            toast.error("Failed to load Knowledge Base.");
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsUploading(true);
        toast.info(`Uploading ${files.length} file(s)...`);

        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const count = await knowledgeBaseService.uploadFiles(files, undefined, (name: string) => {
                // Optional: Toast for each file, but might be too noisy
            });

            if (count > 0) {
                toast.success(`Successfully added ${count} document(s).`);
                await loadDocuments();
            } else {
                toast.error("Upload failed.");
            }
        } catch (_error: unknown) {
            toast.error("Upload encountered an error.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (doc: KnowledgeDoc) => {
        const ok = await ConfirmDialog.call({
            title: "Delete Document",
            message: `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
            confirmText: "Delete",
            variant: "destructive"
        });

        if (ok) {
            try {
                await knowledgeBaseService.deleteDocument(doc.rawName);
                toast.success('Document deleted');
                await loadDocuments();
            } catch {
                toast.error('Failed to delete document');
            }
        }
    };

    const handleReupload = async (doc: KnowledgeDoc) => {
        const ok = await ConfirmDialog.call({
            title: "Re-upload Required",
            message: `The document "${doc.title}" uses our legacy storage system. To chat with it, we need to migrate it to the new vector knowledge base.\n\nPlease delete this file, and then upload it again using the "Upload document" button.`,
            confirmText: "Delete & Re-upload",
            variant: "default"
        });

        if (ok) {
            try {
                await knowledgeBaseService.deleteDocument(doc.rawName);
                toast.success('Document deleted. Please upload the new file.');
                await loadDocuments();
                // Trigger file input after deletion
                fileInputRef.current?.click();
            } catch {
                toast.error('Failed to delete document');
            }
        }
    };

    const handleChat = (doc: KnowledgeDoc) => {
        setActiveChatDoc(doc);
        setIsChatOpen(true);
    };

    const toggleGlobalChat = () => {
        setActiveChatDoc(null);
        setIsChatOpen(!isChatOpen);
    };

    // Drag & Drop Handlers
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => { setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectTab = (tab: KnowledgeTab) => {
        setActiveTab(tab);
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState(null, '', url.toString());
        } catch {
            // URL best-effort only — the tab still switches.
        }
    };

    const memoryAvailable = featureFlags.isEnabled(FEATURE_FLAG_NAMES.DEV_MODULES);

    const tabs: { id: KnowledgeTab; label: string; icon: typeof Book }[] = [
        { id: 'knowledge', label: 'Documents', icon: Book },
        { id: 'notes', label: 'Notes', icon: StickyNote },
        ...(memoryAvailable ? [{ id: 'memory' as const, label: 'Memory', icon: Brain }] : []),
    ];

    return (
        <ModuleErrorBoundary moduleName="Knowledge Base">
            <div className="h-full flex flex-col bg-bg-dark text-white overflow-hidden relative">
                {/* Tab strip — one destination for the surfaces that remember for you */}
                <div className="flex items-center gap-2 px-6 pt-4 flex-shrink-0" role="tablist" aria-label="Knowledge sections">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            data-testid={`knowledge-tab-${tab.id}`}
                            onClick={() => selectTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id
                                ? 'bg-[#FFE135]/10 border border-[#FFE135]/40 text-[#FFE135]'
                                : 'bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white hover:border-white/15'
                                }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'notes' ? (
                    <div className="flex-1 overflow-y-auto" data-testid="knowledge-notes-pane">
                        <Suspense fallback={<LoadingFallback />}>
                            <ModuleErrorBoundary moduleName="Knowledge / Notes">
                                <NotesModuleLazy />
                            </ModuleErrorBoundary>
                        </Suspense>
                    </div>
                ) : activeTab === 'memory' && memoryAvailable ? (
                    <div className="flex-1 overflow-y-auto" data-testid="knowledge-memory-pane">
                        <Suspense fallback={<LoadingFallback />}>
                            <ModuleErrorBoundary moduleName="Knowledge / Memory">
                                <MemoryDashboardLazy />
                            </ModuleErrorBoundary>
                        </Suspense>
                    </div>
                ) : (
                <div className="flex-1 overflow-y-auto px-6 py-5"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Header Section */}
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div className="animate-in fade-in slide-in-from-left duration-700">
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-lg font-black flex items-center gap-2">
                                    <Book className="text-[#FFE135]" size={18} />
                                    <span className="bg-clip-text text-transparent bg-linear-to-r from-white to-gray-500">
                                        Knowledge Base
                                    </span>
                                </h1>
                                <span className="text-[10px] font-black bg-[#FFE135] text-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-[0_0_15px_rgba(255,225,53,0.3)]">Beta</span>
                            </div>
                            <p className="text-gray-500 text-xs font-medium">Your team reads these documents when answering you.</p>
                        </div>
                        <div className="flex shrink-0 gap-2 animate-in fade-in slide-in-from-right duration-700">
                            <button
                                onClick={toggleGlobalChat}
                                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-300 active:scale-[0.98] ${isChatOpen
                                    ? 'bg-[#FFE135] text-black'
                                    : 'bg-[#161b22] text-gray-300 border border-gray-800 hover:border-[#FFE135]/40 hover:text-white'
                                    }`}
                            >
                                <Sparkles size={14} className={isChatOpen ? 'animate-spin-slow' : ''} />
                                {isChatOpen ? 'Close chat' : 'Ask your documents'}
                            </button>
                            <label
                                aria-disabled={isUploading}
                                className={`relative overflow-hidden px-3 py-2 bg-[#FFE135]/10 border border-[#FFE135]/30 hover:bg-[#FFE135]/20 text-[#FFE135] text-xs font-bold rounded-lg transition-all active:scale-[0.98] flex items-center gap-1.5 ${isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                            >
                                {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                {isUploading ? 'Uploading…' : 'Upload document'}
                                <input
                                    type="file"
                                    id="knowledge-document-upload"
                                    ref={fileInputRef}
                                    aria-label="Upload knowledge documents"
                                    className="absolute inset-0 size-full cursor-pointer opacity-0 file:cursor-pointer"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                        void handleFileUpload(e.target.files);
                                        e.target.value = '';
                                    }}
                                    accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.pdf"
                                    multiple
                                />
                            </label>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-5 max-w-xl animate-in fade-in slide-in-from-bottom duration-1000">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="text-gray-600 group-focus-within:text-[#FFE135] transition-colors" size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search documents…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#161b22]/40 backdrop-blur-md border border-gray-800/80 focus:border-[#FFE135]/50 text-white rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-[#FFE135]/5 transition-all placeholder-gray-600 text-sm"
                        />
                        {isDragging && (
                            <div className="absolute inset-0 bg-[#FFE135]/10 border-2 border-[#FFE135] border-dashed rounded-lg flex items-center justify-center backdrop-blur-md z-10 animate-pulse">
                                <p className="text-[#FFE135] font-black text-xs flex items-center gap-2 uppercase tracking-widest">
                                    <Upload size={14} /> Drop to upload
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Content Grid */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
                            <Loader2 className="animate-spin text-[#FFE135]" size={24} />
                            <p className="animate-pulse">Loading documents…</p>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <EmptyState
                            icon="document"
                            title="No documents found"
                            description="Upload files or drag & drop to populate the Knowledge Base."
                            className="h-64"
                        />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-10">
                            {filteredDocs.map(doc => (
                                <DocumentCard
                                    key={doc.id}
                                    doc={doc}
                                    onDelete={handleDelete}
                                    onChat={handleChat}
                                    onView={setViewingDoc}
                                    onReupload={handleReupload}
                                />
                            ))}
                        </div>
                    )}
                </div>
                )}

                {/* Chat Sidebar Overlay — knowledge-documents only */}
                {activeTab === 'knowledge' && (
                    <KnowledgeChat
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        activeDoc={activeChatDoc}
                    />
                )}

                {/* Document Viewer Modal — knowledge-documents only */}
                {activeTab === 'knowledge' && viewingDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300">
                        <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden transform scale-100 animate-in zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-black/40">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#FFE135]/10 rounded-xl border border-[#FFE135]/20">
                                        <Book className="text-[#FFE135]" size={20} />
                                    </div>
                                    <h2 className="text-white font-bold text-base">{viewingDoc.title}</h2>
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-widest border border-emerald-500/20">{viewingDoc.type}</span>
                                </div>
                                <button onClick={() => setViewingDoc(null)} className="p-2.5 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            {/* Content */}
                            <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar text-gray-300 prose prose-invert max-w-none prose-headings:text-white prose-a:text-[#FFE135] prose-pre:bg-black/50 prose-pre:border prose-pre:border-gray-800">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {viewingDoc.content || '*No content available for this document.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
