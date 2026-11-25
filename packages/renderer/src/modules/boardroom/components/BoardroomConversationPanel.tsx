import { useMobile } from '@/hooks/useMobile';
import React, { useRef, useLayoutEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Components } from 'react-markdown';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { BoardroomAssetStrip } from './BoardroomAssetStrip';
import { BoardroomStarterCards } from './BoardroomStarterCards';
import { MessageSquare } from 'lucide-react';
import { PromptArea } from '@/core/components/command-bar/PromptArea';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { BoardroomMessageRow } from './BoardroomMessageRow';

interface BoardroomConversationPanelProps {
    messages?: AgentMessage[];
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
export function BoardroomConversationPanel({ messages: messagesProp }: BoardroomConversationPanelProps) {
    const storeMessages = useStore(state => (messagesProp !== undefined ? undefined : state.agentHistory));
    const messages = messagesProp ?? storeMessages ?? [];
    const scrollRef = useRef<HTMLDivElement>(null);
    const shouldFollowRef = useRef(true);
    const previousMessageCountRef = useRef(0);
    const { isAnyPhone } = useMobile();
    const [visibleMessageCount, setVisibleMessageCount] = React.useState(BOARDROOM_MESSAGE_BATCH_SIZE);
    const { showCognitiveLogicByDefault, activeAgents, openBoardroomBrowser } = useStore(
        useShallow(state => ({
            showCognitiveLogicByDefault: state.userProfile?.preferences?.showCognitiveLogicByDefault ?? false,
            activeAgents: state.activeAgents,
            openBoardroomBrowser: state.openBoardroomBrowser,
        }))
    );
    const latestMessage = messages[messages.length - 1];
    const latestMessageSignature = latestMessage
        ? `${latestMessage.id}:${latestMessage.text?.length || 0}:${latestMessage.isStreaming ? 1 : 0}:${latestMessage.thoughts?.length || 0}:${latestMessage.attachments?.length || 0}`
        : 'empty';
    const firstVisibleMessageIndex = Math.max(0, messages.length - visibleMessageCount);
    const visibleMessages = messages.slice(firstVisibleMessageIndex);
    const agentsResponding = messages.some(message => message.role !== 'user' && message.isStreaming);
    const markdownComponents = React.useMemo<Components>(() => ({
        a: ({ node: _node, href, children, ...props }: React.ComponentPropsWithoutRef<'a'> & { node?: unknown }) => (
            <a
                {...props}
                href={href}
                onClick={(event) => {
                    if (href && (href.startsWith('http://') || href.startsWith('https://')) &&
                        !event.metaKey && !event.ctrlKey && openBoardroomBrowser) {
                        event.preventDefault();
                        openBoardroomBrowser(href, 'split');
                    }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline break-all cursor-pointer"
            >
                {children}
            </a>
        ),
        p: ({ node: _node, ...props }) => <p {...props} className="mb-2 last:mb-0 break-words [overflow-wrap:anywhere]" />,
        ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-4 mb-2 break-words" />,
        ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-4 mb-2 break-words" />,
        img: ({ node: _node, ...props }) => <img {...props} className="rounded-lg max-w-full max-h-[300px] object-contain my-2 border border-white/10 shadow-lg" alt={props.alt || 'Generated asset'} />,
        pre: ({ node: _node, ...props }) => (
            <pre {...props} className="p-3 my-2 rounded-lg bg-black/40 border border-white/10 overflow-x-auto text-xs font-mono text-white/90 max-w-full whitespace-pre-wrap break-all" />
        ),
        code: ({ node: _node, inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { node?: unknown; inline?: boolean }) => (
            inline ? (
                <code {...props} className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 font-mono text-xs break-all">{children}</code>
            ) : (
                <code {...props} className={`${className || ''} break-all`}>{children}</code>
            )
        ),
        table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto max-w-full my-2 border border-white/10 rounded-lg">
                <table {...props} className="min-w-full text-xs" />
            </div>
        ),
    }), [openBoardroomBrowser]);

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

    const handleScroll = () => {
        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        const distanceFromBottom =
            scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
        shouldFollowRef.current = distanceFromBottom <= 80;
    };

    // No UI-side stream timeout (ISSUE-1627). AgentService owns the run timeout
    // (300s, 600s for generation) and clears isStreaming in every branch; reloads are
    // recovered by recoverInterruptedMessages in agentSessionSlice. A shorter UI timer
    // used to mark live tool calls as finished and persist that false state.

    return (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {messages.length === 0 ? (
                /* Empty State — centered vertically while preserving the prompt below. */
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center text-center p-6 min-w-0 space-y-4">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center mb-3">
                            <MessageSquare size={20} className="text-indigo-400/60" />
                        </div>
                        <TextEffect preset="fade" className="text-sm font-medium text-white/50">Awaiting discussion...</TextEffect>
                        {isAnyPhone ? (
                            activeAgents.length > 0 ? (
                                <TextEffect preset="fade" delay={0.5} className="text-xs text-white/30 mt-1 max-w-[240px]">
                                    {`Talk to ${activeAgents.map(id => resolveAgentVisualIdentity(id).displayName).join(', ')}.`}
                                </TextEffect>
                            ) : (
                                <TextEffect preset="fade" delay={0.5} className="text-xs text-white/30 mt-1 max-w-[240px]">
                                    Tap 'Seat Agents' above to select participants and start.
                                </TextEffect>
                            )
                        ) : (
                            <TextEffect preset="fade" delay={0.5} className="text-xs text-white/30 mt-1 max-w-[280px]">
                                Select agents and submit a brief to start the boardroom session.
                            </TextEffect>
                        )}
                    </div>

                    {/* Quick executive action starters */}
                    <BoardroomStarterCards compact={isAnyPhone} />
                </div>

            ) : (
                <>
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
                    {visibleMessages.map((msg) => (
                        <BoardroomMessageRow
                            key={msg.id}
                            msg={msg}
                            userAwaitingResponse={msg.role === 'user' && agentsResponding}
                            showCognitiveLogicByDefault={showCognitiveLogicByDefault}
                            markdownComponents={markdownComponents}
                        />
                    ))}
                </AnimatePresence>

                {/* Scroll anchor */}
                <div className="h-4 w-full shrink-0" />
            </div>

                </>
            )}

            {/* Keep PromptArea in one reconciliation position as messages arrive. */}
            <div className="p-4 border-t border-white/5 bg-white/1 shrink-0 min-w-0">
                <PromptArea isDocked className="w-full max-w-none min-w-0" />
            </div>
        </div>
    );
}
