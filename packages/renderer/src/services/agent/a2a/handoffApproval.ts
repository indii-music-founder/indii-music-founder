/**
 * Waiting on a user decision for an agent-to-agent handoff (Swarm Feed).
 *
 * The decision is tri-state: approved, rejected, or still pending. A rejection
 * must end the wait immediately (ISSUE-1628); previously "Request Revision"
 * wrote the same value the message started with and the router kept waiting
 * for the full five minutes.
 */
export interface HandoffApprovalState {
    approved?: boolean;
    rejected?: boolean;
}

export type HandoffDecision = 'approved' | 'rejected' | 'timeout' | 'cancelled';

export interface WaitForHandoffOptions {
    /** Poll interval. */
    pollMs?: number;
    /** Give up after this long. Matches the agent execution budget. */
    timeoutMs?: number;
    /** Stop waiting (e.g. the signed-in account changed). */
    isCancelled?: () => boolean;
}

export const HANDOFF_APPROVAL_TIMEOUT_MS = 5 * 60_000;

export async function waitForHandoffDecision(
    readState: () => HandoffApprovalState | undefined,
    { pollMs = 1000, timeoutMs = HANDOFF_APPROVAL_TIMEOUT_MS, isCancelled = () => false }: WaitForHandoffOptions = {},
): Promise<HandoffDecision> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (isCancelled()) return 'cancelled';
        const state = readState();
        if (state?.rejected) return 'rejected';
        if (state?.approved) return 'approved';
        if (Date.now() >= deadline) return 'timeout';
        await new Promise(resolve => setTimeout(resolve, pollMs));
    }
}

export function describeHandoffFailure(decision: Exclude<HandoffDecision, 'approved'>, from: string, to: string): string {
    switch (decision) {
        case 'rejected':
            return `Task handoff from ${from} to ${to} was rejected by the user (revision requested).`;
        case 'cancelled':
            return 'Authenticated account changed during agent handoff.';
        case 'timeout':
            return `Task handoff from ${from} to ${to} timed out waiting for approval.`;
    }
}
