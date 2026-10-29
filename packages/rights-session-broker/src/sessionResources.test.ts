import { afterEach, describe, expect, it, vi } from 'vitest';
import { detachSessionSocket, SessionResources } from './sessionResources.js';

// Pure local resource bookkeeping. No database, account, or service state.
describe('session resource lifetime', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['client', 'worker'] as const)('releases both listeners when the last socket detaches (%s first)', first => {
    const events: string[] = [];
    const scope = new SessionResources(Date.now() + 60_000, () => events.push('remove'), error => { throw error; });
    scope.add(() => events.push('session listener'));
    scope.add(() => events.push('command listener'));
    const pair = { client: {}, worker: {}, stop: () => scope.stop() };
    const second = first === 'client' ? 'worker' : 'client';
    expect(detachSessionSocket(pair, first, pair[first])).toBe(true);
    expect(events).toEqual([]);
    expect(detachSessionSocket(pair, second, pair[second])).toBe(true);
    expect(events).toEqual(['remove', 'session listener', 'command listener']);
  });

  it('ignores a stale close event after a socket has been replaced', () => {
    const replaced = {};
    const current = {};
    let stopped = false;
    const pair = { client: current, stop: () => { stopped = true; } };
    expect(detachSessionSocket(pair, 'client', replaced)).toBe(false);
    expect(pair.client).toBe(current);
    expect(stopped).toBe(false);
  });

  it('releases every subscription once and removes the pair before cleanup', () => {
    const events: string[] = [];
    const errors: unknown[] = [];
    const scope = new SessionResources(Date.now() + 60_000, () => events.push('remove'), error => errors.push(error));
    scope.add(() => events.push('session listener'));
    scope.add(() => events.push('command listener'));
    scope.stop();
    scope.stop();
    expect(events).toEqual(['remove', 'session listener', 'command listener']);
    expect(errors).toEqual([]);
  });

  it('expires without a socket close or a final worker message', () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const scope = new SessionResources(Date.now() + 100, () => events.push('remove'), error => { throw error; });
    scope.add(() => events.push('unsubscribe'));
    vi.advanceTimersByTime(99);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual(['remove', 'unsubscribe']);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans a listener added after stop and cancels its expiry timer', () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const scope = new SessionResources(Date.now() + 100, () => events.push('remove'), error => { throw error; });
    scope.stop();
    scope.add(() => events.push('late listener'));
    vi.advanceTimersByTime(100);
    expect(events).toEqual(['remove', 'late listener']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports cleanup errors and still releases the remaining resources', () => {
    const events: string[] = [];
    const errors: unknown[] = [];
    const failure = new Error('Cleanup failed');
    const scope = new SessionResources(Date.now() + 60_000, () => events.push('remove'), error => errors.push(error));
    scope.add(() => { throw failure; });
    scope.add(() => events.push('remaining listener'));
    scope.stop();
    expect(events).toEqual(['remove', 'remaining listener']);
    expect(errors).toEqual([failure]);
  });

  it('rejects invalid deadlines instead of scheduling unbounded resources', () => {
    for (const deadline of [NaN, Infinity, 1.5]) {
      expect(() => new SessionResources(deadline, () => {}, () => {})).toThrow('Invalid session expiry');
    }
  });
});
