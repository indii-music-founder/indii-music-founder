import React from 'react';

/* ── UI Components ── */
import CommandBar from '@/core/components/CommandBar';
import { AgentHeader } from './AgentHeader';
import { EmptyState } from './EmptyState';
import { WorkspaceCanvas } from './WorkspaceCanvas';

/* ── Logic ── */
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { useStore } from '@/core/store';

/* ================================================================== */
/*  Agent Workspace — Core AI Orchestration Interface                  */
/*                                                                      */
/*  Layout:                                                             */
/*    - AgentHeader: top status bar (online, uptime, model)            */
/*    - WorkspaceCanvas: the CENTER. Rich media output panel.          */
/*      Images being generated, documents, reports, charts, video      */
/*      previews, and any artifact Indii produces appear here.         */
/*      The chat/conversation lives in the floating ChatOverlay.       */
/*    - CommandBar: floats at bottom for input                         */
/* ================================================================== */

export default function AgentWorkspace() {
    const {
        isAgentProcessing,
        uptime,
        setCommandInput,
        submitCommand,
    } = useAgentWorkspace();

    const canvasItems = useStore((s) => s.canvasItems);
    const removeCanvasItem = useStore((s) => s.removeCanvasItem);

    return (
        <div className="flex-1 flex flex-col h-full bg-grid-white/[0.02] relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3 -z-10" />

            {/* Header */}
            <AgentHeader uptime={uptime} isProcessing={isAgentProcessing} />

            {/* Center: Canvas or Empty State */}
            <div className="flex-1 overflow-hidden pb-32">
                {canvasItems.length === 0 ? (
                    <EmptyState
                        onCommandClick={(cmd) => setCommandInput(cmd)}
                        onCommandSubmit={submitCommand}
                    />
                ) : (
                    <WorkspaceCanvas
                        items={canvasItems}
                        onDismiss={(id) => removeCanvasItem(id)}
                    />
                )}
            </div>

            {/* Floating Command Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none flex justify-center z-50">
                <div className="w-full max-w-4xl pointer-events-auto">
                    <CommandBar />
                </div>
            </div>
        </div>
    );
}
