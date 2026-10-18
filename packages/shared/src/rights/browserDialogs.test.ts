import { describe, expect, it } from 'vitest';
import { RightsBrowserDialogSchema, SessionInputSchema, acceptHumanInput, type RightsSessionFence } from './contracts.js';

const fence: RightsSessionFence = { sessionId: 'session-1', control: 'human', controlGeneration: 4, navigationGeneration: 2, viewportVersion: 1, lastSequence: 7 };
const response = { sessionId: 'session-1', controlGeneration: 4, navigationGeneration: 2, viewportVersion: 1, sequence: 8, event: { type: 'dialog' as const, requestId: 'notice-1', accept: true } };
describe('artist-controlled browser dialog wire contract', () => {
  it('allows a bounded explicit artist answer on the current input fence', () => {
    const input = SessionInputSchema.parse(response);
    expect(acceptHumanInput(fence, input)).toBe(true);
    expect(RightsBrowserDialogSchema.parse({ type: 'browser_dialog', requestId: 'notice-1', kind: 'alert', message: 'Official access notice' }).kind).toBe('alert');
  });
  it('rejects cross-session, stale, replayed and agent-controlled answers', () => {
    const input = SessionInputSchema.parse(response);
    for (const state of [{ ...fence, sessionId: 'another' }, { ...fence, control: 'agent' as const }, { ...fence, control: 'none' as const }, { ...fence, navigationGeneration: 3 }, { ...fence, controlGeneration: 5 }, { ...fence, lastSequence: 8 }]) expect(acceptHumanInput(state, input)).toBe(false);
  });
  it('rejects arbitrary executable fields, unbounded prompt values and unknown dialog types', () => {
    expect(SessionInputSchema.safeParse({ ...response, event: { ...response.event, javascript: 'arbitrary code' } }).success).toBe(false);
    expect(SessionInputSchema.safeParse({ ...response, event: { ...response.event, text: 'x'.repeat(501) } }).success).toBe(false);
    expect(RightsBrowserDialogSchema.safeParse({ type: 'browser_dialog', requestId: 'notice-1', kind: 'custom_script', message: 'notice' }).success).toBe(false);
  });
});
