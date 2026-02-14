import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, RefreshCw, Bot, GripHorizontal, ExternalLink, Maximize2, Database, Bell } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useStore, AgentMessage } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { agentRegistry } from '@/services/agent/registry';
import { requestNotificationPermission } from '@/lib/mobile';
import { MessageItem } from './chat/ChatMessage';
import { useDragControls } from 'framer-motion';
import { PromptArea } from './command-bar/PromptArea';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

interface ChatOverlayProps {
    onClose: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

const COLORS_TO_CLASSES: Record<string, string> = {
const BRAND_COLORS_TO_CLASSES: Record<string, string> = {
    purple: 'bg-purple-600 text-white shadow-sm',
    orange: 'bg-orange-600 text-white shadow-sm',
    emerald: 'bg-emerald-600 text-white shadow-sm',
    yellow: 'bg-yellow-600 text-white shadow-sm',
    blue: 'bg-blue-600 text-white shadow-sm',
    indigo: 'bg-indigo-600 text-white shadow-sm',
    rose: 'bg-rose-600 text-white shadow-sm',
    sky: 'bg-sky-600 text-white shadow-sm',
    pink: 'bg-pink-600 text-white shadow-sm',
    slate: 'bg-slate-600 text-white shadow-sm',
    gray: 'bg-gray-600 text-white shadow-sm',
    red: 'bg-red-600 text-white shadow-sm',
    green: 'bg-green-600 text-white shadow-sm',
    cyan: 'bg-cyan-600 text-white shadow-sm',
    violet: 'bg-violet-600 text-white shadow-sm',
    fuchsia: 'bg-fuchsia-600 text-white shadow-sm',
    lime: 'bg-lime-600 text-white shadow-sm',
    amber: 'bg-amber-600 text-white shadow-sm',
    teal: 'bg-teal-600 text-white shadow-sm',
};

const ChatOverlay: React.FC<ChatOverlayProps> = ({ onClose, onToggleMinimize }) => {
    // ⚡ Bolt Optimization: Selective store subscription
    const messages = useStore(state => state.agentHistory);
    const isProcessing = useStore(state => state.isAgentProcessing);
    const chatChannel = useStore(state => state.chatChannel);
    const isCommandBarDetached = useStore(state => state.isCommandBarDetached);
    const setCommandBarDetached = useStore(state => state.setCommandBarDetached);
    const windowSize = useStore(state => state.agentWindowSize);
    const setAgentWindowSize = useStore(state => state.setAgentWindowSize);
    const userProfile = useStore(state => state.userProfile);
    const activeAgentProvider = useStore(state => state.activeAgentProvider);
    const setActiveAgentProvider = useStore(state => state.setActiveAgentProvider);
    const isKnowledgeBaseEnabled = useStore(state => state.isKnowledgeBaseEnabled);
    const setKnowledgeBaseEnabled = useStore(state => state.setKnowledgeBaseEnabled);

    const dragControls = useDragControls();

    const isDesktop = useMediaQuery('(min-width: 768px)');

    // Resize & Stealth State
    const [isMinimized, setIsMinimized] = useState(false);
    const [isStealth, setIsStealth] = useState(false);
    const [localSize, setLocalSize] = useState(windowSize);
    const isResizing = useRef(false);
    const latestSize = useRef(localSize);

    // Sync local size when store changes
    useEffect(() => {
        setLocalSize(windowSize);
    }, [windowSize]);

    useEffect(() => {
        latestSize.current = localSize;
    }, [localSize]);

    const handleResize = useCallback((direction: string, e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing.current = true;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = localSize.width;
        const startHeight = localSize.height;

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (!isResizing.current) return;

            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction.includes('right')) newWidth = Math.max(300, startWidth + deltaX);
            if (direction.includes('left')) newWidth = Math.max(300, startWidth - deltaX);
            if (direction.includes('bottom')) newHeight = Math.max(400, startHeight + deltaY);
            if (direction.includes('top')) newHeight = Math.max(400, startHeight - deltaY);

            setLocalSize({ width: newWidth, height: newHeight });
        };

        const onPointerUp = () => {
            isResizing.current = false;
            setAgentWindowSize(latestSize.current);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [localSize, setAgentWindowSize]);

    // Visibility Toggles
    const toggleStealth = useCallback(() => setIsStealth(prev => !prev), []);
    const toggleLocalMinimize = useCallback(() => {
        setIsMinimized(prev => !prev);
        if (onToggleMinimize) onToggleMinimize();
    }, [onToggleMinimize]);

    // Derived state for active agent
    const activeAgentId = useStore(state => {
        const session = state.sessions[state.activeSessionId || ''];
        return session?.participants[0] || 'generalist';
    });

    const specializedAgents = useMemo(() => agentRegistry.getAll(), []);
    const { isListening, transcript } = useVoice();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);
    const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setHasNotificationPermission(Notification.permission === 'granted');
        }
    }, []);

    const handleRequestPermission = async () => {
        const granted = await requestNotificationPermission();
        setHasNotificationPermission(granted);
    };

    const activeAgent = specializedAgents.find(a => a.id === activeAgentId);
    const getAgentAvatar = useCallback((_agentId: string): string | undefined => undefined, []);

    // UI Features
    const [showHistory, setShowHistory] = useState(false);
    const [ConversationHistoryList, setConversationHistoryList] = useState<React.ComponentType<any> | null>(null);
    const [showInvite, setShowInvite] = useState(false);
    const [AgentSelector, setAgentSelector] = useState<React.ComponentType<any> | null>(null);

    useEffect(() => {
        if (showHistory && !ConversationHistoryList) {
            import('./ConversationHistoryList').then(m => setConversationHistoryList(() => m.ConversationHistoryList));
        }
    }, [showHistory, ConversationHistoryList]);

    useEffect(() => {
        if (showInvite && !AgentSelector) {
            import('./AgentSelector').then(m => setAgentSelector(() => m.AgentSelector));
        }
    }, [showInvite, AgentSelector]);

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

    // Auto-scroll
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
    const agentRole = displayAgent?.description || 'Music Creative Orchestrator';
    const agentColor = displayAgent?.color || 'purple';

    const brandColorMap: Record<string, string> = {
        'generalist': 'purple',
        'marketing': 'orange',
        'finance': 'emerald',
        'legal': 'yellow',
        'video': 'blue',
        'merchandise': 'yellow',
        'distribution': 'indigo',
        'brand': 'rose',
        'social': 'sky',
        'publicist': 'pink',
        'road': 'slate'
    };

    const activeBrandColor = brandColorMap[activeAgentId] || agentColor;
    const activeClass = COLORS_TO_CLASSES[activeBrandColor] || COLORS_TO_CLASSES['purple'];

    const BRAND_COLORS: Record<string, string> = {
        purple: 'bg-purple-600 text-white shadow-sm',
        orange: 'bg-orange-600 text-white shadow-sm',
        emerald: 'bg-emerald-600 text-white shadow-sm',
        yellow: 'bg-yellow-600 text-white shadow-sm',
        blue: 'bg-blue-600 text-white shadow-sm',
        indigo: 'bg-indigo-600 text-white shadow-sm',
        rose: 'bg-rose-600 text-white shadow-sm',
        sky: 'bg-sky-600 text-white shadow-sm',
        pink: 'bg-pink-600 text-white shadow-sm',
        slate: 'bg-slate-600 text-white shadow-sm',
        // Fallback
        default: 'bg-purple-600 text-white shadow-sm'
    };

    const activeBrandClass = BRAND_COLORS[activeBrandColor] || BRAND_COLORS.default;

    return (
        <>
            {/* Stealth Wake Button */}
            {isStealth && (
                <button
                    onClick={toggleStealth}
                    className="fixed bottom-8 right-8 w-14 h-14 bg-purple-600/20 backdrop-blur-xl border border-purple-500/30 rounded-full flex items-center justify-center text-purple-400 hover:bg-purple-600/40 transition-all z-[300] shadow-2xl animate-pulse"
                    title="Wake indii"
                >
                    <Bot size={28} />
                </button>
            )}

            <AnimatePresence mode="wait">
                {!isStealth && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: isMinimized ? 0.2 : 1,
                            y: 0,
                            width: isMinimized ? 80 : localSize.width,
                            height: isMinimized ? 80 : localSize.height,
                        }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        drag={isDesktop}
                        dragControls={dragControls}
                        dragListener={false}
                        dragMomentum={false}
                        dragElastic={0}
                        style={isDesktop ? {
                            bottom: 32,
                            right: 32,
                            position: 'fixed'
                        } : {
                            position: 'fixed',
                            inset: 0,
                            zIndex: 200
                        }}
                        className={`${isMinimized ? 'rounded-full cursor-pointer hover:scale-110' : 'rounded-none md:rounded-[2rem]'} bg-[#0c0c0e]/80 backdrop-blur-xl border-0 md:border border-${activeBrandColor}-500/20 shadow-2xl flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] z-[200] isolate ring-1 ring-white/5 transition-all`}
                        onClick={() => isMinimized && toggleLocalMinimize()}
                    >
                        {isMinimized ? (
                            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-900">
                                <Bot size={40} className="text-white" />
                            </div>
                        ) : (
                            <ErrorBoundary fallback={
                                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0c0c0e]">
                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                        <Bot size={32} className="text-red-400" />
                                    </div>
                                    <h3 className="text-white font-bold mb-2">Agent Error</h3>
                                    <p className="text-gray-400 text-sm mb-6 max-w-[200px]">Something went wrong while rendering the agent interface.</p>
                                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-colors">Reload Studio</button>
                                </div>
                            }>
                                {/* Resize Handles */}
                                {isDesktop && (
                                    <div className="absolute inset-0 pointer-events-none z-50">
                                        <div onPointerDown={(e) => handleResize('top', e)} className="absolute top-0 left-8 right-8 h-2 cursor-ns-resize pointer-events-auto hover:bg-purple-500/20 transition-colors" />
                                        <div onPointerDown={(e) => handleResize('bottom', e)} className="absolute bottom-0 left-8 right-8 h-2 cursor-ns-resize pointer-events-auto hover:bg-purple-500/20 transition-colors" />
                                        <div onPointerDown={(e) => handleResize('left', e)} className="absolute left-0 top-8 bottom-8 w-2 cursor-ew-resize pointer-events-auto hover:bg-purple-500/20 transition-colors" />
                                        <div onPointerDown={(e) => handleResize('right', e)} className="absolute right-0 top-8 bottom-8 w-2 cursor-ew-resize pointer-events-auto hover:bg-purple-500/20 transition-colors" />
                                        <div onPointerDown={(e) => handleResize('top-left', e)} className="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize pointer-events-auto hover:bg-purple-500/40 transition-colors z-[60] rounded-tl-[2rem]" />
                                        <div onPointerDown={(e) => handleResize('top-right', e)} className="absolute top-0 right-0 w-8 h-8 cursor-nesw-resize pointer-events-auto hover:bg-purple-500/40 transition-colors z-[60] rounded-tr-[2rem]" />
                                        <div onPointerDown={(e) => handleResize('bottom-left', e)} className="absolute bottom-0 left-0 w-8 h-8 cursor-nesw-resize pointer-events-auto hover:bg-purple-500/40 transition-colors z-[60] rounded-bl-[2rem]" />
                                        <div onPointerDown={(e) => handleResize('bottom-right', e)} className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize pointer-events-auto hover:bg-purple-500/40 transition-colors z-[60] rounded-br-[2rem]" />
                                    </div>
                                )}

                                {/* Header */}
                                <div onPointerDown={(e) => dragControls.start(e)} className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-20 cursor-grab active:cursor-grabbing" />
                                <div className="relative z-30 px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/5 backdrop-blur-md">
                                    <div onPointerDown={(e) => dragControls.start(e)} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

                                    <div className="flex items-center gap-4 relative z-10 pointer-events-none">
                                        <div className="relative group pointer-events-auto">
                                            <div className={`absolute -inset-1 bg-${activeBrandColor}-500/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                            {chatChannel === 'indii' ? (
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-900 flex items-center justify-center border border-white/10 relative z-10 shadow-lg">
                                                    <Bot size={24} className="text-white" />
                                                </div>
                                            ) : (
                                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-${activeBrandColor}-600 to-${activeBrandColor}-900 flex items-center justify-center border border-white/10 relative z-10 shadow-lg`}>
                                                    <div className="text-white font-bold text-lg">{agentName.charAt(0)}</div>
                                                </div>
                                            )}
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 bg-${activeBrandColor}-500 border-2 border-[#121212] rounded-full z-20 animate-pulse`} />
                                        </div>
                                        <div className="pointer-events-auto">
                                            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                                {chatChannel === 'indii' ? 'indii' : agentName}
                                                <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] uppercase font-bold tracking-widest text-[#a8a8a8]">Studio</span>
                                            </h3>
                                            <p className={`text-xs text-${activeBrandColor}-300 font-medium tracking-wide uppercase opacity-80`}>{agentRole}</p>
                                        </div>
                                    </div>

                                    {/* Mode Toggle: Chat (direct LLM) | Agent (specialist orchestration) | Sidecar (Agent Zero) */}
                                    <div className="flex items-center gap-0.5 bg-black/40 rounded-lg p-0.5 border border-white/5 mr-4 relative z-10 pointer-events-auto">
                                        <button
                                            onClick={() => setActiveAgentProvider('direct')}
                                            className={twMerge(clsx('px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all', activeAgentProvider === 'direct' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'))}
                                            title="Direct LLM chat — fast, no tools"
                                        >
                                            Chat
                                        </button>
                                        <button
                                            onClick={() => setActiveAgentProvider('native')}
                                            className={twMerge(clsx('px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all', activeAgentProvider === 'native' ? activeClass : 'text-gray-500 hover:text-gray-300'))}
                                            className={twMerge(clsx('px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all', activeAgentProvider === 'native' ? (BRAND_COLORS_TO_CLASSES[activeBrandColor] || BRAND_COLORS_TO_CLASSES['purple']) : 'text-gray-500 hover:text-gray-300'))}
                                            className={twMerge(clsx('px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all', activeAgentProvider === 'native' ? activeBrandClass : 'text-gray-500 hover:text-gray-300'))}
                                            title="Specialist agents with tools"
                                        >
                                            Agent
                                        </button>
                                        <button
                                            onClick={() => setActiveAgentProvider('agent-zero')}
                                            className={twMerge(clsx('px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all', activeAgentProvider === 'agent-zero' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'))}
                                            title="Agent Zero sidecar (Docker)"
                                        >
                                            indii
                                        </button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1 relative z-10">
                                        <button onClick={() => setCommandBarDetached(!isCommandBarDetached)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white" title={isCommandBarDetached ? "Dock Input" : "Detach Input"} data-testid="detach-input-btn"><Maximize2 size={18} /></button>
                                        <button onClick={toggleLocalMinimize} className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white" aria-label="Minimize chat" data-testid="minimize-chat-btn"><Minimize2 size={18} /></button>
                                        <button onClick={toggleStealth} className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white" title="Stealth Mode"><Bot size={18} className="opacity-50" /></button>
                                        <button onClick={onClose} className="p-2.5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all duration-200 text-gray-400" aria-label="Close Agent"><X size={18} /></button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 relative bg-[#0c0c0e]">
                                    <div className={`absolute top-1/4 left-1/4 w-64 h-64 bg-${activeBrandColor}-900/10 rounded-full blur-[100px] opacity-50 animate-pulse-slow`} />
                                    {messages.length === 0 ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                                            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br from-${activeBrandColor}-500/20 to-${activeBrandColor}-900/20 flex items-center justify-center mb-6 border border-${activeBrandColor}-500/20 backdrop-blur-xl shadow-lg`}><Bot size={40} className={`text-${activeBrandColor}-400`} /></div>
                                            <h3 className="text-xl font-bold text-white mb-2">How can I help you?</h3>
                                            <p className="text-sm text-gray-400 max-w-[280px]">I can help you create content, manage your studio, or analyze metrics.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Virtuoso
                                                ref={virtuosoRef}
                                                style={{ height: '100%' }}
                                                data={messages}
                                                atBottomStateChange={setIsAutoScrolling}
                                                itemContent={itemContent}
                                                components={{ Header: () => <div className="h-4" />, Footer: () => <div className="h-32" /> }}
                                                className="custom-scrollbar"
                                            />
                                            {!isAutoScrolling && (
                                                <motion.button
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    onClick={() => {
                                                        setIsAutoScrolling(true);
                                                        // Force scroll to bottom immediately as well
                                                        virtuosoRef.current?.scrollToIndex({
                                                            index: messages.length - 1,
                                                            behavior: 'smooth',
                                                            align: 'end',
                                                        });
                                                    }}
                                                    className={`absolute bottom-8 left-1/2 -translate-x-1/2 bg-${activeBrandColor}-600 text-white px-4 py-2 rounded-full shadow-lg z-30 flex items-center gap-2 hover:bg-${activeBrandColor}-700 transition-all text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-white/10`}
                                                    title="Resume Feed"
                                                >
                                                    <RefreshCw size={14} />
                                                    Resume Feed
                                                </motion.button>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Input Area */}
                                {!isCommandBarDetached && <div className="flex-shrink-0"><PromptArea isDocked /></div>}

                                {/* Status Footer */}
                                {(isListening || isProcessing || transcript) && (
                                    <div className="px-6 py-3 bg-black/40 border-t border-white/5 backdrop-blur-md flex items-center justify-between text-xs font-mono relative z-30" role="status" aria-live="polite">
                                        <div className="flex items-center gap-3">
                                            {isProcessing ? (
                                                <><div className="flex gap-1"><div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div><span className="text-purple-300 animate-pulse">PROCESSING RESPONSE...</span></>
                                            ) : isListening ? (
                                                <>
                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    <span className="text-red-300 font-bold">LISTENING...</span>
                                                    {transcript && <span className="ml-2 text-gray-400 truncate max-w-[200px]">"{transcript}"</span>}
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                )}

                                {/* Branding Footer */}
                                <div className="px-6 py-2 bg-black/20 border-t border-white/5 flex items-center justify-center relative z-30"><span className="text-xs text-white/30 font-medium">Powered by <span className="font-semibold text-white/40">indii</span></span></div>
                            </ErrorBoundary>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatOverlay;
