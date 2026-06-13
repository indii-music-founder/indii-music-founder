/**
 * RemoteRelayService — heartbeat & timestamp helpers.
 *
 * These pure helpers decide whether the phone treats the desktop as "live."
 * If freshness logic is wrong, the remote either drives a disconnected desktop
 * (commands silently lost) or refuses to send to a healthy one — so they are
 * worth pinning precisely. Firebase is mocked globally in src/test/setup.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  relayTimestampToMillis,
  isFreshDesktopState,
  DESKTOP_HEARTBEAT_STALE_MS,
  type DesktopState,
} from './RemoteRelayService';

describe('relayTimestampToMillis', () => {
  it('passes through a numeric epoch', () => {
    expect(relayTimestampToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('returns 0 for nullish/unresolved timestamps', () => {
    expect(relayTimestampToMillis(undefined)).toBe(0);
    expect(relayTimestampToMillis(null as unknown as undefined)).toBe(0);
  });

  it('reads a Firestore-style { toMillis } object', () => {
    const ts = { toMillis: () => 4242 } as unknown as Parameters<typeof relayTimestampToMillis>[0];
    expect(relayTimestampToMillis(ts)).toBe(4242);
  });

  it('returns 0 for an unresolved serverTimestamp sentinel (no toMillis)', () => {
    const sentinel = {} as unknown as Parameters<typeof relayTimestampToMillis>[0];
    expect(relayTimestampToMillis(sentinel)).toBe(0);
  });
});

describe('isFreshDesktopState', () => {
  const stateAt = (online: boolean, ageMs: number, now: number): DesktopState =>
    ({
      currentModule: 'dashboard',
      isAgentProcessing: false,
      activeSessionId: 's1',
      online,
      timestamp: { toMillis: () => now - ageMs } as DesktopState['timestamp'],
    }) as DesktopState;

  it('is fresh when online and within the heartbeat window', () => {
    const now = 1_700_000_000_000;
    expect(isFreshDesktopState(stateAt(true, 1_000, now), now)).toBe(true);
  });

  it('is stale when the heartbeat is older than the window (including skew tolerance)', () => {
    const now = 1_700_000_000_000;
    // 60000ms is the CLOCK_SKEW_TOLERANCE_MS added in RemoteRelayService
    expect(isFreshDesktopState(stateAt(true, DESKTOP_HEARTBEAT_STALE_MS + 60000 + 1, now), now)).toBe(false);
  });

  it('is exactly at the boundary inclusive', () => {
    const now = 1_700_000_000_000;
    expect(isFreshDesktopState(stateAt(true, DESKTOP_HEARTBEAT_STALE_MS + 60000, now), now)).toBe(true);
  });

  it('is never fresh when offline, regardless of recency', () => {
    const now = 1_700_000_000_000;
    expect(isFreshDesktopState(stateAt(false, 0, now), now)).toBe(false);
  });

  it('is not fresh for null/undefined state', () => {
    expect(isFreshDesktopState(null)).toBe(false);
    expect(isFreshDesktopState(undefined)).toBe(false);
  });

  it('is not fresh when timestamp is missing/unresolved', () => {
    const now = 1_700_000_000_000;
    const noTs = { online: true } as unknown as DesktopState;
    expect(isFreshDesktopState(noTs, now)).toBe(false);
  });
});
