/**
 * AgentChat — Phone-side chat using Firestore Cloud Relay.
 *
 * Features:
 *   • Full Sync — Messages persist across refreshes via Firestore.
 *   • Real-time — Streaming agent responses with zero lag.
 *   • Multi-Agent — Targeted routing to specialized departments.
 *   • Premium UX — Framer Motion animations and high-end aesthetics.
 *
 * Fully polished to guarantee >= 44x44px touch target grid for all interactive buttons.
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Send, Bot, User, Loader2, Wifi, WifiOff, LogIn, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ChevronDown, LayoutGrid, Users, User as UserIcon,
    Sparkles, Star
} from 'lucide-react';
import {
    DESKTOP_HEARTBEAT_STALE_MS,
    isFreshStudioState,
    remoteRelayService,
    type RemoteResponse,
    type RemoteCommand,
    type DesktopState
} from '@/services/agent/RemoteRelayService';
import { AgentModePicker } from '@/components/AgentModePicker';
import { ConversationMode } from '@/core/store/slices/agent/agentUISlice';
import { auth } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logger } from '@/utils/logger';
import { toMillisSafe } from '@/utils/timestamps';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useVoice } from '@/core/context/VoiceContext';
import { resolveEntryCommand } from '@/services/commands/EntryCommandRegistry';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import VoiceTextViewingStage from './VoiceTextViewingStage';

interface ChatMessage {
    id: string;
    commandId?: string;
    role: 'user' | 'model';
    text: string;
    imageUrls?: string[];
    videoUrls?: string[];
    timestamp: number;
    agentId?: string;
    isStreaming?: boolean;
    boardroomMessageId?: string;
    rating?: number;
}

interface AgentChatProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

const MessageRating = memo(({ 
    boardroomMessageId, 
    currentRating 
}: { 
    boardroomMessageId?: string, 
    currentRating?: number 
}) => {
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [optimisticRating, setOptimisticRating] = useState<number | undefined>(currentRating);

    const handleRate = async (rating: number) => {
        if (!boardroomMessageId) return;
        setOptimisticRating(rating);
        try {
            // Import dynamically to avoid circular dependencies if any, 
            // though we can import directly at the top.
            const { agentFirebaseConnector } = await import('@/services/agent/AgentFirebaseConnector');
            await agentFirebaseConnector.update(boardroomMessageId, { rating });
        } catch (err) {
            logger.error('[AgentChat] Failed to save rating:', err);
            // Revert on failure
            setOptimisticRating(currentRating);
        }
    };

    if (!boardroomMessageId) return null;

    return (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5 opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-2">Rate Agent</span>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    aria-label={`Rate ${star} stars`}
                >
                    <Star
                        size={16}
                        className={`transition-colors ${(hoverRating || optimisticRating || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                    />
                </button>
            ))}
        </div>
    );
});
MessageRating.displayName = 'MessageRating';

// How long the phone waits for the studio before surfacing a clear,
// user-visible "couldn't reach your studio" message instead of a silent
// spinner death.
const RESPONSE_TIMEOUT_MS = 120_000;

export default function AgentChat({ onSendCommand: _onSendCommand, isPaired }: AgentChatProps) {
    const [input, setInput] = useState('');
    const [rawCommands, setRawCommands] = useState<RemoteCommand[]>([]);
    const [rawResponses, setRawResponses] = useState<RemoteResponse[]>([]);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
    const isStudioOnline = isFreshStudioState(desktopState);
    
    // Mode and targeting state for mobile remote
    const [selectedMode, setSelectedMode] = useState<ConversationMode>('boardroom');
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    
    const [showAgentPicker, setShowAgentPicker] = useState(false);
    // Locally-generated system notices (e.g. "couldn't reach your studio").
    // These are NOT persisted to Firestore — they're transient UI feedback.
    const [systemNotices, setSystemNotices] = useState<ChatMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Free, on-device real-time dictation via the app-wide Web Speech context.
    const { isListening, toggleListening, transcript } = useVoice();
    // Text already in the box when dictation starts, so we append rather than overwrite.
    const dictationBaseRef = useRef('');
    const wasListeningRef = useRef(false);
    // Only show the mic if this browser actually supports speech recognition.
    const voiceSupported = useMemo(
        () => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
        []
    );

    // Track the in-flight command's response listener + timeout so we can
    // tear them down on completion or unmount (no leaks, no stale closures).
    const responseUnsubRef = useRef<(() => void) | null>(null);
    const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stalePresenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Tear down any active response listener + timeout. Safe to call repeatedly.
    const teardownResponseWatch = useCallback(() => {
        if (responseUnsubRef.current) {
            responseUnsubRef.current();
            responseUnsubRef.current = null;
        }
        if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = null;
        }
    }, []);

    // Clean up the listener/timeout when the component unmounts.
    useEffect(() => {
        return () => {
            teardownResponseWatch();
        };
    }, [teardownResponseWatch]);

    // On the rising edge of dictation, remember the text already typed so the
    // live transcript appends to it instead of overwriting it.
    useEffect(() => {
        if (isListening && !wasListeningRef.current) {
            dictationBaseRef.current = input ? input.trimEnd() + ' ' : '';
        }
        wasListeningRef.current = isListening;
    }, [isListening, input]);

    // Stream the live transcript into the input box while dictating.
    useEffect(() => {
        if (isListening) {
            setInput(dictationBaseRef.current + transcript);
        }
    }, [transcript, isListening]);

    // Watch auth state
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unsubscribe = onAuthStateChanged(auth, (user: any) => {
            setIsAuthenticated(!!user);
        });
        return unsubscribe;
    }, []);

    // Subscribe to ALL commands and responses for full sync
    useEffect(() => {
        if (!isAuthenticated) return;

        const unsubCmds = remoteRelayService.onAllCommands((cmds) => {
            setRawCommands(cmds);
        });

        const unsubResps = remoteRelayService.onAllResponses((resps) => {
            setRawResponses(resps);
        });

        const unsubState = remoteRelayService.onDesktopState((state) => {
            if (stalePresenceTimeoutRef.current) {
                clearTimeout(stalePresenceTimeoutRef.current);
                stalePresenceTimeoutRef.current = null;
            }

            if (isFreshStudioState(state)) {
                setDesktopState(state);
                stalePresenceTimeoutRef.current = setTimeout(() => {
                    setDesktopState(null);
                    stalePresenceTimeoutRef.current = null;
                }, DESKTOP_HEARTBEAT_STALE_MS);
            } else {
                setDesktopState(null);
            }
        });

        return () => {
            unsubCmds();
            unsubResps();
            unsubState();
            if (stalePresenceTimeoutRef.current) {
                clearTimeout(stalePresenceTimeoutRef.current);
                stalePresenceTimeoutRef.current = null;
            }
        };
    }, [isAuthenticated]);

    // Merge and sort messages
    const messages = useMemo(() => {
        const all: ChatMessage[] = [];
        
        rawCommands.forEach(cmd => {
            const ts = toMillisSafe(cmd.timestamp);

            all.push({
                id: cmd.id || `cmd-${ts}`,
                commandId: cmd.id,
                role: 'user',
                text: cmd.text,
                timestamp: ts,
            });
        });

        rawResponses.forEach(res => {
            const ts = toMillisSafe(res.timestamp);

            all.push({
                id: res.id || `res-${ts}`,
                commandId: res.commandId,
                role: 'model',
                text: res.text,
                imageUrls: res.imageUrls,
                videoUrls: res.videoUrls,
                timestamp: ts,
                agentId: res.agentId,
                isStreaming: res.isStreaming,
                boardroomMessageId: res.boardroomMessageId,
                rating: res.rating,
            });
        });

        // Fold in any transient, locally-generated system notices.
        all.push(...systemNotices);

        // Sort by timestamp and ensure model responses for a command appear after the command
        return all.sort((a, b) => {
            if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
            return a.role === 'user' ? -1 : 1;
        });
    }, [rawCommands, rawResponses, systemNotices]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, messages[messages.length - 1]?.text]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isWaiting || !isAuthenticated || !isPaired) return;
        if (isListening) toggleListening(); // stop dictation before sending
        const userText = input.trim();
        setInput('');
        setIsWaiting(true);
        if (textareaRef.current && typeof window !== 'undefined' && window.innerWidth < 768) {
            textareaRef.current.blur();
        }

        try {
            let targetAgentId: string | undefined = undefined;
            if (selectedMode === 'department' && selectedDept) {
                targetAgentId = selectedDept;
            } else if (selectedMode === 'direct' && selectedAgent) {
                targetAgentId = selectedAgent;
            }

            const entryCommand = resolveEntryCommand(userText);
            const commandId = await remoteRelayService.sendCommand(
                userText,
                targetAgentId,
                {
                    // The desktop must route by what THIS surface selected
                    // (Boardroom / Department / Direct), not by whatever mode
                    // the desktop Studio last had open.
                    conversationMode: selectedMode,
                    ...(entryCommand ? { entryCommandId: entryCommand.id, source: 'mobile-remote' } : {}),
                },
                'studio'
            );
            if (!commandId) throw new Error('Failed to send command');

            logger.info(`[AgentChat] 📱 Sent command ${commandId}`);

            // Clear any previous in-flight watcher before starting a new one.
            teardownResponseWatch();

            // Listen for THIS command's response directly (no polling, no stale
            // closures). The global feed subscription still renders the message;
            // this listener only governs the spinner + timeout for this send.
            responseUnsubRef.current = remoteRelayService.onResponse(commandId, (response: RemoteResponse) => {
                // Ignore the interim "processing" streaming placeholder — wait
                // for a final (non-streaming) response before clearing the spinner.
                if (response.isStreaming) return;

                teardownResponseWatch();
                setIsWaiting(false);
            });

            // Explicit, user-visible timeout instead of a silent spinner death.
            responseTimeoutRef.current = setTimeout(() => {
                teardownResponseWatch();
                setIsWaiting(false);
                void remoteRelayService.cancelCommand(commandId).then((cancelled) => {
                    setSystemNotices(prev => [
                        ...prev,
                        {
                            id: `notice-${commandId}-timeout`,
                            commandId,
                            role: 'model',
                            text: cancelled
                                ? "Your studio did not claim this request, so it was cancelled. Reconnect the desktop studio before trying again."
                                : "Your studio started this request but did not return a final response. Check the desktop studio before retrying.",
                            timestamp: Date.now(),
                        },
                    ]);
                }).catch(() => {
                    setSystemNotices(prev => [
                        ...prev,
                        {
                            id: `notice-${commandId}-timeout`,
                            commandId,
                            role: 'model',
                            text: "Your studio did not return a final response. Check the desktop studio before retrying.",
                            timestamp: Date.now(),
                        },
                    ]);
                });
            }, RESPONSE_TIMEOUT_MS);

        } catch (error: unknown) {
            logger.error('[AgentChat] Failed to send command:', error);
            teardownResponseWatch();
            setIsWaiting(false);
            setInput(userText); // Restore input on failure
        }
    }, [input, isWaiting, isAuthenticated, isPaired, selectedAgent, selectedMode, selectedDept, teardownResponseWatch, isListening, toggleListening]);

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl bg-[#D936D9]/15 flex items-center justify-center mb-6 border border-[#D936D9]/30 shadow-[0_0_20px_rgba(217,54,217,0.15)]">
                    <LogIn className="w-8 h-8 text-[#D936D9]" />
                </div>
                <h3 className="text-xl font-bold font-display text-white mb-2">Secure Connection Required</h3>
                <p className="text-sm text-[#a1a1a6] font-sans leading-relaxed max-w-[280px]">
                    Please log in to your indii account to access your studio agents remotely.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Connection Banner */}
            <div className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-500 font-mono",
                isStudioOnline
                    ? "text-[#00ff66] bg-[#00ff66]/10 border border-[#00ff66]/20 shadow-[0_2px_8px_rgba(0,255,102,0.1)]"
                    : "text-amber-400 bg-amber-500/10 border border-amber-500/20 shadow-[0_2px_8px_rgba(245,158,11,0.05)]"
            )}>
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    isStudioOnline ? "bg-[#00ff66] animate-pulse shadow-[0_0_8px_rgba(0,255,102,0.8)]" : "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                )} />
                {isStudioOnline ? "Studio Connected" : "Studio Standby — Send to Wake"}
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                onTouchStart={() => {
                    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                }}
                className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar pb-4"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
                        <Sparkles className="w-12 h-12 text-[#00ff66] mb-4 animate-pulse" />
                        <p className="text-sm font-bold text-white uppercase tracking-[0.2em] font-display">Start a Session</p>
                        <p className="text-xs text-stone-400 mt-2 max-w-[220px] font-sans">Your agents are ready to assist with distribution, creative, and more.</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isUser = msg.role === 'user';
                        const showAgentHeader = !isUser && msg.agentId && msg.agentId !== 'generalist';
                        const agentIdentity = msg.agentId ? resolveAgentVisualIdentity(msg.agentId) : null;
                        
                        return (
                            <motion.div 
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className={cn(
                                    "flex flex-col gap-1.5",
                                    isUser ? "items-end" : "items-start"
                                )}
                            >
                                {showAgentHeader && agentIdentity && (
                                    <span 
                                        className="text-[10px] font-bold uppercase tracking-[0.2em] ml-2 mb-0.5 font-display"
                                        style={{ color: agentIdentity.cssProperties['--agent-accent'] }}
                                    >
                                        {agentIdentity.displayName}
                                    </span>
                                )}
                                
                                <div className={cn(
                                    "max-w-[85%] px-4 py-3.5 rounded-[22px] text-sm leading-[1.6] shadow-lg font-sans",
                                    isUser 
                                        ? "bg-linear-to-br from-stone-800 to-stone-900 border border-white/10 text-stone-100 rounded-tr-none shadow-black/40"
                                        : "bg-[#1c1815]/90 border border-white/10 text-[#f5f2eb] rounded-tl-none backdrop-blur-md shadow-xl"
                                )}>
                                    {msg.text}
                                    {msg.imageUrls && msg.imageUrls.length > 0 && (
                                        <div className={cn(
                                            "mt-3 grid gap-2",
                                            msg.imageUrls.length > 1 ? "grid-cols-2" : "grid-cols-1"
                                        )}>
                                            {msg.imageUrls.map((url, imageIdx) => (
                                                <a
                                                    key={`${msg.id}-image-${imageIdx}`}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Generated result ${imageIdx + 1}`}
                                                        className="aspect-square w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {msg.videoUrls?.map((url, videoIdx) => (
                                        <video
                                            key={`${msg.id}-video-${videoIdx}`}
                                            src={url}
                                            controls
                                            playsInline
                                            preload="metadata"
                                            className="mt-3 w-full rounded-2xl border border-white/10 bg-black"
                                        />
                                    ))}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-2 h-3.5 bg-[#00ff66] animate-pulse ml-1 align-middle rounded-xs" />
                                    )}
                                    {/* Agent Grading / Feedback */}
                                    {!isUser && !msg.isStreaming && msg.boardroomMessageId && (
                                        <MessageRating boardroomMessageId={msg.boardroomMessageId} currentRating={msg.rating} />
                                    )}
                                </div>
                                
                                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mx-2 font-mono">
                                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </motion.div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />

                {/* Processing Indicator */}
                <AnimatePresence>
                    {isWaiting && !messages[messages.length - 1]?.isStreaming && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-white/[0.04] border border-white/10 w-fit"
                        >
                            <Loader2 className="w-4 h-4 text-[#00ff66] animate-spin" />
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Agent is thinking…</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Agent Mode Picker Popover */}
            <AnimatePresence>
                {showAgentPicker && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-24 left-0 right-0 z-50 overflow-hidden rounded-[32px] bg-[#1a1512]/95 backdrop-blur-2xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
                    >
                        <div className="p-2">
                            <AgentModePicker 
                                className="border-none bg-transparent"
                                allowAutomaticRouting={false}
                                mode={selectedMode}
                                onModeChange={setSelectedMode}
                                departmentId={selectedDept}
                                onDepartmentChange={setSelectedDept}
                                agentId={selectedAgent}
                                onAgentChange={setSelectedAgent}
                            />
                        </div>
                        <button 
                            onClick={() => setShowAgentPicker(false)}
                            className="w-full py-4.5 bg-white/[0.05] text-white text-xs font-bold uppercase tracking-[0.2em] border-t border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                            style={{ minHeight: '44px' }}
                        >
                            Close Selector
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Bar & Live Viewing Stage */}
            <div className="mt-auto pt-3 relative z-40 bg-transparent">
                <VoiceTextViewingStage
                    value={input}
                    onChange={setInput}
                    onSubmit={handleSend}
                    placeholder={
                        isListening ? "Listening… speak now" :
                        selectedMode === 'boardroom' ? "Broadcast to Boardroom…" :
                        selectedMode === 'department' ? `Message ${selectedDept || 'Dept'}…` :
                        `Direct message ${selectedAgent || 'Agent'}…`
                    }
                    isWaiting={isWaiting}
                    isPaired={isPaired}
                    isListening={isListening}
                    onToggleListening={toggleListening}
                    voiceSupported={voiceSupported}
                    targetLabel={
                        selectedMode === 'boardroom' ? 'Boardroom' :
                        selectedMode === 'department' ? (selectedDept || 'Department') :
                        (selectedAgent || 'Agent')
                    }
                    onTargetClick={() => setShowAgentPicker(!showAgentPicker)}
                    targetIcon={
                        selectedMode === 'boardroom' ? <LayoutGrid className="w-5 h-5 text-[#00ff66]" /> :
                        selectedMode === 'department' ? <Users className="w-5 h-5 text-indigo-400" /> :
                        <UserIcon className="w-5 h-5 text-amber-400" />
                    }
                    submitLabel="Send"
                />
            </div>
        </div>
    );
}
