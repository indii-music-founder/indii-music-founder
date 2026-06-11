import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, BotMessageSquare } from 'lucide-react';

interface BriefingStepProps {
    initialPrompt: string;
    questions: string[];
    answers: Record<string, string>;
    onAnswerChange: (question: string, answer: string) => void;
    onBack: () => void;
    onNext: () => void;
    isThinking: boolean;
}

const BriefingStep: React.FC<BriefingStepProps> = ({
    initialPrompt,
    questions,
    answers,
    onAnswerChange,
    onBack,
    onNext,
    isThinking
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-start gap-3">
                <BotMessageSquare className="text-purple-400 flex-shrink-0 mt-1" size={20} />
                <div>
                    <h4 className="text-purple-300 font-medium mb-1">AI Director</h4>
                    <p className="text-sm text-purple-200/80">
                        I've analyzed your idea: <span className="italic text-white">"{initialPrompt}"</span>.
                        To make this video perfect, I have a few questions.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {questions.map((question, index) => (
                    <div key={index} className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            {question}
                        </label>
                        <input
                            type="text"
                            value={answers[question] || ''}
                            onChange={(e) => onAnswerChange(question, e.target.value)}
                            placeholder="Your answer..."
                            className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>
                ))}
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    disabled={isThinking}
                    className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <button
                    onClick={onNext}
                    disabled={isThinking}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isThinking ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Finalizing...
                        </>
                    ) : (
                        <>
                            Review Brief <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BriefingStep;
