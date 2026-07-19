import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Book, Search, FileText, ChevronRight, Upload, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { knowledgeBaseService, type KnowledgeDoc } from '@/modules/knowledge/services/KnowledgeBaseService';

interface KnowledgePanelProps {
    toggleRightPanel: () => void;
}

export default function KnowledgePanel({ toggleRightPanel }: KnowledgePanelProps) {
    const toast = useToast();
    const currentProjectId = useStore(state => state.currentProjectId);
    const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshDocuments = useCallback(async () => {
        setIsLoading(true);
        try {
            setDocuments(await knowledgeBaseService.getDocuments(currentProjectId || undefined));
        } catch {
            toast.error('Unable to load Knowledge Base documents.');
        } finally {
            setIsLoading(false);
        }
    }, [currentProjectId, toast]);

    useEffect(() => {
        void refreshDocuments();
    }, [refreshDocuments]);

    const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        event.target.value = '';
        if (!files?.length) return;

        setIsUploading(true);
        try {
            const uploadedCount = await knowledgeBaseService.uploadFiles(files, currentProjectId || undefined);
            if (uploadedCount !== files.length) {
                toast.error(`Only ${uploadedCount} of ${files.length} document(s) were indexed.`);
            } else {
                toast.success(`${uploadedCount} document${uploadedCount === 1 ? '' : 's'} indexed.`);
            }
            await refreshDocuments();
        } finally {
            setIsUploading(false);
        }
    };

    const latestDocumentTimestamp = documents
        .map((document) => Date.parse(document.date))
        .filter(Number.isFinite)
        .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-bg-dark to-bg-dark/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-violet-500/10 rounded-lg">
                        <Book size={14} className="text-violet-400" />
                    </div>
                    Knowledge Base
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">DOCUMENTS</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        multiple
                        accept=".pdf,.txt,.md,.doc,.docx,text/plain,text/markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFilesSelected}
                    />
                    <motion.button
                        whileHover={{ scale: isUploading ? 1 : 1.02 }}
                        whileTap={{ scale: isUploading ? 1 : 0.98 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full bg-linear-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2 border border-violet-400/20"
                    >
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {isUploading ? 'Indexing Document…' : 'Ingest Document'}
                    </motion.button>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">INDEX STATS</label>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><FileText size={14} /> Indexed Files</span>
                            <span className="text-xs text-violet-400 font-mono">{isLoading ? 'Loading…' : documents.length.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Search size={14} /> Retrieval Index</span>
                            <span className="text-xs text-gray-300 font-mono">Gemini File Search</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Search size={14} /> Last Sync</span>
                            <span className="text-xs text-gray-300 font-mono">
                                {latestDocumentTimestamp > 0 ? new Date(latestDocumentTimestamp).toLocaleString() : 'Never'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
