import React from 'react';
import { ChatMessage } from '@/core/components/chat/ChatMessage';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';

interface MessageFeedProps {
    messages: AgentMessage[];
}

/**
 * MessageFeed — Renders a scrollable list of boardroom messages.
 * Each message is rendered by the shared ChatMessage component.
 */
export function MessageFeed({ messages }: MessageFeedProps) {
    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full pb-32">
            {messages.map((msg) => (
                <ChatMessage key={msg.id} msg={msg} />
            ))}
        </div>
    );
}
