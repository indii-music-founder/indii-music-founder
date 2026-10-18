import { z } from 'zod';
import { RIGHTS_LIMITS, type FilingState } from './contracts.js';

export const RIGHTS_RECOVERY = Object.freeze({ dispatchGraceMs: 5 * 60_000, heartbeatGraceMs: 90_000 });
export type RightsStopReason = 'session_expired' | 'idle_expired' | 'worker_lost' | 'launch_unconfirmed';
export interface RightsLifecycleSession {
  state: string;
  createdAtMs: number;
  expiresAtMs: number;
  lastActivityAtMs: number;
  workerHeartbeatAtMs?: number;
}
export const isRightsSessionClosed = (state: string): boolean => ['ended', 'failed', 'termination_pending'].includes(state);

/** Timeouts revoke capabilities; they do not prove that a remote process stopped. */
export function rightsSessionStopReason(session: RightsLifecycleSession, now: number): RightsStopReason | undefined {
  if (['ended', 'failed'].includes(session.state)) return undefined;
  if (now >= session.expiresAtMs) return 'session_expired';
  if (['queued', 'starting', 'dispatch_unknown'].includes(session.state)) {
    return now - session.createdAtMs >= RIGHTS_RECOVERY.dispatchGraceMs ? 'launch_unconfirmed' : undefined;
  }
  if (now - session.lastActivityAtMs >= RIGHTS_LIMITS.idleMs) return 'idle_expired';
  if (now - (session.workerHeartbeatAtMs ?? session.createdAtMs) >= RIGHTS_RECOVERY.heartbeatGraceMs) return 'worker_lost';
  return undefined;
}

/** Ending a browser is never evidence that an external application was submitted. */
export function filingStateAfterBrowserLoss(state: FilingState): FilingState {
  return state === 'in_progress' ? 'outcome_unknown' : state;
}

/** Capacity remains reserved until worker shutdown or the cloud execution is confirmed terminal. */
export function mayReleaseRightsCapacity(proof: 'worker_closed' | 'execution_completed' | 'timeout' | 'cancel_requested' | 'dispatch_error'): boolean {
  return proof === 'worker_closed' || proof === 'execution_completed';
}

/** A Cloud Run execution name alone is not a process identity: task retries reuse it. */
export const RightsBrowserExecutionSchema = z.object({
  executionId: z.string().uuid(), cloudExecutionId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/), taskAttempt: z.literal(0),
}).strict();
export type RightsBrowserExecution = z.infer<typeof RightsBrowserExecutionSchema>;
export function mayClaimRightsBrowserExecution(previous: { executionId?: string; cloudExecutionId?: string }, candidate: RightsBrowserExecution): boolean {
  return !previous.executionId || (previous.executionId === candidate.executionId && previous.cloudExecutionId === candidate.cloudExecutionId);
}
