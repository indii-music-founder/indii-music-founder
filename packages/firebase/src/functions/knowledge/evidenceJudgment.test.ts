import { describe, expect, it } from 'vitest';
import {
  VectorScoreEvidenceProvider,
  evaluateEvidenceProvider,
  vectorDistanceToRelevance,
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
  it('converts Firestore cosine distance to bounded relevance', () => {
    expect(vectorDistanceToRelevance(0)).toBe(1);
    expect(vectorDistanceToRelevance(0.1)).toBeCloseTo(0.9);
    expect(vectorDistanceToRelevance(1.4)).toBe(0);
    expect(vectorDistanceToRelevance(-0.1)).toBeNull();
    expect(vectorDistanceToRelevance(undefined)).toBeNull();
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
