import { GUARDRAIL_QUESTIONS, GUARDRAIL_MODEL, GUARDRAIL_FIRE_THRESHOLD, GUARDRAIL_ACTIONABLE_THRESHOLD } from '@/config/typesafeJudgments';
import { logger } from '@/utils/logger';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuardrailInput {
  /** The full text the agent is about to emit to the user. */
  text: string;
  /** Tool calls that were executed in this turn (may be empty). */
  tool_calls?: Array<{ name: string; result?: unknown }>;
}

export interface GuardrailResult {
  /** Final text — possibly prefixed with a correction notice. */
  text: string;
  /** True when the text was modified by the guardrail. */
  wasModified: boolean;
  /** Keys of the Jev questions that fired above threshold. */
  flags: string[];
  /** Raw noul probabilities returned by Jev (0.0 – 1.0). */
  confidence: Record<string, number>;
}

/** Bounded status and receipt fields; never turn an attempted tool name into success. */
export function projectGuardrailToolEvidence(calls: NonNullable<GuardrailInput['tool_calls']>) {
  return calls.slice(-20).map(call => {
    const evidence: Record<string, unknown> & { name: string; reportedSuccess: boolean | null } = {
      name: call.name.slice(0, 160), reportedSuccess: null,
    };
    const result = call.result;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      if (typeof result === 'string') evidence.message = result.slice(0, 400);
      return evidence;
    }
    const record = result as Record<string, unknown>;
    if (typeof record.success === 'boolean') evidence.reportedSuccess = record.success;
    for (const key of ['status', 'error', 'message'] as const) {
      if (typeof record[key] === 'string') evidence[key] = record[key].slice(0, 400);
    }
    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
      const data = record.data as Record<string, unknown>;
      const details: Record<string, unknown> = {};
      for (const key of ['status', 'connected', 'requiresApproval', 'id', 'documentId', 'issueUrl', 'url', 'scheduledAt']) {
        const value = data[key];
        if (typeof value === 'string') details[key] = value.slice(0, 160);
        else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) details[key] = value;
      }
      if (Object.keys(details).length) evidence.details = details;
    }
    return evidence;
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Jev model — System One, structured judgments only, not generative. */
const JEV_MODEL = GUARDRAIL_MODEL;

/** Max milliseconds to wait for Jev before passing through unmodified. */
const GUARDRAIL_TIMEOUT_MS = 2000;

/** Noul threshold above which a flag is considered fired. */
const FIRE_THRESHOLD = GUARDRAIL_FIRE_THRESHOLD;

/** Threshold below which a response is considered un-actionable. */
const ACTIONABLE_THRESHOLD = GUARDRAIL_ACTIONABLE_THRESHOLD;

/** Invalid probabilities abstain; coercion must never manufacture a flag. */
export function parseGuardrailProbability(answer: unknown): number | null {
  const probability = typeof answer === 'number'
    ? answer
    : answer !== null && typeof answer === 'object' && !Array.isArray(answer)
      ? (answer as Record<string, unknown>).noul
      : undefined;
  return typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 1
    ? probability
    : null;
}

// ---------------------------------------------------------------------------
// Correction prefixes injected when flags fire
// ---------------------------------------------------------------------------

const CORRECTIONS: Record<string, string> = {
  claims_disconnected_without_evidence:
    '⚠️ I need to verify this — let me check your connections first. ',
  claims_scheduled_without_tool:
    '⚠️ I haven\'t confirmed this action completed — let me verify. ',
  confident_action_no_evidence:
    '⚠️ I haven\'t confirmed this action completed — let me verify. ',
  claims_verified_readiness_without_evidence: '', // Replaced in full below.
};

const UNVERIFIED_READINESS_FALLBACK =
  'I cannot verify that capability or connection status from the evidence in this response. A current check or receipt is needed before treating it as confirmed.';

