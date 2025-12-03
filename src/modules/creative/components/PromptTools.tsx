import React, { useState } from 'react';
import { Wand2, Sparkles, X, Loader2, Check, RefreshCw } from 'lucide-react';
import { AI } from '@/services/ai/AIService';
import { useToast } from '@/core/context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptToolsProps {
    currentPrompt: string;
    onUpdatePrompt: (newPrompt: string) => void;
}

export default function PromptTools({ currentPrompt, onUpdatePrompt }: PromptToolsProps) {
    const toast = useToast();
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [showImprover, setShowImprover] = useState(false);
    const [improverLoading, setImproverLoading] = useState(false);
    const [variations, setVariations] = useState<any[]>([]);

    const handleMagicWords = async () => {
        setIsMagicLoading(true);
        try {
            const response = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: currentPrompt ? `Enhance: "${currentPrompt}"` : "Generate 8 artistic adjectives." }] },
                config: {
                    systemInstruction: "Return a simple comma-separated list of 6-8 descriptive adjectives. Do not use Markdown. Do not use JSON.",
                    temperature: 1.0
                }
            });

            const words = (response.text() || '').replace(/```[\s\S]*?```/g, '').replace(/[\{\}\[\]"]/g, '').trim();
            if (words) {
                onUpdatePrompt(currentPrompt + (currentPrompt ? ', ' : '') + words);
            }
        } catch (e) {
            console.error("Magic Words Error:", e);
            toast.error("Failed to conjure magic words.");
        } finally {
            setIsMagicLoading(false);
        }
    };

    const handleImprover = async (promptToImprove: string = currentPrompt) => {
        if (!promptToImprove) return;
        setShowImprover(true);
        setImproverLoading(true);
        setVariations([]);

        try {
            const systemInstruction = `You are an Expert Image Prompt Engineer. Transform the conceptual idea into a six-part comprehensive visual script (Intent, Subject, Environment, Lighting, Technical, Composition). Generate 4 distinct variations (e.g. Cinematic, Artistic, Realistic, Abstract). Return strictly JSON: { "variations": [{ "title": "...", "text": "..." }] }`;

            const response = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: `Original Concept: "${promptToImprove}"` }] },
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text() || "{}";
            // Clean up markdown code blocks if present
            const jsonStr = text.replace(/```json\n?|\n?```/g, '');
            const data = JSON.parse(jsonStr);

            if (data.variations) {
                setVariations(data.variations);
            }
        } catch (e) {
            console.error("Improver Error:", e);
            toast.error("Failed to improve prompt.");
            setShowImprover(false);
        } finally {
            setImproverLoading(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-1">
                <button
                    onClick={handleMagicWords}
                    disabled={isMagicLoading}
                    className="p-1.5 text-purple-400 hover:text-purple-200 hover:bg-purple-900/30 rounded transition-colors"
                    title="Conjure Magic Words"
                >
                    {isMagicLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                </button>
                <button
                    onClick={() => handleImprover()}
                    disabled={!currentPrompt}
                    className="p-1.5 text-blue-400 hover:text-blue-200 hover:bg-blue-900/30 rounded transition-colors"
                    title="Prompt Improver"
                >
                    <Sparkles size={14} />
                </button>
            </div>

            {/* Improver Modal */}
            <AnimatePresence>
                {showImprover && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-gray-700 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
                        >
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Sparkles size={16} className="text-blue-400" />
                                    Prompt Improver
                                </h3>
                                <button onClick={() => setShowImprover(false)} className="text-gray-500 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {improverLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                                        <Loader2 size={32} className="animate-spin text-blue-500" />
                                        <p className="text-gray-400 text-sm animate-pulse">Consulting the Oracle...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {variations.map((v, idx) => (
                                            <div key={idx} className="bg-[#252628] border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-all group relative">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wider">{v.title}</h4>
                                                    <button
                                                        onClick={() => handleImprover(v.text)}
                                                        className="text-[10px] bg-purple-900/30 text-purple-400 hover:bg-purple-600 hover:text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                                                    >
                                                        <RefreshCw size={10} /> Refine
                                                    </button>
                                                </div>
                                                <textarea
                                                    readOnly
                                                    className="w-full bg-[#1a1b1d] text-gray-300 text-xs resize-none outline-none h-24 custom-scrollbar border border-gray-700 rounded p-2 mb-2"
                                                    value={v.text}
                                                />
                                                <button
                                                    onClick={() => {
                                                        onUpdatePrompt(v.text);
                                                        setShowImprover(false);
                                                    }}
                                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-2"
                                                >
                                                    <Check size={12} /> Use This Prompt
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
