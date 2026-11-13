export interface EvidenceCandidate {
  id: string;
  documentId: string;
  text: string;
  vectorScore: number;
}

export interface EvidenceJudgment {
  candidateId: string;
  relevance: number;
}

export interface EvidenceJudgmentRequest {
  query: string;
  candidates: EvidenceCandidate[];
}

/**
 * Provider-neutral semantic judgment boundary.
 *
 * Implementations may use deterministic vector scores, Vertex, TypeSafe, or a
 * future local model. Provider-specific SDK types must not leak through this
 * interface.
 */
export interface EvidenceJudgmentProvider {
  readonly id: string;
  judgeRelevance(request: EvidenceJudgmentRequest): Promise<EvidenceJudgment[]>;
}

export type EvidenceFixtureFamily =
  | 'direct-evidence'
  | 'lexical-trap'
  | 'paraphrase'
  | 'no-answer'
  | 'conflicting-evidence'
  | 'multi-source'
  | 'partial-evidence'
  | 'provenance-conflict'
  | 'stale-evidence'
  | 'ambiguous-query';

export interface EvidenceEvaluationFixture {
  id: string;
  family: EvidenceFixtureFamily;
  query: string;
  candidates: EvidenceCandidate[];
  expectedRelevantCandidateIds: string[];
  answerable: boolean;
  topK: number;
}

export interface EvidenceEvaluationResult {
  fixtureId: string;
  minimumRelevance: number;
  precisionAtK: number;
  recallAtK: number;
  reciprocalRank: number;
  noAnswerFalsePositive: boolean;
  candidateTruePositiveCount: number;
  candidateFalsePositiveCount: number;
  candidateFalseNegativeCount: number;
  candidateTrueNegativeCount: number;
  candidateFalsePositiveRate: number;
  candidateFalseNegativeRate: number;
}

export const EVIDENCE_SHADOW_THRESHOLDS = [0.5, 0.6, 0.7, 0.75, 0.9] as const;

/** Evaluation-only starting point. This does not enable TypeSafe on a production path. */
export const PROVISIONAL_TYPESAFE_SHADOW_THRESHOLD = 0.75;

/**
 * Computes the same semantic quantity used by COSINE nearest-neighbor search,
 * but from the query/chunk vectors already present in the result documents.
 * Negative cosine similarity is treated as zero relevance for this 0..1 API.
 */
export function cosineSimilarityRelevance(
  queryEmbedding: readonly number[],
  candidateEmbedding: readonly number[],
): number | null {
  if (queryEmbedding.length === 0 || queryEmbedding.length !== candidateEmbedding.length) {
    return null;
  }

  let dotProduct = 0;
  let queryNormSquared = 0;
  let candidateNormSquared = 0;

  for (let index = 0; index < queryEmbedding.length; index++) {
    const queryValue = queryEmbedding[index];
    const candidateValue = candidateEmbedding[index];
    if (!Number.isFinite(queryValue) || !Number.isFinite(candidateValue)) return null;
    dotProduct += queryValue * candidateValue;
    queryNormSquared += queryValue * queryValue;
    candidateNormSquared += candidateValue * candidateValue;
  }

  if (queryNormSquared === 0 || candidateNormSquared === 0) return null;
  return clamp01(dotProduct / Math.sqrt(queryNormSquared * candidateNormSquared));
}

/** Deterministic baseline provider for the evaluation harness. */
export class VectorScoreEvidenceProvider implements EvidenceJudgmentProvider {
  readonly id = 'vector-score';

  async judgeRelevance(request: EvidenceJudgmentRequest): Promise<EvidenceJudgment[]> {
    return request.candidates.map(candidate => ({
      candidateId: candidate.id,
      relevance: clamp01(candidate.vectorScore),
    }));
  }
}

