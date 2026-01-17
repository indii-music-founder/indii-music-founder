import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, Mic, StopCircle, RefreshCw, AlertCircle, Bot } from 'lucide-react';
import { useStore } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { agentRegistry } from '@/services/agent/registry';
import { MessageItem } from './chat/ChatMessage';

interface ChatOverlayProps {
    onClose: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ onClose, isMinimized = false, onToggleMinimize }) => {
    // ⚡ Bolt Optimization: Selective store subscription
    const messages = useStore(state => state.agentHistory);
    const isProcessing = useStore(state => state.isAgentProcessing);
    const activeSessionId = useStore(state => state.activeSessionId);
    const chatChannel = useStore(state => state.chatChannel);

    // Derived state for active agent (defaulting to 'generalist' or first participant)
    const activeAgentId = useStore(state => {
        const session = state.sessions[state.activeSessionId || ''];
        return session?.participants[0] || 'generalist';
    });

    const specializedAgents = useMemo(() => agentRegistry.getAll(), []);

    const { isListening, toggleListening, transcript } = useVoice();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [lastScrollTop, setLastScrollTop] = useState(0);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);

    const activeAgent = specializedAgents.find(a => a.id === activeAgentId);

    // Auto-scroll effect
    useEffect(() => {
        if (isAutoScrolling && virtuosoRef.current) {
            requestAnimationFrame(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: messages.length - 1,
                    behavior: 'smooth',
                    align: 'end',
                });
            });
        }
    }, [messages, isAutoScrolling, isProcessing]);

    // Handle scroll events to pause/resume auto-scroll
    const handleScroll = (scrollTop: number) => {
        if (messages.length === 0) return;
        // Simple heuristic: if user scrolls up significantly, stop auto-scroll
        if (lastScrollTop > scrollTop + 10) {
            setIsAutoScrolling(false);
        }
        // If user is near bottom, resume auto-scroll
        // (Virtuoso doesn't give us scrollHeight easily so we rely on user action for now or 'atBottom' state if we added it)
    };

    // Agent Avatar/Header Info - channel-aware
    // When in 'indii' mode, always show indii. When in 'agent' mode, show the active agent.
    const displayAgent = chatChannel === 'indii' ? null : activeAgent;
    const agentName = displayAgent?.name || 'indii';
    const agentRole = displayAgent?.description || 'Creative Orchestrator';
    const agentColor = displayAgent?.color || 'purple';

    // No avatar property on SpecializedAgent, use null
    const getAgentAvatar = (_agentId: string): string | undefined => {
        // Avatar functionality removed - SpecializedAgent doesn't have avatar
        return undefined;
    };

    return (
        <AnimatePresence mode="wait">
            {!isMinimized && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 w-full md:w-[500px] h-full md:h-[800px] bg-[#0c0c0e]/95 backdrop-blur-3xl rounded-none md:rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden z-[100] isolate ring-1 ring-white/10"
                >
                    {/* Header */}
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-20 pointer-events-none" />
                    <div className="relative z-30 px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="relative group cursor-pointer">
                                <div className={`absolute -inset-1 bg-${agentColor}-500/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                {chatChannel === 'indii' ? (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-900 flex items-center justify-center border border-white/10 relative z-10 shadow-lg">
                                        <Bot size={24} className="text-white" />
                                    </div>
                                ) : (
                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-${agentColor}-600 to-${agentColor}-900 flex items-center justify-center border border-white/10 relative z-10 shadow-lg`}>
                                        <div className="text-white font-bold text-lg">{agentName.charAt(0)}</div>
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#121212] rounded-full z-20 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                    {agentName}
                                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] uppercase font-bold tracking-widest text-[#a8a8a8]">Beta</span>
                                </h3>
                                <p className={`text-xs text-${agentColor}-300 font-medium tracking-wide uppercase opacity-80`}>{agentRole}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMinimize}
                                className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
                                aria-label="Minimize chat"
                            >
                                <Minimize2 size={18} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2.5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all duration-200 text-gray-400"
                                aria-label="Close chat"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 relative bg-[#0c0c0e]">
                        {/* Background Ambient Glow */}
                        <div className={`absolute top-1/4 left-1/4 w-64 h-64 bg-${agentColor}-900/10 rounded-full blur-[100px] opacity-50 animate-pulse-slow`} />
                        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-900/10 rounded-full blur-[80px] opacity-30 animate-pulse-slow delay-1000" />

                        {messages.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`w-20 h-20 rounded-3xl bg-gradient-to-br from-${agentColor}-500/20 to-${agentColor}-900/20 flex items-center justify-center mb-6 border border-${agentColor}-500/20 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.1)]`}
                                >
                                    <Bot size={40} className={`text-${agentColor}-400`} />
                                </motion.div>
                                <h3 className="text-xl font-bold text-white mb-2">How can I help you?</h3>
                                <p className="text-sm text-gray-400 max-w-[280px] leading-relaxed">
                                    I can help you create content, manage your studio, or analyze metrics. Just ask.
                                </p>
                            </div>
                        ) : (
                            <Virtuoso
                                ref={virtuosoRef}
                                style={{ height: '100%' }}
                                data={messages}
                                atBottomStateChange={(atBottom) => {
                                    setIsAutoScrolling(atBottom);
                                }}
                                itemContent={(index, msg) => (
                                    <div className="px-6 py-2">
                                        <MessageItem
                                            key={msg.id}
                                            msg={msg}
                                            avatarUrl={msg.role === 'model' ? getAgentAvatar(activeAgentId || '') : undefined}
                                        />
                                    </div>
                                )}
                                components={{
                                    Header: () => <div className="h-4" />,
                                    Footer: () => <div className="h-4" />
                                }}
                                className="custom-scrollbar"
                            />
                        )}

                        {/* Resume Auto-scroll Button */}
                        {!isAutoScrolling && messages.length > 0 && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => {
                                    setIsAutoScrolling(true);
                                    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
                                }}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 z-20 hover:bg-purple-500 transition-colors"
                            >
                                <RefreshCw size={12} />
                                Resume Feed
                            </motion.button>
                        )}
                    </div>

                    {/* Footer Status Bar (Voice/Processing) */}
                    {(isListening || isProcessing || transcript) && (
                        <div className="px-6 py-3 bg-black/40 border-t border-white/5 backdrop-blur-md flex items-center justify-between text-xs font-mono relative z-30">
                            <div className="flex items-center gap-3 overflow-hidden">
                                {isProcessing ? (
                                    <>
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-purple-300 animate-pulse">PROCESSING RESPONSE...</span>
                                    </>
                                ) : isListening ? (
                                    <>
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-red-300 font-bold tracking-wider">LISTENING...</span>
                                        {transcript && <span className="text-gray-500 truncate max-w-[200px] border-l border-white/10 pl-3 ml-3">"{transcript}"</span>}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChatOverlay;
