/**
 * AgentChat — Phone-side chat that relays messages through the Vite server
 * to the desktop's agentService.
 *
 * Architecture:
 *   Phone types "Where is my show tonight?"
 *   → POST /api/remote/send { text: "..." }
 *   → Vite server queues the command
 *   → Desktop polls /api/remote/poll, sees the command
 *   → Desktop runs agentService.sendMessage("Where is my show tonight?")
 *   → Desktop's Road Manager agent responds with venue details
 *   → Desktop POSTs response to /api/remote/respond
 *   → Phone polls /api/remote/responses, displays the response
 *
 * This gives the phone FULL ACCESS to the desktop's agent army:
 * Road Manager, Creative Director, Finance, Legal, Marketing — everything.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Wifi, WifiOff } from 'lucide-react';
import { logger } from '@/utils/logger';

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

// Resolve the relay URL: same origin as the page
function getRelayUrl(): string {
    return window.location.origin;
}

export default function AgentChat({ onSendCommand: _onSendCommand }: AgentChatProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isWaiting, setIsWaiting] = useState(false);
    const [relayConnected, setRelayConnected] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastResponseTime = useRef(0);
    const pollRef = useRef<ReturnType<typeof setInterval>>();
    const pendingCommandId = useRef<string | null>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Check relay connectivity on mount
    useEffect(() => {
        const checkRelay = async () => {
            try {
                const res = await fetch(`${getRelayUrl()}/api/remote/state`);
                if (res.ok) {
                    const data = await res.json();
                    setRelayConnected(!!data.timestamp || res.ok);
                }
            } catch {
                setRelayConnected(false);
            }
        };
        checkRelay();
        const interval = setInterval(checkRelay, 10000);
        return () => clearInterval(interval);
    }, []);

    // Poll for responses from the desktop
    useEffect(() => {
        const pollResponses = async () => {
            if (!pendingCommandId.current) return;

            try {
                const res = await fetch(
                    `${getRelayUrl()}/api/remote/responses?since=${lastResponseTime.current}`
                );
                if (!res.ok) return;

                const data = await res.json();
                const responses = data.responses as Array<{
                    commandId: string;
                    text: string;
                    role: string;
                    timestamp: number;
                    isStreaming?: boolean;
                    agentId?: string;
                }>;

                if (!responses || responses.length === 0) return;

                for (const resp of responses) {
                    if (resp.commandId !== pendingCommandId.current) continue;
                    lastResponseTime.current = Math.max(lastResponseTime.current, resp.timestamp);

                    if (resp.isStreaming) {
                        // Update the streaming placeholder
                        setMessages(prev => {
                            const existing = prev.find(m => m.commandId === resp.commandId && m.role === 'model');
                            if (existing) {
                                return prev.map(m =>
                                    m.commandId === resp.commandId && m.role === 'model'
                                        ? { ...m, text: resp.text, isStreaming: true }
                                        : m
                                );
                            }
                            return [...prev, {
                                id: `resp-${Date.now()}`,
                                commandId: resp.commandId,
                                role: 'model',
                                text: resp.text,
                                timestamp: resp.timestamp,
                                agentId: resp.agentId,
                                isStreaming: true,
                            }];
                        });
                    } else {
                        // Final response — replace streaming placeholder
                        setMessages(prev => {
                            const filtered = prev.filter(
                                m => !(m.commandId === resp.commandId && m.role === 'model')
                            );
                            return [...filtered, {
                                id: `resp-${Date.now()}`,
                                commandId: resp.commandId,
                                role: 'model',
                                text: resp.text,
                                timestamp: resp.timestamp,
                                agentId: resp.agentId,
                                isStreaming: false,
                            }];
                        });
                        pendingCommandId.current = null;
                        setIsWaiting(false);
                    }
                }
            } catch (err) {
                logger.warn('[AgentChat] Response poll failed:', err);
            }
        };

        pollRef.current = setInterval(pollResponses, 1000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isWaiting) return;
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
            // Send to the relay → desktop will pick it up
            const res = await fetch(`${getRelayUrl()}/api/remote/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: userText }),
            });

            if (!res.ok) throw new Error('Relay unavailable');

            const data = await res.json();
            pendingCommandId.current = data.id;
            logger.info(`[AgentChat] 📱→🖥️ Command sent: ${data.id}`);
        } catch (error) {
            logger.error('[AgentChat] Failed to send command:', error);
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'model',
                text: '❌ Cannot reach the desktop. Make sure indiiOS is running on your computer.',
                timestamp: Date.now(),
            }]);
            setIsWaiting(false);
            setInput(userText); // Restore the input
        }
    }, [input, isWaiting]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 mb-2 rounded-lg text-[10px] ${relayConnected
                    ? 'text-green-400 bg-green-900/10'
                    : 'text-red-400 bg-red-900/10'
                }`}>
                {relayConnected ? (
                    <><Wifi className="w-3 h-3" /> Connected to desktop</>
                ) : (
                    <><WifiOff className="w-3 h-3" /> Desktop not reachable</>
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
                            Messages go to your desktop's indiiOS — full access to all your agents, projects, and data
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

            {/* Input */}
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isWaiting ? 'Waiting for desktop…' : 'Message your agents…'}
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
