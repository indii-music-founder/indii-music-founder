import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '@/utils/logger';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { BoardroomAssetStrip } from './BoardroomAssetStrip';
import {
    Bot,
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
    MessageSquare,
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
import { PromptArea } from '@/core/components/command-bar/PromptArea';
import { ThoughtChain } from '@/core/components/chat/ThoughtChain';
import { PersonaResponseActions } from '@/core/components/chat/PersonaResponseActions';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { useMobile } from '@/hooks/useMobile';
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

interface BoardroomConversationPanelProps {
    messages: AgentMessage[];
}

// Rich Boardroom messages can each mount Markdown controls, thought-chain
// controls, and response actions. Rendering an account's entire lifetime
// history at once produced thousands of interactive nodes and made ordinary
// navigation unreliable. Keep recent context immediate and reveal history in
// bounded batches when the user asks for it.
export const BOARDROOM_MESSAGE_BATCH_SIZE = 75;

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
    const shouldFollowRef = useRef(true);
    const previousMessageCountRef = useRef(0);
    const [visibleMessageCount, setVisibleMessageCount] = React.useState(BOARDROOM_MESSAGE_BATCH_SIZE);
    const { showCognitiveLogicByDefault, activeAgents } = useStore(
        useShallow(state => ({
            showCognitiveLogicByDefault: state.userProfile?.preferences?.showCognitiveLogicByDefault ?? false,
            activeAgents: state.activeAgents,
        }))
    );
    const { isAnyPhone } = useMobile();
    const latestMessage = messages[messages.length - 1];
    const latestMessageSignature = latestMessage
        ? `${latestMessage.id}:${latestMessage.text?.length || 0}:${latestMessage.isStreaming ? 1 : 0}:${latestMessage.thoughts?.length || 0}`
        : 'empty';
    const firstVisibleMessageIndex = Math.max(0, messages.length - visibleMessageCount);
    const visibleMessages = messages.slice(firstVisibleMessageIndex);

    // Start at the newest message and follow streaming updates while the user
    // remains near the bottom. Instant positioning avoids smooth-scroll jitter
    // as message cards grow token-by-token.
    useLayoutEffect(() => {
        if (messages.length > previousMessageCountRef.current) {
            shouldFollowRef.current = true;
        }
        previousMessageCountRef.current = messages.length;

        const scrollContainer = scrollRef.current;
        if (scrollContainer && shouldFollowRef.current) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'auto',
            });
        }
    }, [latestMessageSignature, messages.length]);

    const handleScroll = useCallback(() => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        const distanceFromBottom =
            scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
        shouldFollowRef.current = distanceFromBottom <= 80;
    }, []);

    // Auto-cleanup stale streaming states if execution hangs or connection is lost (Issue-022)
    useEffect(() => {
        const hasStreaming = messages.some(m => m.isStreaming);
        if (hasStreaming) {
            const timeout = setTimeout(() => {
                import('@/core/store').then(({ useStore }) => {
                    const state = useStore.getState();
                    messages.forEach(msg => {
                        if (msg.isStreaming) {
                            state.updateAgentMessage(msg.id, { isStreaming: false });
                        }
                    });
                }).catch((err) => logger.error('Failed to load store for stale-stream cleanup:', err));
            }, 60000); // Max Swarm execution timeout is 60s
            return () => clearTimeout(timeout);
        }
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                {/* Empty State — centered vertically in the available space */}
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center mb-4">
                        <MessageSquare size={22} className="text-indigo-400/50" />
                    </div>
                    <TextEffect preset="fade" className="text-sm font-medium text-white/40">Awaiting discussion...</TextEffect>
                    {isAnyPhone ? (
                        activeAgents.length > 0 ? (
                            <TextEffect preset="fade" delay={0.5} className="text-xs text-white/20 mt-1 max-w-[240px]">
                                {`Talk to ${activeAgents.map(id => resolveAgentVisualIdentity(id).displayName).join(', ')}. Tap '${activeAgents.length} active' above to change.`}
                            </TextEffect>
                        ) : (
                            <TextEffect preset="fade" delay={0.5} className="text-xs text-white/20 mt-1 max-w-[240px]">
                                Tap 'Seat Agents' above to select participants and start.
                            </TextEffect>
                        )
                    ) : (
                        <TextEffect preset="fade" delay={0.5} className="text-xs text-white/20 mt-1 max-w-[240px]">
                            Select agents and submit a brief to start the boardroom session.
                        </TextEffect>
                    )}
                </div>

                {/* Prompt Area — always visible so users can start the conversation */}
                <div className="p-4 border-t border-white/5 bg-white/1 shrink-0 min-w-0">
                    <PromptArea isDocked className="w-full max-w-none min-w-0" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 shrink-0 min-w-0">
                <MessageSquare size={14} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60 truncate">
                    Discussion
                </span>
                <span className="ml-auto text-[10px] font-mono text-white/20 shrink-0">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ISSUE-1361: in-page asset strip — created assets visible without
                flipping back to the Studio */}
            <BoardroomAssetStrip />

            {/* Scrollable Message List */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-4 space-y-1 min-w-0"
            >
                {firstVisibleMessageIndex > 0 && (
                    <div className="flex justify-center pb-3">
                        <button
                            type="button"
                            onClick={() => setVisibleMessageCount(count => count + BOARDROOM_MESSAGE_BATCH_SIZE)}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            Show earlier messages ({firstVisibleMessageIndex} remaining)
                        </button>
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {visibleMessages.map((msg) => {
                        const identity = resolveAgentVisualIdentity(msg.agentId);
                        const isUser = msg.role === 'user';
                        const AgentIcon = AGENT_ICONS[identity.iconKey];
                        const displayText = sanitizeBoardroomMessage(
                            msg.text || (msg as { content?: string }).content || '',
                        );

                        return (
                            <motion.div
                                key={msg.id}
                                data-message-id={msg.id}
                                data-agent-id={msg.agentId}
                                data-agent-accent={isUser ? undefined : identity.accent}
                                data-agent-icon={isUser ? undefined : identity.iconKey}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className={`flex items-start gap-3 py-3 px-3 rounded-xl transition-colors min-w-0 max-w-full ${isUser ? 'bg-white/2' : 'hover:bg-white/2'}`}
                            >
                                {/* Avatar */}
                                <div className="shrink-0 mt-0.5">
                                    {isUser ? (
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-indigo-300">You</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="w-8 h-8 rounded-full flex flex-col items-center justify-center border"
                                            style={{
                                                ...identity.cssProperties,
                                                backgroundColor: identity.surface,
                                                borderColor: identity.border,
                                                color: identity.foreground,
                                                boxShadow: `0 0 12px ${identity.glow}`,
                                            } as React.CSSProperties}
                                            aria-label={identity.ariaLabel}
                                        >
                                            <AgentIcon size={11} aria-hidden="true" style={{ color: identity.accent }} />
                                            <span className="text-[7px] font-black leading-none">{identity.initials}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Message Content */}
                                <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                                    {/* Agent Name Label */}
                                    {!isUser && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 truncate">
                                            {identity.displayName}
                                        </p>
                                    )}
                                    {isUser && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/50 mb-1 truncate">
                                            You
                                        </p>
                                    )}

                                    {!isUser && msg.thoughts && (
                                        <ThoughtChain
                                            thoughts={msg.thoughts}
                                            messageId={msg.id}
                                            compact
                                            defaultOpen={showCognitiveLogicByDefault}
                                        />
                                    )}

                                    {/* Message Text */}
                                    <div className="message-content text-sm text-white/80 leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-w-0 max-w-full">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline break-all" />,
                                                p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0 break-words [overflow-wrap:anywhere]" />,
                                                ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 mb-2 break-words" />,
                                                ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 mb-2 break-words" />,
                                                img: ({ node, ...props }) => <img {...props} className="rounded-lg max-w-full max-h-[300px] object-contain my-2 border border-white/10 shadow-lg" alt={props.alt || 'Generated asset'} />,
                                                pre: ({ node, ...props }) => (
                                                    <pre {...props} className="p-3 my-2 rounded-lg bg-black/40 border border-white/10 overflow-x-auto text-xs font-mono text-white/90 max-w-full whitespace-pre-wrap break-all" />
                                                ),
                                                code: ({ node: _node, inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { node?: unknown; inline?: boolean }) => (
                                                    inline ? (
                                                        <code {...props} className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 font-mono text-xs break-all">
                                                            {children}
                                                        </code>
                                                    ) : (
                                                        <code {...props} className={`${className || ''} break-all`}>
                                                            {children}
                                                        </code>
                                                    )
                                                ),
                                                table: ({ node, ...props }) => (
                                                    <div className="overflow-x-auto max-w-full my-2 border border-white/10 rounded-lg">
                                                        <table {...props} className="min-w-full text-xs" />
                                                    </div>
                                                )
                                            }}
                                        >
                                             {displayText}
                                        </ReactMarkdown>
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
                                    {!isUser && !msg.isStreaming && (
                                        <PersonaResponseActions text={displayText} metadata={msg.metadata} />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Scroll anchor */}
                <div className="h-4 w-full shrink-0" />
            </div>

            {/* Inline PromptArea for Boardroom */}
            <div className="p-4 border-t border-white/5 bg-white/1 shrink-0 min-w-0">
                <PromptArea isDocked className="w-full max-w-none min-w-0" />
            </div>
        </div>
    );
}

/**
 * Sanitizes Boardroom message text before rendering.
 * Strips internal agent artifacts that should never be user-visible:
 * - [Tool: name]...[End Tool name] blocks (tool execution output)
 * - (SYSTEM NOTE): ... injected boardroom context
 * - [SEATED_AGENTS]: ... seating manifest
 */
function sanitizeBoardroomMessage(text: string): string {
    return text
        // Strip raw JSON code blocks (often leaked by agents during tool processing)
        .replace(/```json[\s\S]*?```/g, '')
        // Strip [Tool: name]...[End Tool name] blocks
        .replace(/\[Tool: [^\]]+\][\s\S]*?\[End Tool [^\]]+\]\n?/g, '')
        // Strip (SYSTEM NOTE): lines
        .replace(/\(SYSTEM NOTE\):[^\n]*\n?/g, '')
        // Strip [SEATED_AGENTS]: lines
        .replace(/\[SEATED_AGENTS\]:[^\n]*\n?/g, '')
        // Strip (PRIOR CONTEXT): blocks
        .replace(/\(PRIOR CONTEXT\):[\s\S]*$/g, '')
        // Strip any remaining [Thought] or [Action] prefixes if they leak into text
        .replace(/^\[Thought\]:.*$/gm, '')
        .replace(/^\[Action\]:.*$/gm, '')
        .trim();
}
