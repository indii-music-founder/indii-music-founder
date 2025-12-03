import React, { useState } from 'react';
import { Book, Upload, FileText, Search, Filter, MoreVertical, File, Clock } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export default function KnowledgeBase() {
    const toast = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            toast.info(`Uploading ${files.length} files... (Mock)`);
        }
    };

    const handleUploadClick = () => {
        toast.info("Open file dialog (Mock)");
    };

    // Mock Documents
    const documents = [
        { id: 1, title: "Brand Guidelines 2024", type: "PDF", size: "2.4 MB", date: "2 days ago", tag: "Design" },
        { id: 2, title: "Q4 Marketing Strategy", type: "DOCX", size: "1.1 MB", date: "1 week ago", tag: "Marketing" },
        { id: 3, title: "Artist Contract Template", type: "PDF", size: "540 KB", date: "2 weeks ago", tag: "Legal" },
        { id: 4, title: "Project Alpha Notes", type: "TXT", size: "12 KB", date: "3 weeks ago", tag: "General" },
        { id: 5, title: "Competitor Analysis", type: "PDF", size: "3.8 MB", date: "1 month ago", tag: "Strategy" },
    ];

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
                    <p className="text-gray-400">Central repository for your project assets and documents.</p>
                </div>
                <button
                    onClick={handleUploadClick}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                    <Upload size={20} /> Upload Document
                </button>
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
            >
                <Upload size={32} className={`mb-3 ${isDragging ? 'text-emerald-500' : 'text-gray-500'}`} />
                <p className="text-gray-400 font-medium">Drag and drop files here to upload</p>
                <p className="text-xs text-gray-600 mt-1">Supported formats: PDF, DOCX, TXT, MD</p>
            </div>

            {/* Document List */}
            <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2 text-right">Modified</div>
                </div>

                <div className="divide-y divide-gray-800">
                    {filteredDocs.map(doc => (
                        <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-800/50 transition-colors items-center group cursor-pointer">
                            <div className="col-span-6 flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${doc.type === 'PDF' ? 'bg-red-500/10 text-red-400' :
                                        doc.type === 'DOCX' ? 'bg-blue-500/10 text-blue-400' :
                                            'bg-gray-700/50 text-gray-400'
                                    }`}>
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-200 group-hover:text-white transition-colors">{doc.title}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-gray-600"></span>
                                        {doc.tag}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2 text-sm text-gray-400 font-mono">{doc.type}</div>
                            <div className="col-span-2 text-sm text-gray-400 font-mono">{doc.size}</div>
                            <div className="col-span-2 text-right text-sm text-gray-400 flex items-center justify-end gap-2">
                                <span className="flex items-center gap-1">
                                    <Clock size={12} /> {doc.date}
                                </span>
                                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400 transition-opacity">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredDocs.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No documents found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
