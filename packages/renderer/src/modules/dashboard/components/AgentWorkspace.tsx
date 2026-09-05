import { AgentHeader } from './AgentHeader';
import { EmptyState } from './EmptyState';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { OperationalApprovalGateBanner } from './OperationalApprovalGateBanner';

/* ── Logic ── */
import { useAgentWorkspace } from '../hooks/useAgentWorkspace';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/core/store';

/* ================================================================== */
/*  Agent Workspace — Core Autonomous Orchestration Interface           */
/*                                                                      */
/*  Layout:                                                             */
/*    - AgentHeader: top status bar (online, uptime, model)            */
/*    - OperationalApprovalGateBanner: high-visibility approval gates  */
/*    - WorkspaceCanvas: the CENTER. Rich media output panel.          */
/*      Images being generated, documents, reports, charts, video      */
/*      previews, and any artifact Indii produces appear here.         */
/*      The chat/conversation lives in the floating ChatOverlay.       */
/*    - CommandBar: floats at bottom for input                         */
/* ================================================================== */

interface AgentWorkspaceProps {
    /**
     * ISSUE-1291: the artist's studio stats, composed into this room rather than
     * living behind a separate tab. Rendered inside the landing state, and again
     * beneath the canvas so the numbers stay reachable while the agent is working.
     */
    studioSlot?: React.ReactNode;
}

export default function AgentWorkspace({ studioSlot }: AgentWorkspaceProps = {}) {
    const {
        isAgentProcessing,
        uptime,
        setCommandInput,
        submitCommand,
    } = useAgentWorkspace();

    const { canvasItems, removeCanvasItem } = useStore(useShallow((s: StoreState) => ({
        canvasItems: s.canvasItems,
        removeCanvasItem: s.removeCanvasItem
    })));

    return (
        <div className="flex-1 flex flex-col h-full bg-grid-white/[0.02] relative overflow-hidden" data-testid="agent-workspace">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-dept-creative/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full translate-y-1/3 -translate-x-1/3 -z-10" />

            {/* Header */}
            <AgentHeader uptime={uptime} isProcessing={isAgentProcessing} />

            {/* Center: Canvas or Empty State */}
            <div className="flex-1 overflow-y-auto pb-32">
                {/* Prioritized Operational Flow: Approval gates are always visible when autonomous agents halt */}
                <OperationalApprovalGateBanner className="mx-auto w-full max-w-6xl px-4 pt-4 mb-2" />

                {canvasItems.length === 0 ? (
                    <EmptyState
                        onCommandClick={(cmd) => setCommandInput(cmd)}
                        onCommandSubmit={submitCommand}
                        studioSlot={studioSlot}
                        hideApprovalBanner={true}
                    />
                ) : (
                    <>
                        <WorkspaceCanvas
                            items={canvasItems}
                            onDismiss={(id) => removeCanvasItem(id)}
                        />
                        {/* ISSUE-1291: keep the studio numbers reachable while the agent
                            is producing output. Hiding them behind active canvas work
                            would recreate the same "useful thing you can't get to"
                            problem the tab merge exists to remove. */}
                        {studioSlot && (
                            <div className="mx-auto w-full max-w-7xl px-4 pt-10">
                                {studioSlot}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
