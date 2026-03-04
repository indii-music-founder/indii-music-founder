import React from 'react';

/* ── UI Components ── */
import CommandBar from '@/core/components/CommandBar';
import { AgentHeader } from './AgentHeader';
import { EmptyState } from './EmptyState';
import { ChatMessages } from './ChatMessages';

/* ── Logic ── */
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';

/* ================================================================== */
/*  Agent Workspace — Core AI Orchestration Interface                  */
/* ================================================================== */

export default function AgentWorkspace() {
    const {
        agentHistory,
        isAgentProcessing,
        uptime,
        chatEndRef,
        setCommandInput,
    } = useAgentWorkspace();

    return (
        <div className="flex-1 flex flex-col h-full bg-grid-white/[0.02] relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-dept-marketing/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 -z-10" />

            {/* Header */}
            <AgentHeader uptime={uptime} isProcessing={isAgentProcessing} />

            {/* Main Chat Area */}
            {agentHistory.length === 0 ? (
                <EmptyState onCommandClick={(cmd) => setCommandInput(cmd)} />
            ) : (
                <ChatMessages
                    history={agentHistory}
                    isProcessing={isAgentProcessing}
                    chatEndRef={chatEndRef}
                />
            )}

            {/* Float Command Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none flex justify-center z-50">
                <div className="w-full max-w-4xl pointer-events-auto">
                    <CommandBar />
                </div>
            </div>
        </div>
    );
}
