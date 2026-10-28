import { describe, expect, it } from 'vitest';
import { HostedRightsConnectionLifecycle } from './HostedRightsConnectionLifecycle';

// Pure local transport transitions; no broker, ticket, account, or portal doubles.
describe('hosted rights transport lifecycle', () => {
  it('allows only one pending connection attempt', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const first = lifecycle.begin()!;
    expect(lifecycle.isCurrent(first)).toBe(true);
    expect(lifecycle.begin()).toBeUndefined();
  });
  it('does not open a second connection while one is connected', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const first = lifecycle.begin()!;
    expect(lifecycle.connected(first)).toBe(true);
    expect(lifecycle.connected(first)).toBe(false);
    expect(lifecycle.begin()).toBeUndefined();
  });
  it('invalidates a ticket result arriving after close', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const pending = lifecycle.begin()!;
    lifecycle.close();
    expect(lifecycle.isCurrent(pending)).toBe(false);
    expect(lifecycle.connected(pending)).toBe(false);
    expect(lifecycle.disconnected(pending)).toBe(false);
    expect(lifecycle.begin()).toBeUndefined();
  });
  it('revokes callbacks immediately on disconnect, before reconnect begins', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const first = lifecycle.begin()!;
    lifecycle.connected(first);
    expect(lifecycle.disconnected(first)).toBe(true);
    expect(lifecycle.isCurrent(first)).toBe(false);
    expect(lifecycle.canRetry(first)).toBe(true);
    expect(lifecycle.isConnected).toBe(false);
    expect(lifecycle.disconnected(first)).toBe(false);
    expect(lifecycle.connected(first)).toBe(false);
  });
  it('prevents a superseded socket from changing the replacement connection', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const first = lifecycle.begin()!;
    lifecycle.connected(first);
    lifecycle.disconnected(first);
    const replacement = lifecycle.begin()!;
    expect(replacement).not.toBe(first);
    expect(lifecycle.connected(replacement)).toBe(true);
    expect(lifecycle.isCurrent(first)).toBe(false);
    expect(lifecycle.disconnected(first)).toBe(false);
    expect(lifecycle.connected(first)).toBe(false);
    expect(lifecycle.isCurrent(replacement)).toBe(true);
    expect(lifecycle.canRetry(first)).toBe(false);
    expect(lifecycle.canRetry(replacement)).toBe(false);
    expect(lifecycle.isConnected).toBe(true);
  });
  it('makes close terminal even during the reconnect wait', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const first = lifecycle.begin()!;
    lifecycle.disconnected(first);
    lifecycle.close();
    lifecycle.close();
    expect(lifecycle.canRetry(first)).toBe(false);
    expect(lifecycle.isConnected).toBe(false);
    expect(lifecycle.begin()).toBeUndefined();
  });
  it('permits explicit retry after acquisition failure without reviving the failed attempt', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const failed = lifecycle.begin()!;
    lifecycle.disconnected(failed);
    const retry = lifecycle.begin()!;
    expect(lifecycle.connected(failed)).toBe(false);
    expect(lifecycle.connected(retry)).toBe(true);
  });
  it('rejects unrelated transition identities', () => {
    const lifecycle = new HostedRightsConnectionLifecycle();
    const current = lifecycle.begin()!;
    expect(lifecycle.connected(current + 1)).toBe(false);
    expect(lifecycle.disconnected(current + 1)).toBe(false);
    expect(lifecycle.isCurrent(current)).toBe(true);
  });
});
