import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { BookMarked, Save, Trash2, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptLibraryProps {
    currentPrompt: string;
    onLoadPrompt: (text: string) => void;
}

export default function PromptLibrary({ currentPrompt, onLoadPrompt }: PromptLibraryProps) {
    const { savedPrompts, savePrompt, deletePrompt } = useStore();
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = () => {
        if (!currentPrompt.trim()) return alert("Enter a prompt to save.");
        const defaultTitle = currentPrompt.split(' ').slice(0, 4).join(' ') + '...';
        const title = prompt("Name this prompt:", defaultTitle);
        if (title) {
            savePrompt({
                id: crypto.randomUUID(),
                title,
                text: currentPrompt,
                date: Date.now()
            });
        }
    };

    return (
        <>
            <div className="flex items-center gap-1">
                <button
                    onClick={handleSave}
                    disabled={!currentPrompt}
                    className="p-1.5 text-green-400 hover:text-green-200 hover:bg-green-900/30 rounded transition-colors"
                    title="Save Prompt"
                >
                    <Save size={14} />
                </button>
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-1.5 text-yellow-400 hover:text-yellow-200 hover:bg-yellow-900/30 rounded transition-colors"
                    title="Prompt Library"
                >
                    <BookMarked size={14} />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-gray-700 rounded-xl w-full max-w-2xl max-h-[70vh] flex flex-col shadow-2xl"
                        >
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <BookMarked size={16} className="text-yellow-400" />
                                    Prompt Library
                                </h3>
                                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                                {savedPrompts.length === 0 ? (
                                    <p className="text-center text-gray-500 italic py-10">No saved prompts yet.</p>
                                ) : (
                                    savedPrompts.map((p) => (
                                        <div key={p.id} className="bg-[#252628] border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white text-sm truncate pr-4">{p.title}</h4>
                                                <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { onLoadPrompt(p.text); setIsOpen(false); }}
                                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1"
                                                    >
                                                        <Download size={10} /> Load
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm("Delete this prompt?")) deletePrompt(p.id);
                                                        }}
                                                        className="text-xs bg-red-900/50 hover:bg-red-600 text-red-200 px-2 py-1 rounded flex items-center gap-1"
                                                    >
                                                        <Trash2 size={10} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400 line-clamp-2 font-mono bg-[#111] p-2 rounded border border-gray-800">{p.text}</p>
                                            <p className="text-[10px] text-gray-600 mt-1 text-right">{new Date(p.date).toLocaleDateString()}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
