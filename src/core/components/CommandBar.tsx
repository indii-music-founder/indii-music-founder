import React, { useState, useEffect } from 'react';
import { Command, ArrowRight, Loader2 } from 'lucide-react';
import { Orchestrator } from '@/services/agent/OrchestratorService';
import { useStore } from '@/core/store';

export default function CommandBar() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');

    // Toggle with Cmd+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setIsProcessing(true);
        setStatus('Orchestrator is thinking...');

        try {
            const target = await Orchestrator.executeRouting(input);
            setStatus(`Routing to ${target.toUpperCase()}...`);

            // Short delay to show the status
            setTimeout(() => {
                setIsOpen(false);
                setInput('');
                setStatus('');
                setIsProcessing(false);
            }, 1000);
        } catch (error) {
            setStatus('Routing failed.');
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm transition-all">
            <div className="w-full max-w-2xl bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit} className="relative flex items-center p-4">
                    <Command className="w-6 h-6 text-gray-400 mr-4" />
                    <input
                        autoFocus
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask indii to do something (e.g., 'Draft a contract', 'Compose a song')..."
                        className="flex-1 bg-transparent text-xl text-white placeholder-gray-500 outline-none"
                    />
                    {isProcessing ? (
                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                    ) : (
                        <button type="submit" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                            <ArrowRight className="w-6 h-6 text-gray-400" />
                        </button>
                    )}
                </form>

                {status && (
                    <div className="px-4 py-2 bg-gray-800/50 text-sm text-purple-400 border-t border-gray-700">
                        {status}
                    </div>
                )}

                <div className="px-4 py-2 bg-gray-900/50 text-xs text-gray-500 border-t border-gray-800 flex justify-between">
                    <span>Orchestrator Active</span>
                    <span>Press ESC to close</span>
                </div>
            </div>

            {/* Backdrop click to close */}
            <div className="absolute inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </div>
    );
}
