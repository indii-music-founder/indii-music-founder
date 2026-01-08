import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Paperclip, Mic, Globe, Image as ImageIcon, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import QuickActions from './QuickActions';

// Import AI service for error checking (optional here if handled in agent layer)
// But we want to show strict status

import { agentService } from '@/services/agent/AgentService';

// ... (existing imports)

export default function AgentWorkspace() {
    const [input, setInput] = useState('');
    // Remove local isGenerating/thinkingSteps state in favor of store
    const { agentHistory } = useStore();

    // Derive state from the latest message in history
    const lastMessage = agentHistory[agentHistory.length - 1];
    const isGenerating = lastMessage?.role === 'model' && lastMessage?.isStreaming;
    const thinkingSteps = lastMessage?.thoughts?.map(t => t.text) || [];

    const handleSend = () => {
        if (!input.trim()) return;

        // Dispatch to real AgentService
        agentService.sendMessage(input);

        setInput('');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Area - Compact */}
            <div className="flex items-end justify-between px-2">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-xl font-bold text-white mb-1">Agent Workspace</h1>
                    <p className="text-xs text-stone-400">Indi is ready to assist.</p>
                </motion.div>

                {/* Stats / Status Pill */}
                <div className="flex gap-3">
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 bg-[#161b22] px-3 py-1.5 rounded-full border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        System Active
                    </div>
                </div>
            </div>

            {/* Quick Actions Integration */}
            <QuickActions />

            {/* Main Chat/Input Area */}
            <motion.div
                className="bg-[#161b22] border border-gray-800 rounded-xl shadow-2xl relative overflow-hidden flex flex-col"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                {/* "Active Thinking" Overlay */}
                <AnimatePresence>
                    {isGenerating && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-stone-900/50 backdrop-blur-sm border-b border-gray-800 p-2"
                        >
                            <div className="flex items-center gap-3 text-xs text-stone-300 px-2">
                                <RefreshCw className="animate-spin text-stone-500" size={14} />
                                <span className="font-mono text-stone-400">Processing...</span>
                            </div>
                            <div className="pl-8 mt-1 space-y-0.5">
                                {thinkingSteps.map((step, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-[10px] text-stone-500 flex items-center gap-2 truncate"
                                    >
                                        <div className="w-0.5 h-0.5 rounded-full bg-stone-600" />
                                        {step}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Field */}
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe your task, update context, or assign a mission..."
                        className="w-full bg-[#0d1117] text-white p-4 pb-14 min-h-[140px] focus:outline-none resize-none text-base placeholder:text-gray-600"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />

                    {/* Toolbar */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <div className="flex gap-1 pointer-events-auto">
                            <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Attach File">
                                <Paperclip size={16} />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Use Camera">
                                <ImageIcon size={16} />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Voice Input">
                                <Mic size={16} />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Browse Web">
                                <Globe size={16} />
                            </button>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isGenerating}
                            className={`pointer-events-auto flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${input.trim() && !isGenerating
                                ? 'bg-stone-100 text-black hover:bg-white hover:shadow-lg'
                                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                                }`}
                        >
                            <span>Run</span>
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Context Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#161b22]/50">
                    <div className="p-2 rounded bg-green-500/10 text-green-500">
                        <CheckCircle size={14} />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-300">Last Completed</div>
                        <div className="text-[10px] text-gray-500">No recent tasks</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#161b22]/50">
                    <div className="p-2 rounded bg-amber-500/10 text-amber-500">
                        <AlertCircle size={14} />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-300">Active Context</div>
                        <div className="text-[10px] text-gray-500">Untitled Project • Default Brand Kit</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
