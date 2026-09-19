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
  | 'multi-source';

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
  precisionAtK: number;
  recallAtK: number;
  reciprocalRank: number;
  noAnswerFalsePositive: boolean;
}

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
): EvidenceEvaluationResult {
  const relevant = new Set(fixture.expectedRelevantCandidateIds);
  const selected = rankedCandidateIds.slice(0, fixture.topK);
  const truePositiveCount = selected.filter(candidateId => relevant.has(candidateId)).length;
  const precisionAtK = selected.length === 0 ? 0 : truePositiveCount / selected.length;
  const recallAtK = relevant.size === 0 ? 1 : truePositiveCount / relevant.size;
  const firstRelevantIndex = rankedCandidateIds.findIndex(candidateId => relevant.has(candidateId));

  return {
    fixtureId: fixture.id,
    precisionAtK,
    recallAtK,
    reciprocalRank: firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1),
    noAnswerFalsePositive: !fixture.answerable && selected.length > 0,
  };
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
  const knownCandidateIds = new Set(fixture.candidates.map(candidate => candidate.id));
  const rankedCandidateIds = judgments
    .filter(judgment => knownCandidateIds.has(judgment.candidateId))
    .filter(judgment => Number.isFinite(judgment.relevance) && judgment.relevance >= minimumRelevance)
    .sort((a, b) => b.relevance - a.relevance)
    .map(judgment => judgment.candidateId);

  return evaluateEvidenceRanking(fixture, rankedCandidateIds);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
