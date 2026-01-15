import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, Filter, Loader2, Book, Sparkles } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { knowledgeBaseService, KnowledgeDoc } from './services/KnowledgeBaseService';
import { DocumentCard } from './components/DocumentCard';
import { KnowledgeChat } from './components/KnowledgeChat';

export default function KnowledgeBase() {
    const toast = useToast();
    const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [activeChatDoc, setActiveChatDoc] = useState<KnowledgeDoc | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const docs = await knowledgeBaseService.getDocuments();
            setDocuments(docs);
        } catch (error) {
            toast.error("Failed to load Knowledge Base.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setIsUploading(true);
        toast.info(`Uploading ${files.length} file(s)...`);

        try {
            const count = await knowledgeBaseService.uploadFiles(files, (name) => {
                // Optional: Toast for each file, but might be too noisy
            });

            if (count > 0) {
                toast.success(`Successfully added ${count} document(s).`);
                await loadDocuments();
            } else {
                toast.error("Upload failed.");
            }
        } catch (error) {
            toast.error("Upload encountered an error.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (doc: KnowledgeDoc) => {
        if (!confirm(`Delete "${doc.title}"?`)) return;

        try {
            await knowledgeBaseService.deleteDocument(doc.rawName);
            toast.success("Document deleted.");
            await loadDocuments();
        } catch (err) {
            toast.error("Failed to delete document.");
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

    return (
        <div className="h-full flex flex-col bg-bg-dark text-white overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-8"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Header Section */}
                <div className="flex items-center justify-between mb-10">
                    <div className="animate-in fade-in slide-in-from-left duration-700">
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="text-4xl font-black flex items-center gap-3">
                                <Book className="text-[#FFE135]" size={36} />
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                                    Knowledge Base
                                </span>
                            </h1>
                            <span className="text-[10px] font-black bg-[#FFE135] text-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-[0_0_15px_rgba(255,225,53,0.3)]">Beta</span>
                        </div>
                        <p className="text-gray-500 text-lg font-medium tracking-tight">Central Neural Repository & Document Intelligence</p>
                    </div>
                    <div className="flex gap-4 animate-in fade-in slide-in-from-right duration-700">
                        <button
                            onClick={toggleGlobalChat}
                            className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all duration-500 transform active:scale-95 ${isChatOpen
                                ? 'bg-[#FFE135] text-black shadow-[0_0_30px_rgba(255,225,53,0.4)] scale-105'
                                : 'bg-[#161b22] text-gray-300 border border-gray-800 hover:border-[#FFE135]/40 hover:text-white'
                                }`}
                        >
                            <Sparkles size={20} className={isChatOpen ? 'animate-spin-slow' : ''} />
                            {isChatOpen ? 'Neural Connection Active' : 'Initialize Neural Chat'}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="px-6 py-3 bg-[#FFE135]/10 border border-[#FFE135]/30 hover:bg-[#FFE135]/20 text-[#FFE135] disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-2xl transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                            {isUploading ? 'Ingesting...' : 'Ingest Document'}
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.pdf"
                        multiple
                    />
                </div>

                {/* Search Bar */}
                <div className="relative mb-12 max-w-3xl animate-in fade-in slide-in-from-bottom duration-1000">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="text-gray-600 group-focus-within:text-[#FFE135] transition-colors" size={22} />
                    </div>
                    <input
                        type="text"
                        placeholder="Scan neural index for vectors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#161b22]/40 backdrop-blur-md border border-gray-800/80 focus:border-[#FFE135]/50 text-white rounded-2xl pl-14 pr-6 py-5 focus:ring-4 focus:ring-[#FFE135]/5 transition-all placeholder-gray-700 text-xl font-medium shadow-2xl"
                    />
                    {isDragging && (
                        <div className="absolute inset-0 bg-[#FFE135]/10 border-2 border-[#FFE135] border-dashed rounded-2xl flex items-center justify-center backdrop-blur-md z-10 animate-pulse">
                            <p className="text-[#FFE135] font-black text-2xl flex items-center gap-3 uppercase tracking-tighter">
                                <Upload size={32} /> Release to Ingest
                            </p>
                        </div>
                    )}
                </div>

                {/* Content Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
                        <Loader2 className="animate-spin text-[#FFE135]" size={48} />
                        <p className="animate-pulse">Accessing Neural Archives...</p>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-600 border-2 border-dashed border-gray-800 rounded-3xl">
                        <Upload size={48} className="mb-4 opacity-50" />
                        <p className="text-xl font-medium">No documents found</p>
                        <p className="text-sm mt-2">Upload files or drag & drop to populate the Knowledge Base</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        {filteredDocs.map(doc => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onDelete={handleDelete}
                                onChat={handleChat}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Chat Sidebar Overlay */}
            <KnowledgeChat
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                activeDoc={activeChatDoc}
            />
        </div>
    );
}
