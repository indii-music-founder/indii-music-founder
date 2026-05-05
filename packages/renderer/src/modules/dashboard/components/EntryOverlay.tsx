import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, MessageSquare, Bot, X } from 'lucide-react';
import { useEntryContext, type QuickAction } from '../hooks/useEntryContext';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface EntryOverlayProps {
    onSubmit: (message: string) => void;
    onDismiss?: () => void;
}

export function EntryOverlay({ onSubmit, onDismiss }: EntryOverlayProps) {
    const {
        scenario,
        userName,
        memoryContext,
        suggestedActions,
        isLoading
    } = useEntryContext();

    const { isBoardroomMode } = useStore(useShallow(state => ({
        isBoardroomMode: state.isBoardroomMode
    })));

    const [input, setInput] = useState('');
    const [isDismissed, setIsDismissed] = useState(() => {
        return localStorage.getItem('indiiOS_entryOverlay_dismissed') === 'true';
    });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus();
        }
    }, [isLoading]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (input.trim()) {
            onSubmit(input);
            setInput('');
        }
    };

    const getGreeting = () => {
        if (scenario === 'new-user') return `Welcome to indiiOS, ${userName}.`;
        if (scenario === 'returning-active') return `Welcome back, ${userName}.`;
        return `Good to see you, ${userName}.`;
    };

    const getSubtext = () => {
        if (isLoading) return 'Scanning memory...';
        if (memoryContext) return memoryContext;
        if (scenario === 'new-user') return "I'm your AI creative engine. What should we build first?";
        if (scenario === 'returning-active') return "Ready to pick up where we left off?";
        return "What are we working on today?";
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        localStorage.setItem('indiiOS_entryOverlay_dismissed', 'true');
    };

    if (isBoardroomMode || isDismissed) {
        if (isDismissed && !isBoardroomMode) {
            return (
                <div className="w-full mt-4 flex justify-center">
                    <button 
                        onClick={() => {
                            setIsDismissed(false);
                            localStorage.removeItem('indiiOS_entryOverlay_dismissed');
                        }}
                        className="text-[10px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1 uppercase tracking-widest font-bold"
                    >
                        <Sparkles size={10} />
                        Restore Entry Assistant
                    </button>
                </div>
            );
        }
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="w-full mt-12 mb-8 max-w-3xl mx-auto relative group/overlay"
        >
            <div className="relative p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-2xl overflow-hidden group">
                {/* Close Button */}
                <button 
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 text-white/20 hover:text-white/60 hover:bg-white/10 transition-all opacity-0 group-hover/overlay:opacity-100 z-50"
                >
                    <X size={14} />
                </button>
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-dept-creative/5 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2" />

                {/* Dismiss Button */}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="absolute top-4 right-4 z-20 p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Dismiss Entry Assistant"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="relative z-10">
                    {/* Greeting & Context */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500/20 to-dept-creative/20 flex items-center justify-center border border-white/10 shrink-0">
                                <Bot size={20} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white tracking-tight">
                                    {getGreeting()}
                                </h3>
                                <p className="text-xs text-white/40 mt-0.5 line-clamp-1 italic font-medium">
                                    {getSubtext()}
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all sm:hidden"
                        >
                            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {!isCollapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                            >
                                {/* Primary Input */}
                                <form onSubmit={handleSubmit} className="relative mb-6">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask me anything — stats, royalties, or start a new project..."
                                        className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl px-5 pr-14 text-sm text-white placeholder:text-white/20 focus:outline-hidden focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className={cn(
                                            "absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                            input.trim() 
                                                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                                                : "bg-white/5 text-white/20 opacity-50"
                                        )}
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>

                                {/* Quick Actions */}
                                <div className="hidden sm:flex flex-wrap gap-2">
                                    <AnimatePresence mode="popLayout">
                                        {suggestedActions.map((action, i) => (
                                            <motion.button
                                                key={action.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.7 + i * 0.05 }}
                                                onClick={() => {
                                                    if (action.action) action.action();
                                                    else if (action.prompt) onSubmit(action.prompt);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                                                    action.variant === 'primary'
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                                        : "bg-white/5 text-white/60 border border-white/5 hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                <action.icon size={12} />
                                                {action.label}
                                            </motion.button>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500/20 to-dept-creative/20 flex items-center justify-center border border-white/10 shrink-0">
                            <Bot size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight">
                                {getGreeting()}
                            </h3>
                            <p className="text-xs text-white/40 mt-0.5 line-clamp-1 italic font-medium">
                                {getSubtext()}
                            </p>
                        </div>
                    </div>

                    {/* Primary Input */}
                    <form onSubmit={handleSubmit} className="relative mb-6">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything — stats, royalties, or start a new project..."
                            className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl px-5 pr-14 text-sm text-white placeholder:text-white/20 focus:outline-hidden focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className={cn(
                                "absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                input.trim() 
                                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                                    : "bg-white/5 text-white/20 opacity-50"
                            )}
                        >
                            <Send size={18} />
                        </button>
                    </form>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                        <AnimatePresence mode="popLayout">
                            {suggestedActions.map((action, i) => (
                                <motion.button
                                    key={action.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.7 + i * 0.05 }}
                                    onClick={() => {
                                        if (action.action) action.action();
                                        else if (action.prompt) onSubmit(action.prompt);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                                        action.variant === 'primary'
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                            : "bg-white/5 text-white/60 border border-white/5 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    <action.icon size={12} />
                                    {action.label}
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
