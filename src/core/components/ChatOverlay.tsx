import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, RefreshCw, Bot, GripHorizontal, ExternalLink, Minimize2 as MinimizeIcon, Maximize2 } from 'lucide-react';
import { useStore, AgentMessage } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { agentRegistry } from '@/services/agent/registry';
import { MessageItem } from './chat/ChatMessage';
import { useDragControls } from 'framer-motion';
import { PromptArea } from './command-bar/PromptArea';

interface ChatOverlayProps {
    onClose: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ onClose, isMinimized = false, onToggleMinimize }) => {
    // ⚡ Bolt Optimization: Selective store subscription
    const messages = useStore(state => state.agentHistory);
    const isProcessing = useStore(state => state.isAgentProcessing);
    const chatChannel = useStore(state => state.chatChannel);
    const isCommandBarDetached = useStore(state => state.isCommandBarDetached);
    const setCommandBarDetached = useStore(state => state.setCommandBarDetached);
    const dragControls = useDragControls();

    // Derived state for active agent
    const activeAgentId = useStore(state => {
        const session = state.sessions[state.activeSessionId || ''];
        return session?.participants[0] || 'generalist';
    });

    const specializedAgents = useMemo(() => agentRegistry.getAll(), []);

    const { isListening, transcript } = useVoice();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);

    const activeAgent = specializedAgents.find(a => a.id === activeAgentId);

    const getAgentAvatar = useCallback((_agentId: string): string | undefined => {
        return undefined;
    }, []);

    const itemContent = useCallback((index: number, msg: AgentMessage) => {
        const msgIdentity = msg.role === 'model' && chatChannel === 'agent' && activeAgent
            ? { color: activeAgent.color, initials: activeAgent.name.charAt(0) }
            : undefined;

        return (
            <div className="px-6 py-2">
                <MessageItem
                    key={msg.id}
                    msg={msg}
                    avatarUrl={msg.role === 'model' ? getAgentAvatar(activeAgentId || '') : undefined}
                    agentIdentity={msgIdentity}
                />
            </div>
        );
    }, [chatChannel, activeAgent, activeAgentId, getAgentAvatar]);

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

    const displayAgent = chatChannel === 'indii' ? null : activeAgent;
    const agentName = displayAgent?.name || 'indii';
    const agentRole = displayAgent?.description || 'Creative Orchestrator';
    const agentColor = displayAgent?.color || 'purple';

    return (
        <AnimatePresence mode="wait">
            {!isMinimized && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    drag
                    dragControls={dragControls}
                    dragListener={false}
                    dragMomentum={false}
                    className="fixed inset-0 md:inset-auto md:bottom-8 md:right-8 w-full h-full md:w-[500px] md:h-[800px] bg-[#0c0c0e]/95 backdrop-blur-3xl rounded-none md:rounded-[2rem] border-0 md:border border-white/10 shadow-2xl flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] z-[200] isolate ring-0 md:ring-1 ring-white/10"
                >
                    {/* Header */}
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-20 cursor-grab active:cursor-grabbing"
                    />
                    <div className="relative z-30 px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/5 backdrop-blur-md">
                        <div
                            onPointerDown={(e) => dragControls.start(e)}
                            className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
                        />

                        <div className="flex items-center gap-4 relative z-10 pointer-events-none">
                            <div className="relative group pointer-events-auto">
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
                            <div className="pointer-events-auto">
                                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                    {agentName}
                                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] uppercase font-bold tracking-widest text-[#a8a8a8]">Beta</span>
                                </h3>
                                <p className={`text-xs text-${agentColor}-300 font-medium tracking-wide uppercase opacity-80`}>{agentRole}</p>
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1 relative z-10">
                            <div
                                onPointerDown={(e) => dragControls.start(e)}
                                className="p-2 text-white/20 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors mr-1"
                            >
                                <GripHorizontal size={20} />
                            </div>

                            <button
                                onClick={() => setCommandBarDetached(!isCommandBarDetached)}
                                className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
                                title={isCommandBarDetached ? "Dock Input" : "Detach Input"}
                                aria-label={isCommandBarDetached ? "Dock Input" : "Detach Input"}
                            >
                                {isCommandBarDetached ? <Maximize2 size={18} /> : <ExternalLink size={18} />}
                            </button>

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
                                aria-label="Close Agent"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 relative bg-[#0c0c0e]">
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
                                itemContent={itemContent}
                                components={{
                                    Header: () => <div className="h-4" />,
                                    Footer: () => <div className="h-32" />
                                }}
                                className="custom-scrollbar"
                            />
                        )}

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

                    {/* Integrated Prompt Area (Docked Mode) */}
                    {!isCommandBarDetached && (
                        <div className="flex-shrink-0">
                            <PromptArea isDocked />
                        </div>
                    )}

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

                    {/* indii Branding Footer */}
                    <div className="px-6 py-2 bg-black/20 border-t border-white/5 flex items-center justify-center relative z-30">
                        <span className="text-xs text-white/30 font-medium">
                            Powered by <span className="font-semibold text-white/40">indii</span>
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChatOverlay;
