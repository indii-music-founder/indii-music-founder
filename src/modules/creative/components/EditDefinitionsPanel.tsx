import React from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { NANA_COLORS, NanaColor } from '../constants';

interface EditDefinitionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    definitions: Record<string, string>;
    onUpdateDefinition: (colorId: string, prompt: string) => void;
}

export default function EditDefinitionsPanel({
    isOpen,
    onClose,
    definitions,
    onUpdateDefinition
}: EditDefinitionsPanelProps) {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-[#1a1a1a] border-l border-gray-800 shadow-2xl z-40 flex flex-col"
        >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#111]">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="text-purple-500" size={16} />
                    Edit Definitions
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-3 flex gap-3 items-start">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-blue-200">
                        Map each color to a specific edit instruction. Areas marked with the color will be transformed based on your prompt.
                    </p>
                </div>

                {NANA_COLORS.map((color) => (
                    <div key={color.id} className="bg-[#222] rounded-xl border border-gray-800 overflow-hidden group focus-within:border-gray-600 transition-colors">
                        <div className="flex items-center gap-3 p-3 border-b border-gray-800/50 bg-[#1f1f1f]">
                            <div
                                className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
                                style={{ backgroundColor: color.hex }}
                            />
                            <span className="text-sm font-medium text-gray-300">{color.name}</span>
                        </div>
                        <div className="p-2">
                            <textarea
                                value={definitions[color.id] || ''}
                                onChange={(e) => onUpdateDefinition(color.id, e.target.value)}
                                placeholder={`e.g. Turn into ${color.name.toLowerCase()} neon lights...`}
                                className="w-full bg-transparent text-sm text-white placeholder-gray-600 border-none outline-none resize-none h-20 focus:ring-0"
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#111]">
                <button
                    onClick={onClose}
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                    Done
                </button>
            </div>
        </motion.div>
    );
}
