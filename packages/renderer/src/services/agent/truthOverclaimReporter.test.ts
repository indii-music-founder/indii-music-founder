import { describe, it, expect, vi, beforeEach } from 'vitest';

const { judgeInvoke, httpsCallableMock, toastMock } = vi.hoisted(() => ({
  judgeInvoke: vi.fn(),
  httpsCallableMock: vi.fn(),
  toastMock: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock('@/services/firebase', () => ({
  functions: {},
}));

vi.mock('@/core/context/ToastContext', () => ({
  toast: toastMock,
}));

import {
  isOverclaimCooldownActive,
  reportOverclaimIfNeeded,
  resetOverclaimCooldownForTests,
} from './truthOverclaimReporter';

describe('truthOverclaimReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOverclaimCooldownForTests();
    httpsCallableMock.mockReturnValue(judgeInvoke);
  });

  it('files an overclaim report through reportBugFn and returns the issue URL', async () => {
    judgeInvoke.mockResolvedValue({
      data: { github: 'ok', issueUrl: 'https://github.com/indii-music-founder/indii-music-founder/issues/320' },
    });

    const url = await reportOverclaimIfNeeded({
      snippet: 'All 23 departments are fully implemented and verified.',
      source: 'deterministic',
      signal: 'all-departments-verified',
      agentId: 'generalist',
    });

    expect(url).toBe('https://github.com/indii-music-founder/indii-music-founder/issues/320');
    expect(judgeInvoke).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Boardroom status response overclaims capability truth',
      module: 'boardroom',
      severity: 'major',
    }));
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it('does not re-report the same signature inside the cooldown window', async () => {
    judgeInvoke.mockResolvedValue({ data: { github: 'ok', issueUrl: 'https://x/issues/1' } });

    const input = {
      snippet: 'Everything is implemented and production ready.',
      source: 'deterministic' as const,
    };

    await reportOverclaimIfNeeded(input);
    const second = await reportOverclaimIfNeeded(input);

    expect(judgeInvoke).toHaveBeenCalledTimes(1);
    expect(second).toBeUndefined();
    expect(isOverclaimCooldownActive(`deterministic:${input.snippet.toLowerCase()}`)).toBe(true);
  });

  it('warns visibly when GitHub sync fails after a structured response', async () => {
    judgeInvoke.mockResolvedValue({ data: { github: 'skipped', message: 'token missing' } });

    const url = await reportOverclaimIfNeeded({ snippet: 'All systems verified.', source: 'jev_guardrail' });

    expect(url).toBeUndefined();
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('GitHub sync failed'));
  });

  it('swallows pipeline errors and warns instead of throwing', async () => {
    judgeInvoke.mockRejectedValue(new Error('failed-precondition: function unreachable'));

    const url = await reportOverclaimIfNeeded({ snippet: 'No engineering work remaining.', source: 'deterministic' });

    expect(url).toBeUndefined();
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('pipeline is unreachable'));
  });
});
