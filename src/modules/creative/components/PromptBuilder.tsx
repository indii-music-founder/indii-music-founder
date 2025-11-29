import React, { useState } from 'react';
import { STUDIO_TAGS } from '@/legacy/constants';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptBuilderProps {
    onAddTag: (tag: string) => void;
}

export default function PromptBuilder({ onAddTag }: PromptBuilderProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-2 p-2 bg-[#111] border-b border-gray-800">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Prompt Engineering</p>
            <div className="flex flex-wrap gap-2">
                {Object.entries(STUDIO_TAGS).map(([category, values]) => (
                    <div key={category} className="relative">
                        <button
                            onClick={() => setOpenCategory(openCategory === category ? null : category)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1 ${openCategory === category
                                ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                                : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:border-gray-500'
                                }`}
                        >
                            {category}
                            {openCategory === category ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>

                        <AnimatePresence>
                            {openCategory === category && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className="absolute top-full left-0 mt-2 w-64 max-h-60 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 p-2 custom-scrollbar"
                                >
                                    {Array.isArray(values) ? (
                                        <div className="flex flex-wrap gap-1">
                                            {values.map((tag) => (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        onAddTag(tag);
                                                        setOpenCategory(null);
                                                    }}
                                                    className="px-2 py-1 text-[10px] bg-[#222] hover:bg-purple-900/50 text-gray-300 hover:text-white rounded border border-gray-800 hover:border-purple-500 transition-colors text-left"
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {Object.entries(values).map(([subCat, tags]) => (
                                                <div key={subCat}>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{subCat}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {tags.map((tag) => (
                                                            <button
                                                                key={tag}
                                                                onClick={() => {
                                                                    onAddTag(tag);
                                                                    setOpenCategory(null);
                                                                }}
                                                                className="px-2 py-1 text-[10px] bg-[#222] hover:bg-purple-900/50 text-gray-300 hover:text-white rounded border border-gray-800 hover:border-purple-500 transition-colors text-left"
                                                            >
                                                                {tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
}
