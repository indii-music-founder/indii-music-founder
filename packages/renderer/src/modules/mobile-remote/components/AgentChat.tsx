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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Send, Bot, User, Loader2, Wifi, WifiOff, LogIn, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ChevronDown, LayoutGrid, Users, User as UserIcon,
    Sparkles, Mic
} from 'lucide-react';
import {
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
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '@/core/context/VoiceContext';

interface ChatMessage {
    id: string;
    commandId?: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    agentId?: string;
    isStreaming?: boolean;
}

interface AgentChatProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

// How long the phone waits for the studio before surfacing a clear,
// user-visible "couldn't reach your studio" message instead of a silent
// spinner death.
const RESPONSE_TIMEOUT_MS = 30_000;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AgentChat({ onSendCommand: _onSendCommand, isPaired }: AgentChatProps) {
    const [input, setInput] = useState('');
    const [rawCommands, setRawCommands] = useState<RemoteCommand[]>([]);
    const [rawResponses, setRawResponses] = useState<RemoteResponse[]>([]);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
    
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
            setDesktopState(state);
        });

        return () => {
            unsubCmds();
            unsubResps();
            unsubState();
        };
    }, [isAuthenticated]);

    // Merge and sort messages
    const messages = useMemo(() => {
        const all: ChatMessage[] = [];
        
        rawCommands.forEach(cmd => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ts = cmd.timestamp && 'toMillis' in (cmd.timestamp as any) 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? (cmd.timestamp as any).toMillis() 
                : typeof cmd.timestamp === 'number' ? cmd.timestamp : Date.now();
                
            all.push({
                id: cmd.id || `cmd-${ts}`,
                commandId: cmd.id,
                role: 'user',
                text: cmd.text,
                timestamp: ts,
            });
        });

        rawResponses.forEach(res => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ts = res.timestamp && 'toMillis' in (res.timestamp as any) 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? (res.timestamp as any).toMillis() 
                : typeof res.timestamp === 'number' ? res.timestamp : Date.now();

            all.push({
                id: res.id || `res-${ts}`,
                commandId: res.commandId,
                role: 'model',
                text: res.text,
                timestamp: ts,
                agentId: res.agentId,
                isStreaming: res.isStreaming,
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
        if (!input.trim() || isWaiting || !isAuthenticated) return;
        if (isListening) toggleListening(); // stop dictation before sending
        const userText = input.trim();
        setInput('');
        setIsWaiting(true);

        try {
            let targetAgentId: string | undefined = undefined;
            if (selectedMode === 'department' && selectedDept) {
                targetAgentId = selectedDept;
            } else if (selectedMode === 'direct' && selectedAgent) {
                targetAgentId = selectedAgent;
            }

            const commandId = await remoteRelayService.sendCommand(userText, targetAgentId);
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
                setSystemNotices(prev => [
                    ...prev,
                    {
                        id: `notice-${commandId}-timeout`,
                        commandId,
                        role: 'model',
                        text: "Couldn't reach your studio. If your computer is off, some actions need it running — try again in a moment.",
                        timestamp: Date.now(),
                    },
                ]);
            }, RESPONSE_TIMEOUT_MS);

        } catch (error: unknown) {
            logger.error('[AgentChat] Failed to send command:', error);
            teardownResponseWatch();
            setIsWaiting(false);
            setInput(userText); // Restore input on failure
        }
    }, [input, isWaiting, isAuthenticated, selectedAgent, selectedMode, selectedDept, teardownResponseWatch, isListening, toggleListening]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20">
                    <LogIn className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Secure Connection Required</h3>
                <p className="text-sm text-[#a1a1a6] leading-relaxed max-w-[280px]">
                    Please log in to your indii account to access your studio agents remotely.
                </p>
            </div>
        );
    }

    const isDesktopOnline = desktopState?.online ?? false;

    return (
        <div className="flex flex-col h-full relative">
            {/* Connection Banner */}
            <div className={cn(
                "flex items-center gap-2 px-3.5 py-3 mb-4 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-500",
                isDesktopOnline 
                    ? "text-blue-400 bg-blue-500/5 border border-blue-500/10 shadow-[0_2px_8px_rgba(59,130,246,0.05)]" 
                    : "text-amber-400 bg-amber-500/5 border border-amber-500/10 shadow-[0_2px_8px_rgba(245,158,11,0.05)]"
            )}>
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    isDesktopOnline ? "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-amber-400"
                )} />
                {isDesktopOnline ? "Cloud Pipeline Active" : "Desktop Offline — Queuing Mode"}
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar pb-4"
                style={{ maxHeight: 'calc(100vh - 320px)' }}
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                        <Sparkles className="w-12 h-12 text-blue-400 mb-4 animate-pulse" />
                        <p className="text-sm font-bold text-white uppercase tracking-[0.2em]">Start a Session</p>
                        <p className="text-xs text-[#8e8e93] mt-2 max-w-[200px]">Your agents are ready to assist with distribution, creative, and more.</p>
                    </div>
                ) : (
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        const showAgentHeader = !isUser && msg.agentId && msg.agentId !== 'generalist';
                        
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
                                {showAgentHeader && (
                                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] ml-2 mb-0.5">
                                        {msg.agentId}
                                    </span>
                                )}
                                
                                <div className={cn(
                                    "max-w-[85%] px-4 py-3.5 rounded-[22px] text-sm leading-[1.6] shadow-lg",
                                    isUser 
                                        ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20" 
                                        : "bg-white/[0.05] border border-white/5 text-[#d1d1d6] rounded-tl-none"
                                )}>
                                    {msg.text}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-1.5 h-3 bg-blue-400/60 animate-pulse ml-1 align-middle" />
                                    )}
                                </div>
                                
                                <span className="text-[9px] text-[#48484a] font-bold uppercase tracking-widest mx-2">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            className="flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-white/[0.03] border border-white/5 w-fit"
                        >
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            <span className="text-[10px] font-bold text-[#8e8e93] uppercase tracking-widest">Agent is thinking…</span>
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
                        className="absolute bottom-24 left-0 right-0 z-50 overflow-hidden rounded-[32px] bg-[#1c1c1e] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
                    >
                        <div className="p-2">
                            <AgentModePicker 
                                className="border-none bg-transparent"
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

            {/* Input Bar */}
            <div className="mt-auto pt-4 relative z-40 bg-transparent">
                <div className="flex items-end gap-3.5 p-3.5 rounded-[28px] bg-white/[0.03] border border-white/10 shadow-inner">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowAgentPicker(!showAgentPicker)}
                        className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer",
                            selectedMode === 'boardroom' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            selectedMode === 'department' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                            "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        )}
                        style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                        {selectedMode === 'boardroom' ? <LayoutGrid className="w-5.5 h-5.5" /> :
                         selectedMode === 'department' ? <Users className="w-5.5 h-5.5" /> :
                         <UserIcon className="w-5.5 h-5.5" />}
                    </motion.button>
                    
                    <div className="flex-1 min-h-[48px] flex items-center">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={Math.min(3, input.split('\n').length)}
                            placeholder={
                                isListening ? "Listening… speak now" :
                                selectedMode === 'boardroom' ? "Broadcast to Boardroom…" :
                                selectedMode === 'department' ? `Message ${selectedDept || 'Dept'}…` :
                                `Direct message ${selectedAgent || 'Agent'}…`
                            }
                            disabled={isWaiting}
                            className="w-full bg-transparent border-none px-2 py-2 text-sm text-white placeholder:text-[#636366] focus:ring-0 resize-none max-h-32 custom-scrollbar"
                        />
                    </div>

                    <div className="flex items-center gap-2.5 pr-1 pb-1">
                        {voiceSupported && (
                            <motion.button
                                type="button"
                                whileTap={{ scale: 0.9 }}
                                onClick={toggleListening}
                                aria-label={isListening ? 'Stop dictation' : 'Start voice dictation'}
                                className={cn(
                                    "w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                                    isListening
                                        ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                        : "text-[#636366] hover:text-white"
                                )}
                                style={{ minWidth: '44px', minHeight: '44px' }}
                            >
                                <Mic className={cn("w-5.5 h-5.5", isListening && "animate-pulse")} />
                            </motion.button>
                        )}
                        
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleSend}
                            disabled={!input.trim() || isWaiting}
                            className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-lg cursor-pointer",
                                input.trim() && !isWaiting 
                                    ? "bg-white text-black shadow-white/10" 
                                    : "bg-white/5 text-[#48484a] cursor-not-allowed"
                            )}
                            style={{ minWidth: '44px', minHeight: '44px' }}
                        >
                            {isWaiting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}
