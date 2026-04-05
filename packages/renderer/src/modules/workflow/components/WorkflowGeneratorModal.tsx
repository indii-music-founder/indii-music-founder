import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface WorkflowGeneratorModalProps {
    onClose: () => void;
    onGenerate: (prompt: string) => Promise<void>;
}

export default function WorkflowGeneratorModal({ onClose, onGenerate }: WorkflowGeneratorModalProps) {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            await onGenerate(prompt);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="text-purple-500" /> AI Workflow Architect
                </h2>
                <p className="text-gray-400 mb-4 text-sm">
                    Describe what you want to build (e.g., "Take a song, analyze it, generate a music video, and create a marketing campaign").
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your workflow..."
                    className="w-full h-32 bg-[#0f0f0f] border border-gray-700 rounded-lg p-4 text-white focus:border-purple-500 outline-none resize-none mb-4"
                    autoFocus
                />
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="flex-1 py-3 bg-white hover:bg-gray-200 text-black rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                        {isGenerating ? 'Designing...' : 'Generate Workflow'}
                    </button>
                </div>
            </div>
        </div>
    );
}
