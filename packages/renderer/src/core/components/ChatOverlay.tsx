import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
    X,
    Minimize2,
    RefreshCw,
    Bot,
    Maximize2,
    Smartphone,
    BriefcaseBusiness,
    Calculator,
    CalendarDays,
    Camera,
    Clapperboard,
    CloudCog,
    GraduationCap,
    Handshake,
    Landmark,
    Library,
    LockKeyhole,
    Megaphone,
    Music2,
    Palette,
    PenLine,
    Route,
    Scale,
    Share2,
    ShieldCheck,
    Sparkles,
    Utensils,
    Video,
    type LucideIcon,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { AgentMessage } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessageItem } from './chat/ChatMessage';
import { PromptArea } from './command-bar/PromptArea';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { AgentSwitcherStrip } from './AgentSwitcherStrip';
import {
    resolveAgentVisualIdentity,
    type AgentVisualIconKey,
} from '@/services/agent/AgentVisualIdentity';

const AGENT_ICONS: Readonly<Record<AgentVisualIconKey, LucideIcon>> = Object.freeze({
    bot: Bot,
    'briefcase-business': BriefcaseBusiness,
    calculator: Calculator,
    'calendar-days': CalendarDays,
    camera: Camera,
    clapperboard: Clapperboard,
    'cloud-cog': CloudCog,
    'graduation-cap': GraduationCap,
    handshake: Handshake,
    landmark: Landmark,
    library: Library,
    'lock-keyhole': LockKeyhole,
    megaphone: Megaphone,
    'music-2': Music2,
    palette: Palette,
    'pen-line': PenLine,
    route: Route,
    scale: Scale,
    'share-2': Share2,
    'shield-check': ShieldCheck,
    sparkles: Sparkles,
    utensils: Utensils,
    video: Video,
});

