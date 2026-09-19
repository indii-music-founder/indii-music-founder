import { describe, expect, it } from 'vitest';
import {
  VectorScoreEvidenceProvider,
  evaluateEvidenceProvider,
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

  it('covers all six required fixture families with valid expected IDs', () => {
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
});
