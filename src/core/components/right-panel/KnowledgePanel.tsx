import React from 'react';
import { Book, Search, Library, Tags, FileText, ChevronRight, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';

interface KnowledgePanelProps {
    toggleRightPanel: () => void;
}

export default function KnowledgePanel({ toggleRightPanel }: KnowledgePanelProps) {
    const toast = useToast();

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-bg-dark to-bg-dark/90">
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
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toast.info("Opening upload dialog")}
                        className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-900/20 flex items-center justify-center gap-2 border border-violet-400/20"
                    >
                        <Upload size={16} />
                        Ingest Document
                    </motion.button>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">INDEX STATS</label>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><FileText size={14} /> Indexed Files</span>
                            <span className="text-xs text-violet-400 font-mono">1,240</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Library size={14} /> Vectors</span>
                            <span className="text-xs text-gray-300 font-mono">82.4k</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Search size={14} /> Last Sync</span>
                            <span className="text-xs text-gray-300 font-mono">2 mins ago</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">ONTOLOGY</label>
                    <button className="w-full p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-2 text-sm text-gray-300 group-hover:text-white">
                            <Tags size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                            Manage Tags
                        </div>
                        <ChevronRight size={14} className="text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
}
