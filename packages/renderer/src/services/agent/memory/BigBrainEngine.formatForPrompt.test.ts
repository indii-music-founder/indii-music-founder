/**
 * BigBrainEngine.formatForPrompt — the cross-pollination injection point.
 *
 * This is the literal seam where captured facts/preferences become an agent's
 * prompt context. If a preference like "favorite color: puke green" lives in the
 * authoritative vault, formatForPrompt must emit it inside <authoritative_facts>
 * so every downstream agent sees it. These tests guard that seam (the APPLY stage
 * of the continuity chains, at the code level).
 */

import { describe, it, expect } from 'vitest';
import { bigBrainEngine, type BigBrainContext } from './BigBrainEngine';

const emptyMeta: BigBrainContext['meta'] = {
  vaultFactCount: 0,
  episodicMatches: 0,
  alignmentRuleCount: 0,
} as BigBrainContext['meta'];

function ctx(overrides: Partial<BigBrainContext>): BigBrainContext {
  return {
    dailyLog: '',
    vaultFacts: '',
    episodicRecall: '',
    alignmentRules: [],
    totalCharacters: 0,
    meta: emptyMeta,
    ...overrides,
  } as BigBrainContext;
}

describe('BigBrainEngine.formatForPrompt', () => {
  it('emits an authoritative_facts block carrying a captured preference', () => {
    const out = bigBrainEngine.formatForPrompt(
      ctx({ vaultFacts: 'Artist favorite color: puke green' }),
    );
    expect(out).toContain('<auto_recall>');
    expect(out).toContain('<authoritative_facts>');
    expect(out).toContain('puke green');
    expect(out).toContain('</authoritative_facts>');
  });

  it('returns an empty string when no memory is present (no noise in prompt)', () => {
    expect(bigBrainEngine.formatForPrompt(ctx({}))).toBe('');
  });

  it('wraps every present section and only present sections', () => {
    const out = bigBrainEngine.formatForPrompt(
      ctx({ dailyLog: 'today: studio session', vaultFacts: 'genre: detroit techno' }),
    );
    expect(out).toContain('<daily_context>');
    expect(out).toContain('today: studio session');
    expect(out).toContain('<authoritative_facts>');
    expect(out).toContain('genre: detroit techno');
    // episodicRecall was empty → its section must be absent.
    expect(out).not.toContain('<cross_session_recall>');
  });

  it('includes cross-session recall when populated', () => {
    const out = bigBrainEngine.formatForPrompt(
      ctx({ episodicRecall: '- last release was an EP' }),
    );
    expect(out).toContain('<cross_session_recall>');
    expect(out).toContain('last release was an EP');
  });

  it('keeps the whole block inside a single auto_recall wrapper', () => {
    const out = bigBrainEngine.formatForPrompt(
      ctx({ dailyLog: 'a', vaultFacts: 'b', episodicRecall: 'c' }),
    );
    expect(out.match(/<auto_recall>/g)).toHaveLength(1);
    expect(out.startsWith('<auto_recall>')).toBe(true);
    expect(out.trim().endsWith('</auto_recall>')).toBe(true);
  });
});
