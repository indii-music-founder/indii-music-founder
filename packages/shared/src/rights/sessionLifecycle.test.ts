import { describe, expect, it } from 'vitest';
import { RIGHTS_LIMITS } from './contracts.js';
import { filingStateAfterBrowserLoss, isRightsSessionClosed, mayReleaseRightsCapacity, rightsSessionStopReason, RIGHTS_RECOVERY, RightsBrowserExecutionSchema, mayClaimRightsBrowserExecution } from './sessionLifecycle.js';

const now = 10_000_000;
const connected = { state: 'connected', createdAtMs: now - 60_000, expiresAtMs: now + 60_000, lastActivityAtMs: now, workerHeartbeatAtMs: now };
describe('rights browser recovery decisions', () => {
  it('keeps a healthy active session running', () => expect(rightsSessionStopReason(connected, now)).toBeUndefined());
  it('enforces the absolute deadline even with recent activity', () => expect(rightsSessionStopReason({ ...connected, expiresAtMs: now }, now)).toBe('session_expired'));
  it('distinguishes heartbeat health from artist inactivity', () => expect(rightsSessionStopReason({ ...connected, lastActivityAtMs: now - RIGHTS_LIMITS.idleMs }, now)).toBe('idle_expired'));
  it('fences a lost worker after a bounded reconnect grace', () => expect(rightsSessionStopReason({ ...connected, state: 'reconnecting', workerHeartbeatAtMs: now - RIGHTS_RECOVERY.heartbeatGraceMs }, now)).toBe('worker_lost'));
  it('allows startup time but never silently retries an ambiguous launch', () => {
    expect(rightsSessionStopReason({ ...connected, state: 'dispatch_unknown' }, now)).toBeUndefined();
    expect(rightsSessionStopReason({ ...connected, state: 'dispatch_unknown', createdAtMs: now - RIGHTS_RECOVERY.dispatchGraceMs }, now)).toBe('launch_unconfirmed');
  });
  it('does not reopen terminal sessions', () => {
    for (const state of ['ended', 'failed']) expect(rightsSessionStopReason({ ...connected, state, expiresAtMs: 0 }, now)).toBeUndefined();
    expect(isRightsSessionClosed('termination_pending')).toBe(true);
    expect(isRightsSessionClosed('reconnecting')).toBe(false);
  });
  it('preserves official outcomes while recording uncertain in-progress filings', () => {
    expect(filingStateAfterBrowserLoss('in_progress')).toBe('outcome_unknown');
    for (const state of ['submitted', 'accepted', 'registered', 'rejected', 'ready'] as const) expect(filingStateAfterBrowserLoss(state)).toBe(state);
  });
  it('never frees capacity merely because a stop was requested or dispatch failed', () => {
    for (const proof of ['timeout', 'cancel_requested', 'dispatch_error'] as const) expect(mayReleaseRightsCapacity(proof)).toBe(false);
    expect(mayReleaseRightsCapacity('worker_closed')).toBe(true);
    expect(mayReleaseRightsCapacity('execution_completed')).toBe(true);
  });
});

describe('browser process execution claims', () => {
  const first = RightsBrowserExecutionSchema.parse({ executionId: 'd740c869-80a1-4863-b9b7-235ae5592ef8', cloudExecutionId: 'rights-worker-a1b2c', taskAttempt: 0 });
  it('permits the initial process and reconnection to that exact process', () => {
    expect(mayClaimRightsBrowserExecution({}, first)).toBe(true);
    expect(mayClaimRightsBrowserExecution(first, first)).toBe(true);
  });
  it('rejects a replacement process even within the same Cloud Run execution', () => {
    expect(mayClaimRightsBrowserExecution(first, { ...first, executionId: 'c4eff8bc-0b65-49dc-adde-4a93d2e3ddaa' })).toBe(false);
    expect(mayClaimRightsBrowserExecution(first, { ...first, cloudExecutionId: 'another-job' })).toBe(false);
  });
  it('rejects automatic retry attempts and missing runtime execution identity', () => {
    expect(RightsBrowserExecutionSchema.safeParse({ ...first, taskAttempt: 1 }).success).toBe(false);
    expect(RightsBrowserExecutionSchema.safeParse({ ...first, cloudExecutionId: undefined }).success).toBe(false);
  });
});
