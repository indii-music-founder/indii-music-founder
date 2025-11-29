import React from 'react';
import { X, Download, Share2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreativeCanvasProps {
    item: { id: string; url: string; prompt: string; type: 'image' | 'video' } | null;
    onClose: () => void;
}

export default function CreativeCanvas({ item, onClose }: CreativeCanvasProps) {
    if (!item) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-5xl w-full max-h-[90vh] bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#1a1a1a]">
                        <div>
                            <h3 className="text-sm font-bold text-white">Canvas Preview</h3>
                            <p className="text-xs text-gray-400 line-clamp-1 max-w-md">{item.prompt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <Wand2 size={18} />
                            </button>
                            <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <Download size={18} />
                            </button>
                            <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <Share2 size={18} />
                            </button>
                            <div className="w-px h-6 bg-gray-800 mx-2"></div>
                            <button onClick={onClose} className="p-2 hover:bg-red-900/50 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-[#0f0f0f]">
                        {item.type === 'video' ? (
                            <video src={item.url} controls className="max-w-full max-h-full object-contain shadow-2xl" />
                        ) : (
                            <img src={item.url} alt={item.prompt} className="max-w-full max-h-full object-contain shadow-2xl" />
                        )}
                    </div>

                    {/* Footer / Controls */}
                    <div className="p-4 border-t border-gray-800 bg-[#1a1a1a]">
                        <div className="flex gap-4 justify-center">
                            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors">
                                Remix This
                            </button>
                            <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-colors">
                                Use as Reference
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
