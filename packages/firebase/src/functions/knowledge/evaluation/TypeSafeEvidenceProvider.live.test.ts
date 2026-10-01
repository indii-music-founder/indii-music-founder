import { describe, expect, it } from 'vitest';
import { EVIDENCE_EVALUATION_FIXTURES } from '../evidenceEvaluationFixtures';
import {
  EVIDENCE_SHADOW_THRESHOLDS,
  PROVISIONAL_TYPESAFE_SHADOW_THRESHOLD,
  evaluateEvidenceThresholdSweep,
} from '../evidenceJudgment';
import {
  TypeSafeEvidenceProvider,
  type TypeSafeEvidenceTelemetryEvent,
} from './TypeSafeEvidenceProvider';

const runLive = process.env.RUN_TYPESAFE_EVIDENCE_EVAL === '1';
const describeLive = runLive ? describe : describe.skip;

// External-provider evaluation over literal inputs; structural-only, never customer-path evidence.
describeLive('TypeSafe evidence evaluation — synthetic inputs (structural-only)', () => {
  it('evaluates every fixture without production or customer data', async () => {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('RUN_TYPESAFE_EVIDENCE_EVAL=1 requires TYPESAFE_API_KEY.');
    }

    const telemetryEvents: Array<TypeSafeEvidenceTelemetryEvent & { fixtureId: string }> = [];
    let activeFixtureId = 'unassigned';
    const provider = new TypeSafeEvidenceProvider({
      apiKey,
      telemetryMode: 'shadow',
      feature: 'knowledge_evidence_rerank_evaluation',
      telemetry: event => { telemetryEvents.push({ fixtureId: activeFixtureId, ...event }); },
    });
    const results = [];

    for (const fixture of EVIDENCE_EVALUATION_FIXTURES) {
      activeFixtureId = fixture.id;
      const judgments = await provider.judgeRelevance({
        query: fixture.query,
        candidates: fixture.candidates,
      });
      const thresholdResults = evaluateEvidenceThresholdSweep(fixture, judgments);
      results.push({ fixture, judgments, thresholdResults });
    }

    expect(results).toHaveLength(EVIDENCE_EVALUATION_FIXTURES.length);
    expect(telemetryEvents).toHaveLength(EVIDENCE_EVALUATION_FIXTURES.length);
    for (const { thresholdResults } of results) {
      expect(thresholdResults.map(result => result.minimumRelevance)).toEqual(EVIDENCE_SHADOW_THRESHOLDS);
      for (const result of thresholdResults) {
        expect(result.precisionAtK).toBeGreaterThanOrEqual(0);
        expect(result.precisionAtK).toBeLessThanOrEqual(1);
        expect(result.recallAtK).toBeGreaterThanOrEqual(0);
        expect(result.recallAtK).toBeLessThanOrEqual(1);
        expect(result.reciprocalRank).toBeGreaterThanOrEqual(0);
        expect(result.reciprocalRank).toBeLessThanOrEqual(1);
        expect(result.candidateFalsePositiveRate).toBeGreaterThanOrEqual(0);
        expect(result.candidateFalsePositiveRate).toBeLessThanOrEqual(1);
        expect(result.candidateFalseNegativeRate).toBeGreaterThanOrEqual(0);
        expect(result.candidateFalseNegativeRate).toBeLessThanOrEqual(1);
      }
    }

    // Synthetic IDs, score distributions, metrics, and telemetry only. Never print candidate text.
    const summary = {
      provisionalShadowThreshold: PROVISIONAL_TYPESAFE_SHADOW_THRESHOLD,
      fixtures: results.map(({ fixture, judgments, thresholdResults }) => ({
        fixtureId: fixture.id,
        family: fixture.family,
        scores: Object.fromEntries(judgments.map(judgment => [judgment.candidateId, judgment.relevance])),
        thresholds: thresholdResults.map(result => ({
          minimumRelevance: result.minimumRelevance,
          precisionAtK: result.precisionAtK,
          recallAtK: result.recallAtK,
          reciprocalRank: result.reciprocalRank,
          noAnswerFalsePositive: result.noAnswerFalsePositive,
          candidateFalsePositiveRate: result.candidateFalsePositiveRate,
          candidateFalseNegativeRate: result.candidateFalseNegativeRate,
        })),
      })),
      telemetry: {
        calls: telemetryEvents.length,
        totalDurationMs: telemetryEvents.reduce((sum, event) => sum + event.durationMs, 0),
        totalInputTokens: telemetryEvents.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0),
        totalOutputTokens: telemetryEvents.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0),
        fixtures: telemetryEvents.map(event => ({
          fixtureId: event.fixtureId,
          status: event.status,
          durationMs: event.durationMs,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
        })),
      },
    };
    console.info('[TypeSafeEvidenceEvaluation]', JSON.stringify(summary));
  }, 60_000);
});
