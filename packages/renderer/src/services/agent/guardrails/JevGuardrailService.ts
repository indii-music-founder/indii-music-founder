import { TypeSafeClient, noul } from '@typesafe-ai/sdk';
import { logger } from '@/utils/logger';

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
};

const UNACTIONABLE_FALLBACK =
  "I'm not sure how to help with that yet. Try asking me to schedule a post, check your connections, or show your analytics.";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class JevGuardrailService {
  private client: TypeSafeClient | null = null;

  private getClient(): TypeSafeClient | null {
    if (this.client) return this.client;

    const apiKey = import.meta.env.VITE_TYPESAFE_API_KEY as string | undefined;
    if (!apiKey || apiKey.trim() === '') {
      logger.debug('[JevGuardrail] VITE_TYPESAFE_API_KEY not set — guardrail disabled');
      return null;
    }

    this.client = new TypeSafeClient({ apiKey });
    return this.client;
  }

  /**
   * Screen an agent response through Jev before it reaches the UI.
   *
   * All questions are evaluated in a single parallel Jev call.
   * Returns the original response unmodified if:
   *  - VITE_TYPESAFE_API_KEY is absent/blank
   *  - The Jev call fails for any reason
   *  - The Jev call takes longer than GUARDRAIL_TIMEOUT_MS
   */
  async screen(input: GuardrailInput): Promise<GuardrailResult> {
    const passthrough: GuardrailResult = {
      text: input.text,
      wasModified: false,
      flags: [],
      confidence: {},
    };

    const client = this.getClient();
    if (!client) return passthrough;

    const toolNames = (input.tool_calls ?? []).map((t) => t.name).join(', ') || 'none';

    try {
      const result = await Promise.race([
        this.runJev(client, input.text, toolNames),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GUARDRAIL_TIMEOUT_MS)),
      ]);

      if (!result) {
        logger.warn('[JevGuardrail] Jev timed out — passing through unmodified');
        return passthrough;
      }

      return result;
    } catch (err) {
      logger.warn('[JevGuardrail] Jev call failed — passing through unmodified:', err);
      return passthrough;
    }
  }

  private async runJev(
    client: TypeSafeClient,
    responseText: string,
    toolNames: string
  ): Promise<GuardrailResult> {
    const response = await client.systemOne({
      state: {
        response: {
          text: responseText,
          tool_calls: toolNames,
        },
      },
      questions: {
        // Hallucination: claims connectivity status without tool evidence
        claims_disconnected_without_evidence: noul(
          'Does `response.text` assert that a platform (Instagram, Spotify, Apple Music, etc.) ' +
          'is disconnected or unavailable, when `response.tool_calls` is "none" or contains no ' +
          'connectivity-checking tool?'
        ),
        // Hallucination: claims scheduling happened without a scheduling tool call
        claims_scheduled_without_tool: noul(
          'Does `response.text` state that a post was scheduled, queued, or will be posted, ' +
          'while `response.tool_calls` contains no scheduling tool execution?'
        ),
        // Hallucination: confident action claim with no tool evidence at all
        confident_action_no_evidence: noul(
          'Does `response.text` claim a concrete action was completed (posted, uploaded, sent, ' +
          'saved, published) when `response.tool_calls` is "none"?'
        ),
        // Quality: is the response actionable for the user?
        is_actionable_response: noul(
          'Does `response.text` give the user either a completed result, a clear next step, ' +
          'or a request for missing information they can act on?'
        ),
      },
      model: JEV_MODEL,
    });

    const answers = response.answers;
    const confidence: Record<string, number> = {};
    const flags: string[] = [];
    let prefix = '';

    // Extract noul probabilities
    for (const key of Object.keys(answers)) {
      const ans = answers[key as keyof typeof answers];
      if (typeof ans === 'object' && ans !== null && 'noul' in ans) {
        confidence[key] = (ans as { noul: number }).noul;
      }
    }

    // Check hallucination flags (highest-priority corrections)
    for (const [flag, correction] of Object.entries(CORRECTIONS)) {
      const prob = confidence[flag] ?? 0;
      if (prob > FIRE_THRESHOLD) {
        flags.push(flag);
        // Only prepend the first matching correction to avoid stacking
        if (!prefix) {
          prefix = correction;
        }
      }
    }

    // Check actionability (only if no hallucination flag fired)
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
      // Replace entirely with the fallback — original was not useful
      finalText = UNACTIONABLE_FALLBACK;
    } else {
      // Prepend the correction notice but keep the agent's original text visible
      finalText = prefix + responseText;
    }

    if (wasModified) {
      logger.warn('[JevGuardrail] Modified agent response. Flags:', flags, 'Confidence:', confidence);
    }

    return { text: finalText, wasModified, flags, confidence };
  }
}

/** Singleton — one client instance per app session. */
export const jevGuardrailService = new JevGuardrailService();

