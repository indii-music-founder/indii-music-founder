import React from 'react';
import { FileText, Trash2, MessageSquare, Eye, FileCode, FileSpreadsheet, File } from 'lucide-react';
import { KnowledgeDoc } from '../services/KnowledgeBaseService';

interface DocumentCardProps {
    doc: KnowledgeDoc;
    onDelete: (doc: KnowledgeDoc) => void;
    onChat: (doc: KnowledgeDoc) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onDelete, onChat }) => {

    const getIcon = () => {
        if (doc.type === 'PDF') return <FileText size={32} className="text-red-400" />;
        if (doc.type === 'MD' || doc.type === 'TXT') return <FileCode size={32} className="text-emerald-400" />;
        return <File size={32} className="text-blue-400" />;
    };

    return (
        <div className="group relative w-full h-48 perspective-1000">
            <div className="absolute inset-0 bg-[#161b22]/80 backdrop-blur-md border border-gray-800 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 transform group-hover:scale-105 group-hover:-translate-y-2 group-hover:border-[#FFE135]/30 group-hover:shadow-[0_0_20px_rgba(255,225,53,0.1)]">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="p-3 bg-gray-800/50 rounded-xl group-hover:bg-[#FFE135]/10 transition-colors">
                        {getIcon()}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onChat(doc); }}
                            className="p-2 bg-gray-800 hover:bg-[#FFE135] text-gray-400 hover:text-black rounded-lg transition-colors"
                            title="Chat with Document"
                        >
                            <MessageSquare size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
                            className="p-2 bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white rounded-lg transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div>
                    <h3 className="text-white font-medium truncate mb-1 text-lg group-hover:text-[#FFE135] transition-colors">{doc.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                        <span>{doc.type}</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                        <span>{doc.size}</span>
                    </div>
                </div>

                {/* Active Indicator */}
                {doc.status === 'indexed' && (
                    <div className="absolute bottom-6 right-6 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                )}
            </div>
        </div>
    );
};