interface ChatOverlayProps {
    onClose: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ onClose, onToggleMinimize }) => {
    const {
        messages,
        isProcessing,
        chatChannel,
        isCommandBarDetached,
        setCommandBarDetached,
        windowSize,
        setAgentWindowSize,
        userProfile
    } = useStore(
        useShallow(state => ({
            messages: state.agentHistory,
            isProcessing: state.isAgentProcessing,
            chatChannel: state.chatChannel,
            isCommandBarDetached: state.isCommandBarDetached,
            setCommandBarDetached: state.setCommandBarDetached,
            windowSize: state.agentWindowSize,
            setAgentWindowSize: state.setAgentWindowSize,
            userProfile: state.userProfile,
        }))
    );

    const dragControls = useDragControls();
    const isDesktop = useMediaQuery('(min-width: 768px)');

    // Resize & Stealth State
    const [isMinimized, setIsMinimized] = useState(false);
    const [isStealth, setIsStealth] = useState(false);
    const [localSize, setLocalSize] = useState(windowSize);
    const isResizing = useRef(false);
    const [sourceFilter, setSourceFilter] = useState<'all' | 'desktop' | 'mobile-remote'>('all');

    // Virtuoso ref for auto-scrolling
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(true);

    // Voice
    const { isListening, transcript } = useVoice();

    // Sync local size when store changes
    useEffect(() => {
        setLocalSize(windowSize);
    }, [windowSize]);

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
            setAgentWindowSize(localSize);
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
        if (state.conversationMode === 'direct' && state.directTargetAgentId) {
            return state.directTargetAgentId;
        }
        if (state.conversationMode === 'department' && state.activeDepartmentId) {
            return state.activeDepartmentId;
        }
        const session = state.sessions[state.activeSessionId || ''];
        return session?.participants[0] || 'generalist';
    });

    const activeIdentity = useMemo(
        () => resolveAgentVisualIdentity(activeAgentId),
        [activeAgentId],
    );
    const ActiveAgentIcon = AGENT_ICONS[activeIdentity.iconKey];

    const filteredMessages = useMemo(() => (
        sourceFilter === 'all'
            ? messages
            : messages.filter(message => sourceFilter === 'desktop'
                ? (!message.source || message.source === 'desktop')
                : message.source === sourceFilter
            )
    ), [messages, sourceFilter]);

    // Virtuoso message renderer
    const itemContent = useCallback((_index: number, msg: AgentMessage) => (
        <div className="px-4 py-2">
            <MessageItem
                msg={msg}
                avatarUrl={msg.role === 'user' ? (userProfile?.photoURL ?? undefined) : undefined}
                variant="compact"
            />
        </div>
    ), [userProfile]);

    // Resize handles component
    const ResizeHandles = useMemo(() => (
        <>
            {/* Right edge */}
            <div
                className="absolute top-0 right-0 w-1.5 h-full cursor-e-resize hover:bg-green-500/30 transition-colors z-50"
                onPointerDown={(e) => handleResize('right', e)}
            />
            {/* Bottom edge */}
            <div
                className="absolute bottom-0 left-0 w-full h-1.5 cursor-s-resize hover:bg-green-500/30 transition-colors z-50"
                onPointerDown={(e) => handleResize('bottom', e)}
            />
            {/* Left edge */}
            <div
                className="absolute top-0 left-0 w-1.5 h-full cursor-w-resize hover:bg-green-500/30 transition-colors z-50"
                onPointerDown={(e) => handleResize('left', e)}
            />
            {/* Top edge */}
            <div
                className="absolute top-0 left-0 w-full h-1.5 cursor-n-resize hover:bg-green-500/30 transition-colors z-50"
                onPointerDown={(e) => handleResize('top', e)}
            />
            {/* Bottom-right corner */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50"
                onPointerDown={(e) => handleResize('bottom-right', e)}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-600 hover:text-green-400 transition-colors">
                    <path d="M14 14L8 14L14 8L14 14Z" fill="currentColor" opacity="0.5" />
                    <path d="M14 14L11 14L14 11L14 14Z" fill="currentColor" opacity="0.8" />
                </svg>
            </div>
        </>
    ), [handleResize]);

    return (
        <>
            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        key="chat-overlay"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{
                            opacity: isStealth ? 0.15 : 1,
                            scale: 1,
                            y: 0,
                            width: isDesktop ? localSize.width : '100vw',
                            height: isDesktop ? localSize.height : undefined,
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        drag={isDesktop}
                        dragControls={dragControls}
                        dragListener={false}
                        dragMomentum={false}
                        dragElastic={0}
                        className={cn(
                            "fixed z-[600] flex flex-col",
                            isDesktop
                                ? "rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
                                : "inset-0"
                        )}
                        style={{
                            top: isDesktop ? 'calc(50vh - 300px)' : 0,
                            right: isDesktop ? '2rem' : 0,
                            // On mobile, use dvh (dynamic viewport height) to respect Safari's
                            // collapsing/expanding URL bar. Falls back to 100vh for older browsers.
                            // 64px = 56px tab bar height + 8px extra bottom padding
                            height: isDesktop ? undefined : 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))',
                            background: 'linear-gradient(180deg, rgba(12,12,14,0.98) 0%, rgba(8,8,10,0.99) 100%)',
                            backdropFilter: 'blur(var(--blur-lg))',
                        }}
                    >
                        <ErrorBoundary>
                            {/* Drag Handle / Title Bar */}
                            <div
                                className="flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing select-none shrink-0"
                                onPointerDown={(e) => {
                                    if (isDesktop) dragControls.start(e);
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-full border flex flex-col items-center justify-center animate-pulse"
                                        style={{
                                            ...activeIdentity.cssProperties,
                                            backgroundColor: activeIdentity.surface,
                                            borderColor: activeIdentity.border,
                                            color: activeIdentity.foreground,
                                            boxShadow: `0 0 12px ${activeIdentity.glow}`,
                                        } as React.CSSProperties}
                                        aria-label={activeIdentity.ariaLabel}
                                        data-agent-id={activeIdentity.agentId}
                                        data-agent-accent={activeIdentity.accent}
                                        data-agent-icon={activeIdentity.iconKey}
                                    >
                                        <ActiveAgentIcon size={11} aria-hidden="true" style={{ color: activeIdentity.accent }} />
                                        <span className="text-[7px] font-black leading-none">{activeIdentity.initials}</span>
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                        {activeIdentity.displayName}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-mono">
                                        {chatChannel === 'indii' ? 'ORCHESTRATOR' : 'SPECIALIST'}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1 relative z-10">
                                    <AgentSwitcherStrip />
                                    <div className="w-px h-4 bg-white/10 mx-1 hidden md:block" />
                                    <button onClick={() => setCommandBarDetached(!isCommandBarDetached)} className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white" aria-label={isCommandBarDetached ? "Dock Input" : "Detach Input"} title={isCommandBarDetached ? "Dock Input" : "Detach Input"} data-testid="detach-input-btn"><Maximize2 size={14} /></button>
                                    <button onClick={toggleLocalMinimize} className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white" aria-label="Minimize chat" data-testid="minimize-chat-btn"><Minimize2 size={14} /></button>
                                    <button onClick={toggleStealth} className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white" aria-label="Toggle Stealth Mode" title="Stealth Mode"><Bot size={14} className="opacity-50" /></button>
                                    <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-gray-400" aria-label="Close Agent"><X size={14} /></button>
                                </div>
                            </div>

                            {/* Source Filter Tabs — only show if remote messages exist */}
                            {messages.some(m => m.source === 'mobile-remote') && (
                                <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-white/5 bg-black/20 shrink-0">
                                    {(['all', 'desktop', 'mobile-remote'] as const).map(filter => {
                                        const count = filter === 'all'
                                            ? messages.length
                                            : messages.filter(m => filter === 'desktop' ? (!m.source || m.source === 'desktop') : m.source === filter).length;
                                        const label = filter === 'all' ? 'All' : filter === 'desktop' ? 'Desktop' : 'Controller';
                                        const isActive = sourceFilter === filter;
                                        return (
                                            <button
                                                key={filter}
                                                onClick={() => setSourceFilter(filter)}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border',
                                                    isActive
                                                        ? 'hover:brightness-110'
                                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-transparent',
                                                )}
                                                style={isActive ? {
                                                    backgroundColor: activeIdentity.surface,
                                                    borderColor: activeIdentity.border,
                                                    color: activeIdentity.foreground,
                                                } : undefined}
                                            >
                                                {filter === 'mobile-remote' && <Smartphone size={10} />}
                                                {label}
                                                {count > 0 && (
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? '' : 'bg-white/5'}`}
                                                        style={isActive ? { backgroundColor: activeIdentity.accent, color: activeIdentity.onAccentForeground } : undefined}
                                                    >
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Messages Area */}
                            <div className="flex-1 relative bg-[#0c0c0e] min-h-0">
                                <div
                                    className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-50"
                                    style={{ backgroundColor: activeIdentity.glow }}
                                />
                                {messages.length === 0 ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center mb-4 border backdrop-blur-xl"
                                            style={{
                                                ...activeIdentity.cssProperties,
                                                backgroundColor: activeIdentity.surface,
                                                borderColor: activeIdentity.border,
                                                color: activeIdentity.foreground,
                                                boxShadow: `0 0 20px ${activeIdentity.glow}`,
                                            } as React.CSSProperties}
                                            aria-label={activeIdentity.ariaLabel}
                                        >
                                            <ActiveAgentIcon size={25} aria-hidden="true" style={{ color: activeIdentity.accent }} />
                                            <span className="text-[9px] font-black leading-none">{activeIdentity.initials}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">How can I help you?</h3>
                                        <p className="text-xs text-gray-400 max-w-[240px]">Create content, manage your studio, or analyze metrics.</p>
                                    </div>
                                ) : (
                                    <>
                                        <Virtuoso
                                            ref={virtuosoRef}
                                            style={{ height: '100%' }}
                                            data={filteredMessages}
                                            initialTopMostItemIndex={Math.max(filteredMessages.length - 1, 0)}
                                            followOutput={(isAtBottom) => isAtBottom ? 'auto' : false}
                                            atBottomStateChange={setIsAutoScrolling}
                                            itemContent={itemContent}
                                            components={{
                                                Header: () => <div className="h-4" />,
                                                Footer: () => <div className="h-32" />
                                            }}
                                            className="custom-scrollbar"
                                        />
                                        {!isAutoScrolling && (
                                            <motion.button
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                onClick={() => {
                                                    setIsAutoScrolling(true);
                                                    virtuosoRef.current?.scrollToIndex({
                                                        index: messages.length - 1,
                                                        behavior: 'smooth',
                                                        align: 'end',
                                                    });
                                                }}
                                                className="absolute bottom-8 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full shadow-lg z-30 flex items-center gap-2 hover:brightness-110 transition-all text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border"
                                                style={{
                                                    backgroundColor: activeIdentity.accent,
                                                    borderColor: activeIdentity.border,
                                                    color: activeIdentity.onAccentForeground,
                                                    boxShadow: `0 0 16px ${activeIdentity.glow}`,
                                                }}
                                                title="Resume Feed"
                                            >
                                                <RefreshCw size={12} />
                                                Resume Feed
                                            </motion.button>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Input Area */}
                            {!isCommandBarDetached && (
                                <div className="flex-shrink-0">
                                    <PromptArea isDocked />
                                </div>
                            )}

                            {/* Status Footer */}
                            {(isListening || isProcessing || transcript) && (
                                <div className="px-4 py-2 bg-black/40 border-t border-white/5 backdrop-blur-md flex items-center text-xs font-mono relative z-30 shrink-0" role="status" aria-live="polite">
                                    <div className="flex items-center gap-3">
                                        {isProcessing ? (
                                            <>
                                                <div className="flex gap-1">
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                                <span className="text-green-300 animate-pulse">PROCESSING...</span>
                                            </>
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

                            {/* Branding Footer — desktop only, saves space on phone */}
                            {isDesktop && (
                                <div className="px-4 py-1.5 bg-black/20 border-t border-white/5 flex items-center justify-center relative z-30 shrink-0">
                                    <span className="text-[10px] text-white/20 font-medium">
                                        Powered by <span className="font-semibold text-white/30">indii</span>
                                    </span>
                                </div>
                            )}

                            {/* Resize Handles (desktop only) */}
                            {isDesktop && ResizeHandles}
                        </ErrorBoundary>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Minimized Bar */}
            {isMinimized && (
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={toggleLocalMinimize}
                    className="fixed bottom-6 right-6 z-[600] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 hover:brightness-110 transition-all border"
                    style={{
                        ...activeIdentity.cssProperties,
                        backgroundColor: activeIdentity.accent,
                        borderColor: activeIdentity.border,
                        color: activeIdentity.onAccentForeground,
                        boxShadow: `0 0 16px ${activeIdentity.glow}`,
                    } as React.CSSProperties}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <ActiveAgentIcon size={16} aria-hidden="true" />
                    <span className="text-[9px] font-black">{activeIdentity.initials}</span>
                    <span className="text-xs font-bold tracking-wider">{activeIdentity.displayName}</span>
                    {messages.length > 0 && (
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                    )}
                </motion.button>
            )}
        </>
    );
};

export default ChatOverlay;
