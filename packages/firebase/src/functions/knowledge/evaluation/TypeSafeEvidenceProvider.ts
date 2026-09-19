import type {
  EvidenceJudgment,
  EvidenceJudgmentProvider,
  EvidenceJudgmentRequest,
} from '../evidenceJudgment';

const DEFAULT_TYPESAFE_BASE_URL = 'https://api.typesafe.ai';
const DEFAULT_TYPESAFE_MODEL = 'jev-latest';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_CANDIDATES_PER_REQUEST = 20;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TypeSafeEvidenceProviderConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

interface TypeSafeNoulAnswer {
  type: 'noul';
  noul: number;
}

interface TypeSafeSystemOneResponse {
  model?: unknown;
  answers?: unknown;
  usage?: unknown;
}

/**
 * Evaluation-only TypeSafe adapter for the provider-neutral evidence boundary.
 *
 * This file is intentionally not imported by queryKnowledgeBase. Adding it does
 * not put TypeSafe on the production request path. It exists so synthetic
 * fixtures can be evaluated against the same EvidenceJudgmentProvider contract
 * as the deterministic baseline.
 *
 * Native fetch is deliberate while the Firebase runtime remains Node 22. The
 * current TypeSafe JS SDK has a reported Node 20/22 cancellation compatibility
 * problem. Revisit the SDK when either the runtime or SDK compatibility changes.
 */
export class TypeSafeEvidenceProvider implements EvidenceJudgmentProvider {
  readonly id = 'typesafe-jev';

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(config: TypeSafeEvidenceProviderConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error('TypeSafe evidence evaluation requires a non-empty API key.');
    }

    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('TypeSafe evidence evaluation timeout must be a positive number.');
    }

    this.apiKey = apiKey;
    this.baseURL = (config.baseURL ?? DEFAULT_TYPESAFE_BASE_URL).replace(/\/+$/, '');
    this.model = config.model?.trim() || DEFAULT_TYPESAFE_MODEL;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = config.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  async judgeRelevance(request: EvidenceJudgmentRequest): Promise<EvidenceJudgment[]> {
    const query = request.query.trim();
    if (!query) {
      throw new Error('TypeSafe evidence evaluation requires a non-empty query.');
    }
    if (request.candidates.length === 0) return [];
    if (request.candidates.length > MAX_CANDIDATES_PER_REQUEST) {
      throw new Error(
        `TypeSafe evidence evaluation accepts at most ${MAX_CANDIDATES_PER_REQUEST} candidates per request.`,
      );
    }

    const candidateRefs = request.candidates.map((candidate, index) => ({
      candidate,
      ref: `candidate_${index}`,
    }));

    // Deliberately exclude document IDs and vector scores. The semantic provider
    // receives only the minimum text needed to judge relevance, and the vector
    // baseline cannot bias its answer.
    const state = {
      query,
      candidates: candidateRefs.map(({ ref, candidate }) => ({
        ref,
        text: candidate.text,
      })),
    };

    const questions = Object.fromEntries(
      candidateRefs.map(({ ref }) => [
        ref,
        {
          type: 'noul',
          instructions: {
            task: 'Does this candidate contain evidence that materially helps answer the query?',
            candidate_ref: ref,
          },
          criteria: {
            true: 'The candidate directly supports the answer or provides a necessary part of a multi-source answer. Semantic paraphrases count.',
            false: 'The candidate is unrelated, only shares surface keywords, or does not materially help answer the query.',
          },
        },
      ]),
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseURL}/v1/systemone`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state,
          questions,
          model: this.model,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const requestId = response.headers.get('x-typesafe-request-id');
        throw new Error(
          `TypeSafe evidence evaluation failed with HTTP ${response.status}${requestId ? ` (request ${requestId})` : ''}.`,
        );
      }

      const payload = (await response.json()) as TypeSafeSystemOneResponse;
      const answers = asRecord(payload.answers);
      if (!answers) {
        throw new Error('TypeSafe evidence evaluation returned no answers object.');
      }

      return candidateRefs.map(({ ref, candidate }) => {
        const answer = parseNoulAnswer(answers[ref], ref);
        return {
          candidateId: candidate.id,
          relevance: answer.noul,
        };
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`TypeSafe evidence evaluation timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseNoulAnswer(value: unknown, ref: string): TypeSafeNoulAnswer {
  const record = asRecord(value);
  const probability = record?.noul;
  if (
    record?.type !== 'noul'
    || typeof probability !== 'number'
    || !Number.isFinite(probability)
    || probability < 0
    || probability > 1
  ) {
    throw new Error(`TypeSafe evidence evaluation returned an invalid Noul answer for ${ref}.`);
  }

  return {
    type: 'noul',
    noul: probability,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
