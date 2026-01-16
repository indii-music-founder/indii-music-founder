import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, FileJson } from 'lucide-react';

interface JsonViewerProps {
    data: unknown;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="my-4 p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-10 text-[11px] font-bold text-gray-400 hover:text-purple-300 flex items-center gap-3 transition-colors uppercase tracking-widest"
            >
                <div className={`p-1.5 rounded-lg border border-white/10 bg-white/5 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={12} />
                </div>
                <div className="flex items-center gap-2">
                    <FileJson size={14} className="text-purple-400/70" />
                    <span>{isOpen ? 'Secure Payload' : 'View Payload Data'}</span>
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="relative z-10"
                    >
                        <pre className="mt-4 text-[10px] text-gray-500 overflow-x-auto custom-scrollbar p-3 bg-black/60 rounded-xl border border-white/5 font-mono leading-relaxed">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
