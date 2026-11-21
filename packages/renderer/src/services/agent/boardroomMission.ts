import { useStore } from '@/core/store';
import type { A2AMessage } from '@/core/store/slices/boardroomSlice';

export interface StopBoardroomMissionResult {
    /** An agent run was in flight and has been aborted. */
    stoppedRun: boolean;
    /** Handoffs that were waiting for approval and are now rejected. */
    cancelledApprovals: number;
}

/**
 * The one Boardroom "Stop mission" action (spec W4/D2). It aborts the running
 * agent, rejects every handoff still waiting for approval so the router stops
 * waiting, and revokes any browser control a specialist holds. Both the Live
 * Feed and the hosted browser call this, so Stop means the same thing everywhere.
 */
export function stopBoardroomMission(): StopBoardroomMissionResult {
    const state = useStore.getState();
    const stoppedRun = Boolean(state.agentAbortController);
    state.stopAgent();

    let cancelledApprovals = 0;
    const a2aMessages = (state.a2aMessages ?? []).map((message: A2AMessage) => {
        if (!message.requiresApproval || message.approved || message.rejected) return message;
        cancelledApprovals++;
        return { ...message, approved: false, rejected: true };
    });

    useStore.setState({
        a2aMessages,
        boardroomControlRevocation: (state.boardroomControlRevocation ?? 0) + 1,
    });
    return { stoppedRun, cancelledApprovals };
}
