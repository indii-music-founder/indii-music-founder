import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { agentRegistry } from '@/services/agent/registry';
import { Bot, MessageSquare } from 'lucide-react';
import { PromptArea } from '@/core/components/command-bar/PromptArea';

interface BoardroomConversationPanelProps {
    messages: AgentMessage[];
}

/**
 * BoardroomConversationPanel — Persistent, scrollable conversation feed
 * for the Boardroom split-panel layout.
 *
 * Replaces the old approach of rendering MessageFeed inside the clipped
 * oval container. This panel has proper rectangular boundaries, auto-scroll,
 * and agent identity badges with color coding from the agent registry.
 */
export function BoardroomConversationPanel({ messages }: BoardroomConversationPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages.length]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col min-h-0">
                {/* Empty State — centered vertically in the available space */}
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                        <MessageSquare size={22} className="text-indigo-400/50" />
                    </div>
                    <p className="text-sm font-medium text-white/40">Awaiting discussion...</p>
                    <p className="text-xs text-white/20 mt-1 max-w-[240px]">
                        Select agents and submit a brief to start the boardroom session.
                    </p>
                </div>

                {/* Prompt Area — always visible so users can start the conversation */}
                <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
                    <PromptArea className="!static !translate-x-0 !w-full !max-w-none" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Panel Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 flex-shrink-0">
                <MessageSquare size={14} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Discussion
                </span>
                <span className="ml-auto text-[10px] font-mono text-white/20">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Scrollable Message List */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-1"
            >
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const identity = resolveAgentIdentity(msg.agentId);
                        const isUser = msg.role === 'user';

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className={`flex items-start gap-3 py-3 px-3 rounded-xl transition-colors ${isUser ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'}`}
                            >
                                {/* Avatar */}
                                <div className="flex-shrink-0 mt-0.5">
                                    {isUser ? (
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-indigo-300">You</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center border"
                                            style={{
                                                backgroundColor: `${identity?.color || '#a855f7'}20`,
                                                borderColor: `${identity?.color || '#a855f7'}40`,
                                            }}
                                        >
                                            {identity ? (
                                                <span
                                                    className="text-[10px] font-bold"
                                                    style={{ color: identity.color }}
                                                >
                                                    {identity.initials}
                                                </span>
                                            ) : (
                                                <Bot size={14} className="text-purple-300" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Message Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Agent Name Label */}
                                    {!isUser && identity && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">
                                            {identity.name}
                                        </p>
                                    )}
                                    {isUser && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/50 mb-1">
                                            You
                                        </p>
                                    )}

                                    {/* Message Text */}
                                    <div className="text-sm text-white/80 leading-relaxed break-words whitespace-pre-wrap">
                                        {msg.text || (msg as { content?: string }).content || ''}
                                    </div>

                                    {/* Streaming indicator */}
                                    {msg.isStreaming && (
                                        <div className="flex items-center gap-1 mt-2">
                                            <motion.div
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ repeat: Infinity, duration: 1.2 }}
                                                className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                                            />
                                            <span className="text-[10px] text-white/20">typing...</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Scroll anchor */}
                <div className="h-4 w-full flex-shrink-0" />
            </div>

            {/* Inline PromptArea for Boardroom */}
            <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
                <PromptArea className="!static !translate-x-0 !w-full !max-w-none" />
            </div>
        </div>
    );
}

/**
 * Resolve agent identity (name, hex color, initials) from the registry.
 * The registry stores colors as hex strings (e.g. '#FFE135', '#4B0082').
 */
function resolveAgentIdentity(agentId: string | undefined): { name: string; color: string; initials: string } | null {
    if (!agentId) return null;

    const allMeta = agentRegistry.getAll();
    const agentMeta = allMeta.find(a => a.id === agentId);

    if (!agentMeta) {
        // Fallback: capitalize the agentId
        const fallbackName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
        return {
            name: fallbackName,
            color: '#a855f7', // default purple hex
            initials: fallbackName.substring(0, 2).toUpperCase(),
        };
    }

    const nameStr = agentMeta.name || 'Agent';
    const words = nameStr.split(' ');
    const initials = (words.length > 1 && words[0]?.[0] && words[1]?.[0])
        ? (words[0][0] + words[1][0]).toUpperCase()
        : nameStr.substring(0, 2).toUpperCase();

    return {
        name: nameStr,
        color: agentMeta.color || '#a855f7',
        initials,
    };
}
