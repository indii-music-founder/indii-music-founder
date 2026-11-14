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

import { JevGuardrailService, parseGuardrailProbability, projectGuardrailToolEvidence } from './JevGuardrailService';

describe('guardrail probability contract (pure parser)', () => {
  it.each([0, 0.3, 0.5, 0.7, 1])('preserves valid probability %s in both supported shapes', probability => {
    expect(parseGuardrailProbability(probability)).toBe(probability);
    expect(parseGuardrailProbability({ noul: probability })).toBe(probability);
  });

  it.each([null, undefined, true, false, '0.9', NaN, Infinity, -0.1, 1.1])('abstains on invalid probability %s', probability => {
    expect(parseGuardrailProbability(probability)).toBeNull();
    expect(parseGuardrailProbability({ noul: probability })).toBeNull();
  });

  it('rejects arrays, unrelated answer fields and missing values', () => {
    expect(parseGuardrailProbability([])).toBeNull();
    expect(parseGuardrailProbability({ score: 1 })).toBeNull();
    expect(parseGuardrailProbability({})).toBeNull();
  });
});

describe('guardrail tool evidence (structural projection)', () => {
  it('keeps unknown outcomes unconfirmed and retains bounded receipt fields', () => {
    expect(projectGuardrailToolEvidence([
      { name: 'legacy', result: 'Success' },
      { name: 'connectivity', result: { success: true, data: { connected: false, url: 'https://example.com/receipt', imageBase64: 'private-image' } } },
      { name: 'missing' },
    ])).toEqual([
      { name: 'legacy', reportedSuccess: null, message: 'Success' },
      { name: 'connectivity', reportedSuccess: true, details: { connected: false, url: 'https://example.com/receipt' } },
      { name: 'missing', reportedSuccess: null },
    ]);
  });

  it('bounds receipt count and message length while preserving input', () => {
    const calls = Array.from({ length: 25 }, (_, index) => ({ name: `tool-${index}`, result: { success: false, error: 'x'.repeat(1000) } }));
    const projected = projectGuardrailToolEvidence(calls);
    expect(projected).toHaveLength(20);
    expect(projected[0]?.name).toBe('tool-5');
    expect((projected[0]?.error as string).length).toBe(400);
    expect(calls[0]?.result.error.length).toBe(1000);
  });
});

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

  it('passes failed tool outcomes to the judgment instead of only the attempted name (structural)', async () => {
    judgeInvoke.mockResolvedValue({ data: { answers: {} } });
    await service.screen({ text: 'The bug report was filed.', tool_calls: [{
      name: 'report_bug', result: { success: false, status: 'PAUSED', error: 'Approval required' },
    }] });
    expect(judgeInvoke.mock.calls[0]?.[0]?.state.response.tool_results).toEqual([{
      name: 'report_bug', reportedSuccess: false, status: 'PAUSED', error: 'Approval required',
    }]);
  });

  it('replaces a flagged completion claim rather than retaining it behind a caution', async () => {
    judgeInvoke.mockResolvedValue({ data: { answers: { confident_action_no_evidence: 0.95 } } });
    const result = await service.screen({ text: 'Your post was successfully published.' });
    expect(result.text).not.toContain('successfully published');
    expect(result.text).toContain('cannot confirm');
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
    expect(result.text).toContain('A current check or receipt is needed');
    expect(result.text).not.toContain(input.text);
    // Auto-file happens fire-and-forget; give the microtask queue a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reportOverclaimIfNeeded).toHaveBeenCalledWith(expect.objectContaining({
      source: 'jev_guardrail',
      signal: 'claims_verified_readiness_without_evidence',
    }));
  });

  it('does not repeat an unverified mobile pairing claim to the user', async () => {
    const input = {
      text: 'Your iPhone is successfully paired and two-way communication is functional.',
    };
    judgeInvoke.mockResolvedValue({
      data: {
        answers: {
          claims_verified_readiness_without_evidence: 0.91,
          is_actionable_response: 0.9,
        },
      },
    });

    const result = await service.screen(input);

    expect(result.flags).toContain('claims_verified_readiness_without_evidence');
    expect(result.text).toContain('cannot verify');
    expect(result.text).not.toContain('successfully paired');
    expect(result.text).not.toContain('two-way communication is functional');
  });

  it('preserves specialist tool-error explanations instead of replacing with social-media fallback', async () => {
    const input = {
      text: 'I could not create the product mockup because the asset URL failed to fetch.',
      tool_calls: [
        { name: 'create_product_mockup', result: { success: false, error: 'Failed to fetch asset image' } },
      ],
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

    expect(result.flags).not.toContain('unactionable_response');
    expect(result.text).toBe(input.text);
    expect(result.text).not.toContain('schedule a post');
  });
});
