import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Search, Filter, Loader2, Book, Clock } from 'lucide-react';
import { GeminiRetrieval } from '@/services/rag/GeminiRetrievalService';
import { processForKnowledgeBase } from '@/services/rag/ragService';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';

// Using a slightly more robust type for internal state
interface KnowledgeDoc {
    id: string; // The file URI or embedding ID
    title: string;
    type: string;
    size: string;
    date: string;
    status: 'indexed' | 'processing' | 'error';
    rawName: string; // The full files/URI
}

export default function KnowledgeBase() {
    const toast = useToast();
    const { userProfile, setUserProfile } = useStore();
    const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const { files } = await GeminiRetrieval.listFiles();

            // Map Gemini files to our UI model
            const docs: KnowledgeDoc[] = (files || []).map((f: any) => ({
                id: f.name,
                title: f.displayName || f.name.split('/').pop(), // Fallback if no specific display name
                type: f.mimeType.includes('pdf') ? 'PDF' : 'TXT', // Simple mapping
                size: f.sizeBytes ? `${(parseInt(f.sizeBytes) / 1024).toFixed(1)} KB` : 'Unknown',
                date: new Date(f.createTime).toLocaleDateString(),
                status: 'indexed',
                rawName: f.name
            }));

            setDocuments(docs);
        } catch (error) {
            console.error("Failed to load docs:", error);
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
        toast.info(`Uploading ${files.length} file(s) to Gemini...`);

        let successCount = 0;
        const uploadPromises: Promise<void>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            uploadPromises.push((async () => {
                try {
                    const result = await processForKnowledgeBase(file, file.name, {
                        size: `${(file.size / 1024).toFixed(1)} KB`,
                        type: file.type,
                        originalDate: new Date(file.lastModified).toISOString()
                    });

                    if (result.embeddingId) {
                        toast.success(`Indexed: ${file.name}`);
                        successCount++;
                    } else {
                        throw new Error("Ingestion failed");
                    }
                } catch (err) {
                    console.error(`Upload Fail for ${file.name}:`, err);
                    toast.error(`Failed to upload ${file.name}`);
                }
            })());
        }

        await Promise.all(uploadPromises);

        if (successCount > 0) {
            toast.success(`Successfully added ${successCount} document(s) to Knowledge Base.`);
            await loadDocuments();
        }
        setIsUploading(false);
    };

    const handleDelete = async (doc: KnowledgeDoc) => {
        if (!confirm(`Are you sure you want to delete "${doc.title}"?`)) return;

        try {
            await GeminiRetrieval.deleteFile(doc.rawName);
            toast.success("Document deleted.");
            await loadDocuments();
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete document.");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Book className="text-emerald-500" />
                        Knowledge Base
                    </h1>
                    <p className="text-gray-400">Central repository. AI agents can access these documents.</p>
                </div>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                    {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                    {isUploading ? 'Uploading...' : 'Upload Document'}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    accept=".txt,.md,.json,.csv,.js,.ts,.tsx,.pdf" // Added .pdf
                    multiple
                />
            </div>

            {/* Search and Filter */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#161b22] border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
                <button className="p-2 bg-[#161b22] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                    <Filter size={20} />
                </button>
            </div>

            {/* Upload Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mb-8 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'
                    }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload size={32} className={`mb-3 ${isDragging ? 'text-emerald-500' : 'text-gray-500'}`} />
                <p className="text-gray-400 font-medium">Drag and drop files here to upload</p>
                <p className="text-xs text-gray-600 mt-1">Supported formats: TXT, MD, JSON, CSV, Code</p>
            </div>

            {/* Document List */}
            <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden min-h-[200px]">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="divide-y divide-gray-800">
                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center text-gray-500 gap-2">
                            <Loader2 className="animate-spin" size={16} /> Loading documents...
                        </div>
                    ) : filteredDocs.map(doc => (
                        <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-800/50 transition-colors items-center group">
                            <div className="col-span-6 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${['PDF', 'DOCX'].includes(doc.type) ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                                    }`}>
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-200 group-hover:text-white transition-colors">{doc.title}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                        Indexed
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2 text-sm text-gray-400 font-mono">{doc.type}</div>
                            <div className="col-span-2 text-sm text-gray-400 font-mono">{doc.size}</div>
                            <div className="col-span-2 text-right text-sm text-gray-400 flex items-center justify-end gap-2">
                                <span className="flex items-center gap-1 mr-2 text-xs opacity-50">
                                    <Clock size={12} /> {doc.date}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                                    className="p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400 transition-colors"
                                    title="Delete Document"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {!isLoading && filteredDocs.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            {documents.length === 0
                                ? "Knowledge Base is empty. Upload your first document!"
                                : `No documents found matching "${searchQuery}"`}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