const UNACTIONABLE_FALLBACK =
  'I need a bit more detail to help with that. Please specify what you would like to create, check, or update.';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class JevGuardrailService {
  private hasLoggedProxyStatus = false;

  /**
   * Screen an agent response through Jev before it reaches the UI.
   *
   * Every renderer judgment goes through the server-side `typesafeJudge`
   * callable. The TypeSafe credential must never be present in a VITE_* value,
   * renderer bundle, or browser-side SDK client.
   *
   * Returns the original response unmodified on timeout, upstream failure, or
   * unavailable service.
   */
  async screen(input: GuardrailInput): Promise<GuardrailResult> {
    const passthrough: GuardrailResult = {
      text: input.text,
      wasModified: false,
      flags: [],
      confidence: {},
    };

    const toolResults = projectGuardrailToolEvidence(input.tool_calls ?? []);
    const toolNames = toolResults.map(tool => tool.name).join(', ') || 'none';

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.runEvaluation(input.text, toolNames, toolResults, Math.max(0, (input.tool_calls?.length ?? 0) - toolResults.length)),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), GUARDRAIL_TIMEOUT_MS);
        }),
      ]);

      if (!result) {
        logger.debug('[JevGuardrail] Evaluation timed out or bypassed — passing through unmodified');
        return passthrough;
      }

      // Issue #317: an overclaim flag means the app itself caught a
      // readiness claim it cannot back — auto-file the critique through the
      // bug pipeline so truthfulness reports originate from the product.
      if (result.flags.includes('claims_verified_readiness_without_evidence')) {
        void import('../truthOverclaimReporter').then(({ reportOverclaimIfNeeded }) =>
          reportOverclaimIfNeeded({
            snippet: input.text,
            source: 'jev_guardrail',
            signal: 'claims_verified_readiness_without_evidence',
          }),
        ).catch(() => undefined);
      }

      return result;
    } catch (err) {
      logger.warn('[JevGuardrail] Evaluation failed — passing through unmodified:', err);
      return passthrough;
    } finally {
      clearTimeout(timer);
    }
  }

  private async runEvaluation(
    responseText: string,
    toolNames: string,
    toolResults: ReturnType<typeof projectGuardrailToolEvidence>,
    omittedToolResults: number,
  ): Promise<GuardrailResult | null> {
    const state = {
      response: {
        text: responseText,
        tool_calls: toolNames,
        tool_results: toolResults,
        omitted_tool_results: omittedToolResults,
      },
    };

    const questionsDef = GUARDRAIL_QUESTIONS;

    let rawAnswers: Record<string, unknown> | undefined;

    try {
      const judgeFn = httpsCallable<
        { state: Record<string, unknown>; questions: Record<string, unknown>; model?: string },
        { answers: Record<string, unknown> }
      >(functions, 'typesafeJudge');
      const res = await judgeFn({
        state,
        questions: questionsDef,
        model: JEV_MODEL,
      });
      rawAnswers = res.data?.answers;
    } catch (proxyErr) {
      if (!this.hasLoggedProxyStatus) {
        logger.debug('[JevGuardrail] typesafeJudge proxy unavailable:', proxyErr);
        this.hasLoggedProxyStatus = true;
      }
      return null;
    }

    if (!rawAnswers) return null;

    const confidence: Record<string, number> = {};
    const flags: string[] = [];
    let prefix = '';

    for (const key of Object.keys(questionsDef)) {
      const probability = parseGuardrailProbability(rawAnswers[key]);
      if (probability !== null) confidence[key] = probability;
    }

    for (const [flag, correction] of Object.entries(CORRECTIONS)) {
      const prob = confidence[flag] ?? 0;
      if (prob > FIRE_THRESHOLD) {
        flags.push(flag);
        if (!prefix) prefix = correction;
      }
    }

    const hasFailedToolResult = toolResults.some(
      (r) => r.reportedSuccess === false || Boolean(r.error),
    );
    const isActionable = confidence['is_actionable_response'] ?? 1;
    if (!prefix && !hasFailedToolResult && toolNames === 'none' && isActionable < ACTIONABLE_THRESHOLD) {
      flags.push('unactionable_response');
      prefix = UNACTIONABLE_FALLBACK;
    }

    const wasModified = flags.length > 0;
    let finalText: string;
    if (!wasModified) {
      finalText = responseText;
    } else if (flags.includes('claims_verified_readiness_without_evidence')) {
      // A caution prefix must not leave the unsupported claim visible as fact.
      finalText = UNVERIFIED_READINESS_FALLBACK;
    } else if (flags.includes('unactionable_response')) {
      finalText = UNACTIONABLE_FALLBACK;
    } else {
      finalText = 'I cannot confirm that action or connection status from the tool results available here. A successful result is needed before treating it as completed.';
    }

    if (wasModified) {
      logger.warn('[JevGuardrail] Modified agent response. Flags:', flags, 'Confidence:', confidence);
    }

    return { text: finalText, wasModified, flags, confidence };
  }
}

/** Singleton — one service instance per app session. */
export const jevGuardrailService = new JevGuardrailService();
