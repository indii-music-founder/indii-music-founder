/**
 * AgentChat — Phone-side chat using Firestore Cloud Relay.
 *
 * Architecture (Firestore):
 *   Phone types "Where is my show tonight?"
 *   → remoteRelayService.sendCommand("Where is my show tonight?")
 *   → Writes to Firestore: users/{uid}/remote-relay/commands/{id}
 *   → Desktop's onSnapshot fires immediately
 *   → Desktop runs agentService.sendMessage() with full auth + orchestration
 *   → Desktop writes response to Firestore: users/{uid}/remote-relay/responses/{id}
 *   → Phone's onSnapshot fires, displays the response
 *
 * Works from ANYWHERE — cellular, different WiFi, different countries.
 * Falls back to HTTP relay if user is not authenticated.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wifi, WifiOff, LogIn, ChevronDown, LayoutGrid, Users, User as UserIcon } from 'lucide-react';
import { remoteRelayService, type RemoteResponse, type DesktopState } from '@/services/agent/RemoteRelayService';
import { AgentModePicker } from '@/components/AgentModePicker';
import { ConversationMode } from '@/core/store/slices/agent/agentUISlice';
import { auth } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';

// Available specialist agents for routing
// Agent IDs MUST match the keys in AGENT_PROMPTS (packages/firebase/src/relay/agentPrompts.ts).
// Mismatches cause silent fallback to the generalist conductor.
// CONTROLLER_AGENTS is now derived from AgentModePicker via DEPARTMENTS

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

export default function AgentChat({ onSendCommand: _onSendCommand }: AgentChatProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
    
    // Mode and targeting state for mobile remote
    const [selectedMode, setSelectedMode] = useState<ConversationMode>('boardroom');
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    
    const [showAgentPicker, setShowAgentPicker] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pendingCommandId = useRef<string | null>(null);
    const responseUnsub = useRef<(() => void) | null>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Watch auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
        });
        return unsubscribe;
    }, []);

    // Listen for desktop state via Firestore
    useEffect(() => {
        if (!isAuthenticated) return;

        const unsubscribe = remoteRelayService.onDesktopState((state) => {
            setDesktopState(state);
        });

        return unsubscribe;
    }, [isAuthenticated]);

    // Cleanup response listener on unmount
    useEffect(() => {
        return () => {
            if (responseUnsub.current) {
                responseUnsub.current();
                responseUnsub.current = null;
            }
        };
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isWaiting || !isAuthenticated) return;
        const userText = input.trim();
        setInput('');
        setIsWaiting(true);

        // Add user message immediately
        setMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            text: userText,
            timestamp: Date.now(),
        }]);

        try {
            // Send command via Firestore with targeted agent/dept/mode context
            // If boardroom, target is undefined (generalist conductor)
            // If department, target is the head of the department
            // If direct, target is the specific agent
            let targetAgentId: string | undefined = undefined;
            if (selectedMode === 'department' && selectedDept) {
                targetAgentId = selectedDept; // Head ID usually matches Dept ID in our system
            } else if (selectedMode === 'direct' && selectedAgent) {
                targetAgentId = selectedAgent;
            }

            const commandId = await remoteRelayService.sendCommand(userText, targetAgentId);
            if (!commandId) throw new Error('Failed to send command');

            pendingCommandId.current = commandId;
            logger.info(`[AgentChat] 📱→☁️ Command sent via Firestore: ${commandId} → agent: ${targetAgentId || 'auto'}`);

            // Safety timeout: if no final response within 60s, reset the UI
            const safetyTimeout = setTimeout(() => {
                if (pendingCommandId.current === commandId) {
                    logger.warn(`[AgentChat] ⏰ Response timeout for command ${commandId}`);
                    setMessages(prev => [...prev, {
                        id: `timeout-${Date.now()}`,
                        commandId,
                        role: 'model',
                        text: '⏰ Response timed out. The desktop may still be processing — try sending again.',
                        timestamp: Date.now(),
                        isStreaming: false,
                    }]);
                    pendingCommandId.current = null;
                    setIsWaiting(false);
                    if (responseUnsub.current) {
                        responseUnsub.current();
                        responseUnsub.current = null;
                    }
                }
            }, 60_000);

            // Listen for responses to this specific command
            if (responseUnsub.current) responseUnsub.current();
            responseUnsub.current = remoteRelayService.onResponse(
                commandId,
                (response: RemoteResponse) => {
                    if (response.isStreaming) {
                        // Update streaming placeholder
                        setMessages(prev => {
                            const existing = prev.find(
                                m => m.commandId === response.commandId && m.role === 'model'
                            );
                            if (existing) {
                                return prev.map(m =>
                                    m.commandId === response.commandId && m.role === 'model'
                                        ? { ...m, text: response.text, isStreaming: true }
                                        : m
                                );
                            }
                            return [...prev, {
                                id: `resp-${Date.now()}`,
                                commandId: response.commandId,
                                role: 'model',
                                text: response.text,
                                timestamp: Date.now(),
                                agentId: response.agentId,
                                isStreaming: true,
                            }];
                        });
                    } else {
                        // Final response — replace streaming placeholder
                        clearTimeout(safetyTimeout);
                        setMessages(prev => {
                            const filtered = prev.filter(
                                m => !(m.commandId === response.commandId && m.role === 'model')
                            );
                            return [...filtered, {
                                id: `resp-${Date.now()}`,
                                commandId: response.commandId,
                                role: 'model',
                                text: response.text,
                                timestamp: Date.now(),
                                agentId: response.agentId,
                                isStreaming: false,
                            }];
                        });
                        pendingCommandId.current = null;
                        setIsWaiting(false);

                        // Cleanup this specific listener
                        if (responseUnsub.current) {
                            responseUnsub.current();
                            responseUnsub.current = null;
                        }
                    }
                }
            );
        } catch (error: unknown) {
            logger.error('[AgentChat] Failed to send command:', error);
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'model',
                text: '❌ Cannot reach your agents. Make sure you\'re logged in and the desktop is running.',
                timestamp: Date.now(),
            }]);
            setIsWaiting(false);
            setInput(userText);
        }
    }, [input, isWaiting, isAuthenticated, selectedAgent]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // If not authenticated, show login prompt
    if (!isAuthenticated) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4">
                    <LogIn className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-[#c9d1d9] font-medium mb-2">Sign in to connect</p>
                <p className="text-xs text-[#484f58] max-w-[260px]">
                    Log into indiiOS to access your agents remotely. Your desktop and phone use the same account — messages sync through Firestore in real-time.
                </p>
            </div>
        );
    }

    const isDesktopOnline = desktopState?.online ?? false;

    return (
        <div className="flex flex-col h-full">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 mb-2 rounded-lg text-[10px] ${isDesktopOnline
                ? 'text-green-400 bg-green-900/10'
                : 'text-amber-400 bg-amber-900/10'
                }`}>
                {isDesktopOnline ? (
                    <><Wifi className="w-3 h-3" /> Desktop online — connected via cloud</>
                ) : (
                    <><WifiOff className="w-3 h-3" /> Desktop offline — messages will queue</>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-1"
                style={{ maxHeight: 'calc(100vh - 240px)' }}
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center mb-3">
                            <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="text-sm text-[#c9d1d9] font-medium">Talk to your agents</p>
                        <p className="text-xs text-[#484f58] mt-1 max-w-[250px]">
                            Messages sync through Firestore — works from anywhere, any network
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={msg.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
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
                                    {msg.agentId && msg.agentId !== 'generalist' && (
                                        <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wide block mb-1">
                                            {msg.agentId}
                                        </span>
                                    )}
                                    {msg.text}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-1.5 h-3 bg-purple-400/60 animate-pulse ml-0.5" />
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Waiting for desktop indicator */}
                {isWaiting && !messages.some(m => m.isStreaming) && (
                    <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-[#161b22] border border-[#30363d]/40">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                                <span className="text-[10px] text-[#6e7681]">Desktop is processing…</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hierarchical Agent Mode Picker */}
            {showAgentPicker && (
                <div className="absolute bottom-20 left-0 right-0 mx-3 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden">
                    <AgentModePicker 
                        className="border-none bg-transparent"
                        mode={selectedMode}
                        onModeChange={setSelectedMode}
                        departmentId={selectedDept}
                        onDepartmentChange={setSelectedDept}
                        agentId={selectedAgent}
                        onAgentChange={setSelectedAgent}
                    />
                    <button 
                        onClick={() => setShowAgentPicker(false)}
                        className="w-full py-3 bg-blue-600/10 text-blue-400 text-xs font-bold border-t border-[#30363d] hover:bg-blue-600/20 transition-colors"
                    >
                        DONE
                    </button>
                </div>
            )}

            {/* Input with agent selector */}
            <div className="mt-3 flex gap-2">
                <button
                    onClick={() => setShowAgentPicker(!showAgentPicker)}
                    className={cn(
                        "flex items-center gap-1 px-3 h-10 rounded-xl border transition-all flex-shrink-0",
                        selectedMode === 'boardroom' ? "bg-purple-600/20 border-purple-500/30 text-purple-400" :
                        selectedMode === 'department' ? "bg-blue-600/20 border-blue-500/30 text-blue-400" :
                        "bg-pink-600/20 border-pink-500/30 text-pink-400"
                    )}
                    title="Select mode/agent"
                >
                    {selectedMode === 'boardroom' ? <LayoutGrid className="w-4 h-4" /> :
                     selectedMode === 'department' ? <Users className="w-4 h-4" /> :
                     <UserIcon className="w-4 h-4" />}
                    <ChevronDown className="w-3 h-3 ml-1" />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isWaiting ? 'Waiting…' : 
                                selectedMode === 'boardroom' ? "Message Boardroom…" :
                                selectedMode === 'department' ? `Message ${selectedDept || 'Dept'}…` :
                                `Message ${selectedAgent || 'Agent'}…`}
                    disabled={isWaiting}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#484f58] focus:outline-none focus:border-blue-600/50 transition-colors disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isWaiting}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center transition-colors active:scale-95"
                >
                    {isWaiting ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                        <Send className="w-4 h-4 text-white" />
                    )}
                </button>
            </div>
        </div>
    );
}
