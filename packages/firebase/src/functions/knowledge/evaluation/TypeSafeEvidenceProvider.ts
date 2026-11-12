import { createTypesafeClient, TYPESAFE_MAX_QUESTIONS, TypesafeClientError, type TypesafeClient } from '../../intelligence/typesafeClient';
import type {
  EvidenceJudgment,
  EvidenceJudgmentProvider,
  EvidenceJudgmentRequest,
} from '../evidenceJudgment';

const DEFAULT_TIMEOUT_MS = 10_000;

export type TypeSafeTelemetryMode = 'evaluation' | 'shadow' | 'live';

export interface TypeSafeEvidenceTelemetryEvent {
  provider: 'typesafe';
  model: string;
  feature: string;
  mode: TypeSafeTelemetryMode;
  status: 'success' | 'error' | 'timeout';
  durationMs: number;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TypeSafeEvidenceProviderConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  telemetry?: (event: TypeSafeEvidenceTelemetryEvent) => void | Promise<void>;
  telemetryMode?: TypeSafeTelemetryMode;
  feature?: string;
}

interface TypeSafeNoulAnswer {
  type: 'noul';
  noul: number;
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

  private readonly client: TypesafeClient;
  private readonly timeoutMs: number;
  private readonly telemetry?: TypeSafeEvidenceProviderConfig['telemetry'];
  private readonly telemetryMode: TypeSafeTelemetryMode;
  private readonly feature: string;

  constructor(config: TypeSafeEvidenceProviderConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error('TypeSafe evidence evaluation requires a non-empty API key.');
    }

    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('TypeSafe evidence evaluation timeout must be a positive number.');
    }

    this.timeoutMs = timeoutMs;
    this.client = createTypesafeClient({ ...config, apiKey, timeoutMs });
    this.telemetry = config.telemetry;
    this.telemetryMode = config.telemetryMode ?? 'evaluation';
    this.feature = config.feature?.trim() || 'knowledge_evidence_rerank';
  }

  async judgeRelevance(request: EvidenceJudgmentRequest): Promise<EvidenceJudgment[]> {
    const query = request.query.trim();
    if (!query) {
      throw new Error('TypeSafe evidence evaluation requires a non-empty query.');
    }
    if (request.candidates.length === 0) return [];
    if (request.candidates.length > TYPESAFE_MAX_QUESTIONS) {
      throw new Error(
        `TypeSafe evidence evaluation accepts at most ${TYPESAFE_MAX_QUESTIONS} candidates per request.`,
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

    const startedAt = Date.now();
    let requestId: string | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    try {
      const result = await this.client.judge({ state, questions });
      ({ requestId, inputTokens, outputTokens } = result);
      const { answers } = result;

      const judgments = candidateRefs.map(({ ref, candidate }) => {
        const answer = parseNoulAnswer(answers[ref], ref);
        return {
          candidateId: candidate.id,
          relevance: answer.noul,
        };
      });
      this.emitTelemetry({
        status: 'success',
        durationMs: Date.now() - startedAt,
        requestId,
        inputTokens,
        outputTokens,
      });
      return judgments;
    } catch (error: unknown) {
      const timedOut = error instanceof TypesafeClientError && error.kind === 'timeout';
      if (error instanceof TypesafeClientError) requestId ??= error.requestId;
      this.emitTelemetry({
        status: timedOut ? 'timeout' : 'error',
        durationMs: Date.now() - startedAt,
        requestId,
        inputTokens,
        outputTokens,
      });
      if (timedOut) {
        throw new Error(`TypeSafe evidence evaluation timed out after ${this.timeoutMs}ms.`);
      }
      if (error instanceof TypesafeClientError && error.status !== undefined) {
        // Preserve the status without exposing upstream response text.
        const requestLabel = requestId ? ` (request ${requestId})` : '';
        throw new Error(`TypeSafe evidence evaluation failed with HTTP ${error.status}${requestLabel}.`);
      }
      throw error;
    }
  }

  private emitTelemetry(
    event: Omit<TypeSafeEvidenceTelemetryEvent, 'provider' | 'model' | 'feature' | 'mode'>,
  ): void {
    if (!this.telemetry) return;
    try {
      const delivery = this.telemetry({
        provider: 'typesafe',
        model: this.client.model,
        feature: this.feature,
        mode: this.telemetryMode,
        ...event,
      });
      void Promise.resolve(delivery).catch(() => undefined);
    } catch {
      // Telemetry must never change provider behavior or block a user request.
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
