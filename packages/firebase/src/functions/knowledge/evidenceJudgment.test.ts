import { describe, expect, it } from 'vitest';
import {
  VectorScoreEvidenceProvider,
  EVIDENCE_SHADOW_THRESHOLDS,
  PROVISIONAL_TYPESAFE_SHADOW_THRESHOLD,
  evaluateEvidenceJudgments,
  evaluateEvidenceProvider,
  evaluateEvidenceThresholdSweep,
  cosineSimilarityRelevance,
  type EvidenceFixtureFamily,
} from './evidenceJudgment';
import { EVIDENCE_EVALUATION_FIXTURES } from './evidenceEvaluationFixtures';

const REQUIRED_FAMILIES: EvidenceFixtureFamily[] = [
  'direct-evidence',
  'lexical-trap',
  'paraphrase',
  'no-answer',
  'conflicting-evidence',
  'multi-source',
  'partial-evidence',
  'provenance-conflict',
  'stale-evidence',
  'ambiguous-query',
];

describe('evidence judgment proof-of-concept harness', () => {
  it('computes bounded cosine relevance from query and candidate embeddings', () => {
    expect(cosineSimilarityRelevance([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarityRelevance([1, 0], [0.6, 0.8])).toBeCloseTo(0.6);
    expect(cosineSimilarityRelevance([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarityRelevance([1, 0], [-1, 0])).toBe(0);
    expect(cosineSimilarityRelevance([1, 0], [1])).toBeNull();
    expect(cosineSimilarityRelevance([0, 0], [1, 0])).toBeNull();
  });

  it('covers every required fixture family with valid expected IDs', () => {
    expect(new Set(EVIDENCE_EVALUATION_FIXTURES.map(fixture => fixture.family))).toEqual(new Set(REQUIRED_FAMILIES));

    for (const fixture of EVIDENCE_EVALUATION_FIXTURES) {
      const candidateIds = new Set(fixture.candidates.map(candidate => candidate.id));
      expect(candidateIds.size).toBe(fixture.candidates.length);
      expect(fixture.expectedRelevantCandidateIds.every(candidateId => candidateIds.has(candidateId))).toBe(true);
      expect(fixture.answerable).toBe(fixture.expectedRelevantCandidateIds.length > 0);
    }
  });

  it('records known weaknesses in the deterministic vector baseline instead of hiding them', async () => {
    const provider = new VectorScoreEvidenceProvider();
    const results = new Map<string, Awaited<ReturnType<typeof evaluateEvidenceProvider>>>();

    for (const fixture of EVIDENCE_EVALUATION_FIXTURES) {
      results.set(fixture.id, await evaluateEvidenceProvider(provider, fixture, 0.5));
    }

    expect(results.get('direct-distributor')?.precisionAtK).toBe(1);
    expect(results.get('lexical-master-rights')?.precisionAtK).toBe(0);
    expect(results.get('paraphrase-delivery-readiness')?.precisionAtK).toBe(0);
    expect(results.get('no-answer-japan-mechanical-rate')?.noAnswerFalsePositive).toBe(true);
    expect(results.get('conflicting-release-dates')?.recallAtK).toBe(1);
    expect(results.get('multi-source-spotify-readiness')?.recallAtK).toBe(1);
  });

  it('reports candidate-level errors that top-k ranking can conceal', () => {
    const fixture = EVIDENCE_EVALUATION_FIXTURES.find(item => item.id === 'paraphrase-delivery-readiness')!;
    const result = evaluateEvidenceJudgments(fixture, [
      { candidateId: 'paraphrase-1', relevance: 0.55 },
      { candidateId: 'paraphrase-2', relevance: 0.91 },
      { candidateId: 'paraphrase-3', relevance: 0.41 },
    ], 0.5);

    expect(result.precisionAtK).toBe(1);
    expect(result.candidateFalsePositiveCount).toBe(1);
    expect(result.candidateFalsePositiveRate).toBe(0.5);
    expect(result.candidateFalseNegativeCount).toBe(0);
  });

  it('evaluates one judgment set across the complete shadow threshold sweep', () => {
    const fixture = EVIDENCE_EVALUATION_FIXTURES.find(item => item.id === 'paraphrase-delivery-readiness')!;
    const results = evaluateEvidenceThresholdSweep(fixture, [
      { candidateId: 'paraphrase-1', relevance: 0.55 },
      { candidateId: 'paraphrase-2', relevance: 0.91 },
      { candidateId: 'paraphrase-3', relevance: 0.41 },
    ]);

    expect(results.map(result => result.minimumRelevance)).toEqual(EVIDENCE_SHADOW_THRESHOLDS);
    expect(results.find(result => result.minimumRelevance === 0.5)?.candidateFalsePositiveCount).toBe(1);
    expect(results.find(result => result.minimumRelevance === 0.6)?.candidateFalsePositiveCount).toBe(0);
    expect(PROVISIONAL_TYPESAFE_SHADOW_THRESHOLD).toBe(0.75);
  });

  it('counts relevant candidates rejected by the threshold as false negatives', () => {
    const fixture = EVIDENCE_EVALUATION_FIXTURES.find(item => item.id === 'paraphrase-delivery-readiness')!;
    const result = evaluateEvidenceJudgments(fixture, [
      { candidateId: 'paraphrase-1', relevance: 0.1 },
      { candidateId: 'paraphrase-2', relevance: 0.7 },
      { candidateId: 'paraphrase-3', relevance: 0.2 },
    ], 0.75);

    expect(result.recallAtK).toBe(0);
    expect(result.candidateFalseNegativeCount).toBe(1);
    expect(result.candidateFalseNegativeRate).toBe(1);
    expect(result.candidateFalsePositiveCount).toBe(0);
  });
});