export function evaluateEvidenceRanking(
  fixture: EvidenceEvaluationFixture,
  rankedCandidateIds: string[],
  minimumRelevance = 0.5,
  selectedCandidateIds: string[] = rankedCandidateIds,
): EvidenceEvaluationResult {
  const relevant = new Set(fixture.expectedRelevantCandidateIds);
  const selected = rankedCandidateIds.slice(0, fixture.topK);
  const truePositiveCount = selected.filter(candidateId => relevant.has(candidateId)).length;
  const precisionAtK = selected.length === 0 ? 0 : truePositiveCount / selected.length;
  const recallAtK = relevant.size === 0 ? 1 : truePositiveCount / relevant.size;
  const firstRelevantIndex = rankedCandidateIds.findIndex(candidateId => relevant.has(candidateId));
  const selectedAtThreshold = new Set(selectedCandidateIds);
  const candidateTruePositiveCount = fixture.candidates.filter(candidate => (
    relevant.has(candidate.id) && selectedAtThreshold.has(candidate.id)
  )).length;
  const candidateFalsePositiveCount = fixture.candidates.filter(candidate => (
    !relevant.has(candidate.id) && selectedAtThreshold.has(candidate.id)
  )).length;
  const candidateFalseNegativeCount = fixture.candidates.filter(candidate => (
    relevant.has(candidate.id) && !selectedAtThreshold.has(candidate.id)
  )).length;
  const candidateTrueNegativeCount = fixture.candidates.filter(candidate => (
    !relevant.has(candidate.id) && !selectedAtThreshold.has(candidate.id)
  )).length;
  const negativeCount = candidateFalsePositiveCount + candidateTrueNegativeCount;
  const positiveCount = candidateTruePositiveCount + candidateFalseNegativeCount;

  return {
    fixtureId: fixture.id,
    minimumRelevance,
    precisionAtK,
    recallAtK,
    reciprocalRank: firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1),
    noAnswerFalsePositive: !fixture.answerable && selected.length > 0,
    candidateTruePositiveCount,
    candidateFalsePositiveCount,
    candidateFalseNegativeCount,
    candidateTrueNegativeCount,
    candidateFalsePositiveRate: negativeCount === 0 ? 0 : candidateFalsePositiveCount / negativeCount,
    candidateFalseNegativeRate: positiveCount === 0 ? 0 : candidateFalseNegativeCount / positiveCount,
  };
}

export function evaluateEvidenceJudgments(
  fixture: EvidenceEvaluationFixture,
  judgments: EvidenceJudgment[],
  minimumRelevance = 0.5,
): EvidenceEvaluationResult {
  const knownCandidateIds = new Set(fixture.candidates.map(candidate => candidate.id));
  const selectedJudgments = judgments
    .filter(judgment => knownCandidateIds.has(judgment.candidateId))
    .filter(judgment => Number.isFinite(judgment.relevance) && judgment.relevance >= minimumRelevance)
    .sort((a, b) => b.relevance - a.relevance);

  return evaluateEvidenceRanking(
    fixture,
    selectedJudgments.map(judgment => judgment.candidateId),
    minimumRelevance,
    selectedJudgments.map(judgment => judgment.candidateId),
  );
}

export function evaluateEvidenceThresholdSweep(
  fixture: EvidenceEvaluationFixture,
  judgments: EvidenceJudgment[],
  thresholds: readonly number[] = EVIDENCE_SHADOW_THRESHOLDS,
): EvidenceEvaluationResult[] {
  return thresholds.map(threshold => evaluateEvidenceJudgments(fixture, judgments, threshold));
}

export async function evaluateEvidenceProvider(
  provider: EvidenceJudgmentProvider,
  fixture: EvidenceEvaluationFixture,
  minimumRelevance = 0.5,
): Promise<EvidenceEvaluationResult> {
  const judgments = await provider.judgeRelevance({
    query: fixture.query,
    candidates: fixture.candidates,
  });
  return evaluateEvidenceJudgments(fixture, judgments, minimumRelevance);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
