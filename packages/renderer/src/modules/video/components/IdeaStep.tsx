import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface IdeaStepProps {
    initialPrompt: string;
    onPromptChange: (prompt: string) => void;
    onNext: () => void;
    isThinking: boolean;
}

const IdeaStep: React.FC<IdeaStepProps> = ({ initialPrompt, onPromptChange, onNext, isThinking }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Describe your video idea
                </label>
                <textarea
                    value={initialPrompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder="e.g., A futuristic city with flying cars in a cyberpunk style..."
                    className="w-full h-40 bg-black/50 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
            </div>

            <div className="flex justify-end">
                <button
                    onClick={onNext}
                    disabled={!initialPrompt.trim() || isThinking}
                    className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                >
                    {isThinking ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            Start Briefing <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default IdeaStep;
