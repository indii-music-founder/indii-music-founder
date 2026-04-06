import React from 'react';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { BoardroomEmptyState } from './BoardroomEmptyState';
import { MessageFeed } from './MessageFeed';

interface BoardroomTableProps {
    messages: AgentMessage[];
}

/**
 * BoardroomTable — The glassmorphic oval table with core glow effect.
 * Contains either the empty state or the message feed depending on messages.
 */
export function BoardroomTable({ messages }: BoardroomTableProps) {
    return (
        <div className="absolute inset-8 rounded-[100%] border border-white/10 bg-white/[0.02] backdrop-blur-3xl shadow-[0_0_80px_rgba(99,102,241,0.1)] flex items-center justify-center overflow-hidden">
            {/* Table Core Glow */}
            <div className="absolute w-1/2 h-1/2 rounded-[100%] bg-indigo-500/20 blur-[100px] pointer-events-none" />

            {/* Inner Dialog Area (Agent Responses) */}
            <div className="relative z-10 w-full h-full p-8 md:p-16 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                {messages.length === 0 ? (
                    <BoardroomEmptyState />
                ) : (
                    <MessageFeed messages={messages} />
                )}
            </div>
        </div>
    );
}
