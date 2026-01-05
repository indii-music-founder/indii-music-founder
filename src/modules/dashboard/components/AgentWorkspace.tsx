import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Paperclip, Mic, Globe, Image as ImageIcon, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import QuickActions from './QuickActions';

// Import AI service for error checking (optional here if handled in agent layer)
// But we want to show strict status

export default function AgentWorkspace() {
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const { agentOverview, agentHistory } = useStore();

    // Mock thinking steps for visual feedback if agent triggers them
    // Real implementation would sync with agent events
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);

    const handleSend = () => {
        if (!input.trim()) return;
        // Logic to dispatch to agent would go here, usually via a Store action or Service
        // For now, we simulate the UI state
        setIsGenerating(true);
        setThinkingSteps(['Analyzing request...', 'Accessing tools...', 'Generating response...']);

        // This is a UI-only representation for the refactor
        setTimeout(() => setIsGenerating(false), 2000);
        setInput('');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Context Header */}
            <div className="text-center space-y-2">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <h2 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-stone-200 to-stone-500">
                        What are we building today?
                    </h2>
                    <p className="text-stone-400">Indi is ready to assist with Marketing, Publishing, or Creative tasks.</p>
                </motion.div>
            </div>

            {/* Quick Actions Integration */}
            <QuickActions />

            {/* Main Chat/Input Area */}
            <motion.div
                className="bg-[#161b22] border border-gray-800 rounded-2xl p-4 shadow-2xl relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
            >
                {/* "Active Thinking" Overlay */}
                <AnimatePresence>
                    {isGenerating && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-stone-900/50 backdrop-blur-sm border-b border-gray-800 p-3 mb-4 rounded-lg"
                        >
                            <div className="flex items-center gap-3 text-sm text-stone-300">
                                <RefreshCw className="animate-spin text-stone-500" size={16} />
                                <span className="font-mono">Indi is thinking...</span>
                            </div>
                            <div className="pl-7 mt-2 space-y-1">
                                {thinkingSteps.map((step, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.2 }}
                                        className="text-xs text-stone-500 flex items-center gap-2"
                                    >
                                        <div className="w-1 h-1 rounded-full bg-stone-600" />
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
                        placeholder="Describe your task, drop files, or ask for updates..."
                        className="w-full bg-[#0d1117] text-white rounded-xl p-4 pr-32 min-h-[120px] focus:ring-2 focus:ring-stone-500/50 outline-none resize-none border border-transparent focus:border-stone-700 transition-all placeholder:text-gray-600"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />

                    {/* Toolbar */}
                    <div className="absolute bottom-3 left-3 flex gap-2">
                        <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Attach File">
                            <Paperclip size={18} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Use Camera">
                            <ImageIcon size={18} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Voice Input">
                            <Mic size={18} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Browse Web">
                            <Globe size={18} />
                        </button>
                    </div>

                    {/* Send Button */}
                    <div className="absolute bottom-3 right-3">
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isGenerating}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${input.trim() && !isGenerating
                                    ? 'bg-stone-100 text-black hover:bg-white hover:shadow-lg hover:shadow-stone-500/20'
                                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                                }`}
                        >
                            <span>Run</span>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Recent History / Context (Simplified for Workspace) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-800 bg-[#161b22]/50 hover:border-gray-700 transition-colors">
                    <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" /> Completed Tasks
                    </h3>
                    <div className="text-xs text-gray-500 space-y-2">
                        {/* Placeholder for history list */}
                        <p>No recent tasks completed in this session.</p>
                    </div>
                </div>
                <div className="p-4 rounded-xl border border-gray-800 bg-[#161b22]/50 hover:border-gray-700 transition-colors">
                    <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <AlertCircle size={14} className="text-yellow-500" /> Active Context
                    </h3>
                    <div className="text-xs text-gray-500 space-y-2">
                        <p>Project: <span className="text-gray-300">Untitled</span></p>
                        <p>Brand Kit: <span className="text-gray-300">Default</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
