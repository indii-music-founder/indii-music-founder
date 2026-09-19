import { describe, expect, it } from 'vitest';
import { EVIDENCE_EVALUATION_FIXTURES } from '../evidenceEvaluationFixtures';
import { evaluateEvidenceProvider } from '../evidenceJudgment';
import { TypeSafeEvidenceProvider } from './TypeSafeEvidenceProvider';

const runLive = process.env.RUN_TYPESAFE_EVIDENCE_EVAL === '1';
const describeLive = runLive ? describe : describe.skip;

describeLive('TypeSafe evidence evaluation — live synthetic fixtures', () => {
  it('evaluates every fixture without production or customer data', async () => {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('RUN_TYPESAFE_EVIDENCE_EVAL=1 requires TYPESAFE_API_KEY.');
    }

    const provider = new TypeSafeEvidenceProvider({ apiKey });
    const results = [];

    for (const fixture of EVIDENCE_EVALUATION_FIXTURES) {
      results.push(await evaluateEvidenceProvider(provider, fixture, 0.5));
    }

    expect(results).toHaveLength(EVIDENCE_EVALUATION_FIXTURES.length);
    for (const result of results) {
      expect(result.precisionAtK).toBeGreaterThanOrEqual(0);
      expect(result.precisionAtK).toBeLessThanOrEqual(1);
      expect(result.recallAtK).toBeGreaterThanOrEqual(0);
      expect(result.recallAtK).toBeLessThanOrEqual(1);
      expect(result.reciprocalRank).toBeGreaterThanOrEqual(0);
      expect(result.reciprocalRank).toBeLessThanOrEqual(1);
    }

    // Synthetic fixture IDs and aggregate metrics only. Never print candidate text.
    const summary = results.map(result => ({
      fixtureId: result.fixtureId,
      precisionAtK: result.precisionAtK,
      recallAtK: result.recallAtK,
      reciprocalRank: result.reciprocalRank,
      noAnswerFalsePositive: result.noAnswerFalsePositive,
    }));
    console.info('[TypeSafeEvidenceEvaluation]', JSON.stringify(summary));
  }, 30_000);
});
