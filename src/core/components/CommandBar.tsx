import React, { useState } from 'react';
import { ArrowRight, Loader2, Paperclip, Camera, Mic, Image } from 'lucide-react';
import { Orchestrator } from '@/services/agent/OrchestratorService';

export default function CommandBar() {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setIsProcessing(true);
        setStatus('Orchestrator is thinking...');

        try {
            const target = await Orchestrator.executeRouting(input);
            setStatus(`Routing to ${target.toUpperCase()}...`);

            setTimeout(() => {
                setInput('');
                setStatus('');
                setIsProcessing(false);
            }, 1000);
        } catch (error) {
            setStatus('Routing failed.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full bg-[#0d1117] border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Input Area */}
                <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Describe your creative task or goal..."
                            className="w-full bg-transparent text-gray-200 placeholder-gray-600 px-4 py-3 outline-none"
                        />

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-2 pb-2">
                            <div className="flex items-center gap-1">
                                <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors">
                                    <Paperclip size={14} />
                                    Attach Files
                                </button>
                                <button type="button" className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors">
                                    <Camera size={14} />
                                </button>
                                <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                                <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors">
                                    <span>Delegate to Orchestrator AI</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button type="button" className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors">
                                    <Mic size={14} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isProcessing}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    {isProcessing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <>
                                            Run
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex justify-end mt-2">
                    <span className="text-[10px] text-gray-600 flex items-center gap-1">
                        <span className="text-yellow-500">✦</span> Powered by Gemini
                    </span>
                </div>
            </div>
        </div>
    );
}
