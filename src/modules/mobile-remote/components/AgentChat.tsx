/**
 * AgentChat — Simplified mobile-optimized chat interface for agent interactions.
 * Shows recent messages and provides a quick input for sending commands to indii Conductor.
 * Wired to agentService.sendMessage() — the same engine the desktop PromptArea uses.
 */

import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';
import { Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { logger } from '@/utils/logger';

interface AgentChatProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

export default function AgentChat({ onSendCommand, isPaired }: AgentChatProps) {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { agentHistory } = useStore(
        useShallow(state => ({
            agentHistory: state.agentHistory,
        }))
    );

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agentHistory?.length]);

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;
        const currentInput = input.trim();
        setIsProcessing(true);
        setInput('');

        // Also broadcast to WCP for desktop awareness
        onSendCommand({
            type: 'message',
            payload: { text: currentInput, source: 'mobile-remote' },
        });

        try {
            // Call the SAME agentService the desktop PromptArea uses.
            // targetAgentId = undefined means indii Conductor (hub agent).
            await agentService.sendMessage(currentInput, undefined, undefined);
        } catch (error) {
            logger.error('[AgentChat] Failed to send message:', error);
            // Put the text back so the user can retry
            setInput(currentInput);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Show last 20 messages max for mobile performance
    const recentMessages: AgentMessage[] = (agentHistory ?? []).slice(-20);

    // Check if the last message is still streaming (agent is thinking)
    const lastMsg = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1] : null;
    const isThinking = lastMsg?.role === 'model' && lastMsg?.isStreaming === true;

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[300px]"
            >
                {recentMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Sparkles className="w-8 h-8 text-blue-400/40 mb-3" />
                        <p className="text-sm text-[#6e7681]">No messages yet</p>
                        <p className="text-xs text-[#484f58] mt-1">
                            Send a command to indii Conductor
                        </p>
                    </div>
                ) : (
                    recentMessages.map((msg, i) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div
                                key={msg.id || i}
                                className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-blue-600/30' : 'bg-purple-600/30'
                                    }`}>
                                    {isUser ? (
                                        <User className="w-3 h-3 text-blue-400" />
                                    ) : (
                                        <Bot className="w-3 h-3 text-purple-400" />
                                    )}
                                </div>
                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${isUser
                                        ? 'bg-blue-600/20 border border-blue-600/20 text-blue-100'
                                        : 'bg-[#161b22] border border-[#30363d]/40 text-[#c9d1d9]'
                                    }`}>
                                    {msg.text.length > 300
                                        ? msg.text.slice(0, 300) + '…'
                                        : msg.text}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Thinking indicator (streaming or processing) */}
                {(isThinking || isProcessing) && (
                    <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-[#161b22] border border-[#30363d]/40">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isProcessing ? 'indii is thinking…' : 'Message indii…'}
                    disabled={isProcessing}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#484f58] focus:outline-none focus:border-blue-600/50 transition-colors disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isProcessing}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 flex items-center justify-center transition-colors active:scale-95"
                >
                    {isProcessing ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                        <Send className="w-4 h-4 text-white" />
                    )}
                </button>
            </div>
        </div>
    );
}
