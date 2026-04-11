import React from 'react';
import { ChatMessage } from '@/core/components/chat/ChatMessage';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { agentRegistry } from '@/services/agent/registry';

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
            {messages.map((msg) => {
                let agentIdentity = undefined;

                if (msg.agentId) {
                    // Try to find the agent metadata to pull its name and color
                    const allMeta = agentRegistry.getAll();
                    const agentMeta = allMeta.find(a => a.id === msg.agentId);

                    if (agentMeta) {
                        // Attempt to extract tailwind color name (e.g. bg-rose-500 -> rose)
                        const colorMatch = agentMeta.color.match(/(?:bg|text)-([a-z]+)-/i);
                        const baseColor = colorMatch?.[1] || 'purple';

                        const nameStr = agentMeta.name || 'Agent';
                        const words = nameStr.split(' ');
                        const initials = (words.length > 1 && words[0]?.[0] && words[1]?.[0])
                            ? (words[0][0] + words[1][0]).toUpperCase()
                            : nameStr.substring(0, 2).toUpperCase();

                        agentIdentity = {
                            color: baseColor,
                            initials
                        };
                    }
                }

                return (
                    <ChatMessage
                        key={msg.id}
                        msg={msg}
                        agentIdentity={agentIdentity}
                    />
                );
            })}
        </div>
    );
}
