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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Jev model — System One, structured judgments only, not generative. */
const JEV_MODEL = 'jev-latest';

/** Max milliseconds to wait for Jev before passing through unmodified. */
const GUARDRAIL_TIMEOUT_MS = 2000;

/** Noul threshold above which a flag is considered fired. */
const FIRE_THRESHOLD = 0.7;

/** Threshold below which a response is considered un-actionable. */
const ACTIONABLE_THRESHOLD = 0.3;

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
  claims_verified_readiness_without_evidence:
    '⚠️ To be precise about current capabilities: ',
};

const UNACTIONABLE_FALLBACK =
  "I'm not sure how to help with that yet. Try asking me to schedule a post, check your connections, or show your analytics.";

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

    const toolNames = (input.tool_calls ?? []).map((t) => t.name).join(', ') || 'none';

    try {
      const result = await Promise.race([
        this.runEvaluation(input.text, toolNames),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GUARDRAIL_TIMEOUT_MS)),
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
    }
  }

  private async runEvaluation(
    responseText: string,
    toolNames: string
  ): Promise<GuardrailResult | null> {
    const state = {
      response: {
        text: responseText,
        tool_calls: toolNames,
      },
    };

    const questionsDef = {
      claims_disconnected_without_evidence: {
        type: 'noul' as const,
        instructions:
          'Does `response.text` assert that a platform (Instagram, Spotify, Apple Music, etc.) ' +
          'is disconnected or unavailable, when `response.tool_calls` is "none" or contains no ' +
          'connectivity-checking tool?',
      },
      claims_scheduled_without_tool: {
        type: 'noul' as const,
        instructions:
          'Does `response.text` state that a post was scheduled, queued, or will be posted, ' +
          'while `response.tool_calls` contains no scheduling tool execution?',
      },
      confident_action_no_evidence: {
        type: 'noul' as const,
        instructions:
          'Does `response.text` claim a concrete action was completed (posted, uploaded, sent, ' +
          'saved, published) when `response.tool_calls` is "none"?',
      },
      claims_verified_readiness_without_evidence: {
        type: 'noul' as const,
        instructions:
          'Does `response.text` assert that departments, agents, systems, or capabilities are fully ' +
          'implemented, verified, production-ready, or operational — or that no engineering work ' +
          'remains — without `response.tool_calls` containing an audit or verification tool that ' +
          'produced live evidence? A claim of complete production readiness with no verification ' +
          'step is an overclaim.',
      },
      is_actionable_response: {
        type: 'noul' as const,
        instructions:
          'Does `response.text` give the user either a completed result, a clear next step, ' +
          'or a request for missing information they can act on?',
      },
    };

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

    for (const key of Object.keys(rawAnswers)) {
      const ans = rawAnswers[key];
      if (typeof ans === 'number') {
        confidence[key] = ans;
      } else if (typeof ans === 'object' && ans !== null && 'noul' in ans) {
        confidence[key] = Number((ans as { noul: unknown }).noul);
      }
    }

    for (const [flag, correction] of Object.entries(CORRECTIONS)) {
      const prob = confidence[flag] ?? 0;
      if (prob > FIRE_THRESHOLD) {
        flags.push(flag);
        if (!prefix) prefix = correction;
      }
    }

    const isActionable = confidence['is_actionable_response'] ?? 1;
    if (!prefix && isActionable < ACTIONABLE_THRESHOLD) {
      flags.push('unactionable_response');
      prefix = UNACTIONABLE_FALLBACK;
    }

    const wasModified = flags.length > 0;
    let finalText: string;
    if (!wasModified) {
      finalText = responseText;
    } else if (flags.includes('unactionable_response')) {
      finalText = UNACTIONABLE_FALLBACK;
    } else {
      finalText = prefix + responseText;
    }

    if (wasModified) {
      logger.warn('[JevGuardrail] Modified agent response. Flags:', flags, 'Confidence:', confidence);
    }

    return { text: finalText, wasModified, flags, confidence };
  }
}

/** Singleton — one service instance per app session. */
export const jevGuardrailService = new JevGuardrailService();
