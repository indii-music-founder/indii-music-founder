import { describe, it, expect, vi, beforeEach } from 'vitest';

const { judgeInvoke, httpsCallableMock } = vi.hoisted(() => ({
  judgeInvoke: vi.fn(),
  httpsCallableMock: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock('@/services/firebase', () => ({
  functions: {},
}));

vi.mock('../truthOverclaimReporter', () => ({
  reportOverclaimIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

import { JevGuardrailService } from './JevGuardrailService';

describe('JevGuardrailService', () => {
  let service: JevGuardrailService;

  beforeEach(() => {
    vi.clearAllMocks();
    httpsCallableMock.mockReturnValue(judgeInvoke);
    service = new JevGuardrailService();
  });

  it('evaluates an actionable response without modification through the server proxy', async () => {
    const input = {
      text: 'I have analyzed your revenue. You have 3 pending payments totaling $1,250. Would you like me to process them now?',
      tool_calls: [{ name: 'get_revenue_analytics' }],
    };

    judgeInvoke.mockResolvedValue({
      data: {
        answers: {
          claims_disconnected_without_evidence: 0,
          claims_scheduled_without_tool: 0,
          confident_action_no_evidence: 0,
          is_actionable_response: 0.95,
        },
      },
    });

    const result = await service.screen(input);

    expect(result.text).toBe(input.text);
    expect(result.wasModified).toBe(false);
    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'typesafeJudge');
    expect(judgeInvoke).toHaveBeenCalledWith(expect.objectContaining({ model: 'jev-latest' }));
  });

  it('intercepts unactionable text with helpful fallback when evaluated', async () => {
    const input = {
      text: 'Here is your daily overview.',
    };

    judgeInvoke.mockResolvedValue({
      data: {
        answers: {
          claims_disconnected_without_evidence: 0,
          claims_scheduled_without_tool: 0,
          confident_action_no_evidence: 0,
          is_actionable_response: 0.1,
        },
      },
    });

    const result = await service.screen(input);

    expect(result.wasModified).toBe(true);
    expect(result.flags).toContain('unactionable_response');
    expect(result.text).toContain('Try asking me to schedule a post');
  });

  it('passes through the original response when the server-side Jev proxy is unavailable', async () => {
    const input = { text: 'Here is your daily overview.' };
    judgeInvoke.mockRejectedValue(new Error('Jev unavailable'));

    const result = await service.screen(input);

    expect(result).toEqual({
      text: input.text,
      wasModified: false,
      flags: [],
      confidence: {},
    });
  });

  it('fires the readiness-overclaim flag and auto-files the truthfulness critique (issue #317)', async () => {
    const { reportOverclaimIfNeeded } = await import('../truthOverclaimReporter');
    const input = {
      text: 'All 23 departments are fully implemented, verified, and operational in production.',
    };

    judgeInvoke.mockResolvedValue({
      data: {
        answers: {
          claims_disconnected_without_evidence: 0,
          claims_scheduled_without_tool: 0,
          confident_action_no_evidence: 0,
          claims_verified_readiness_without_evidence: 0.92,
          is_actionable_response: 0.9,
        },
      },
    });

    const result = await service.screen(input);

    expect(result.wasModified).toBe(true);
    expect(result.flags).toContain('claims_verified_readiness_without_evidence');
    expect(result.confidence['claims_verified_readiness_without_evidence']).toBeCloseTo(0.92);
    expect(result.text).toContain('To be precise about current capabilities');
    // Auto-file happens fire-and-forget; give the microtask queue a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reportOverclaimIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
      source: 'jev_guardrail',
      signal: 'claims_verified_readiness_without_evidence',
    }));
  });
});
