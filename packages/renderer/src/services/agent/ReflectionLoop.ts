/**
 * ReflectionLoop — Self-Evaluating Agent Output Quality Critic
 *
 * Phase 2: Agent Orchestration & Memory
 *
 * After an agent generates a response, this service evaluates the output
 * against the original task requirements and produces a ReflectionResult.
 * If the score is below the threshold, the agent is prompted to iterate.
 *
 * Architecture:
 * 1. Agent produces initial output
 * 2. evaluate() scores quality using a rubric (0-10 scale)
 * 3. If score < threshold (7/10), returns shouldIterate=true with feedback
 * 4. Caller (BaseAgent/OrchestrationService) handles the retry loop
 * 5. Hard cap at maxIterations (3) prevents runaway costs
 *
 * Design Decisions:
 * - Uses FirebaseAIService (not direct GoogleGenAI) for consistency
 * - Uses AI_MODELS.TEXT.FAST for evaluation (structured judgment task)
 * - Temperature 0.2 for consistent scoring
 * - Evaluation failure is non-blocking (accepts output on error)
 * - Preserves backward compat: reflect() / runLoop() still work
 */

import { AI_MODELS } from '@/core/config/ai-models';
import { FirebaseAIService } from '@/services/ai/FirebaseAIService';
import { logger } from '@/utils/logger';
import type { ReflectionResult, AgentContext } from '@/services/agent/types';

// ============================================================================
// Interfaces (backward compat + Phase 2)
// ============================================================================

interface ReflectionInput {
  originalPrompt: string;
  agentOutput: string;
  context?: Record<string, unknown>;
  previousReflections?: ReflectionIteration[];
}

interface QualityMetrics {
  correctness: number;
  clarity: number;
  completeness: number;
  overall: number;
}

interface ReflectionOutput {
  metrics: QualityMetrics;
  feedback: string;
  suggestedRefinement?: string;
  passesFinal: boolean;
}

export interface ReflectionIteration {
  iteration: number;
  input: string;
  output: string;
  reflection: ReflectionOutput;
  timestamp: number;
}

interface ReflectionLoopState {
  isRunning: boolean;
  currentIteration: number;
  maxIterations: number;
  qualityThreshold: number;
  iterations: ReflectionIteration[];
}

// ============================================================================
// Evaluation Rubric (Phase 2)
// ============================================================================

const EVALUATION_SYSTEM_PROMPT = `You are a quality evaluation critic for AI agent responses. Your job is to evaluate how well an agent response fulfills the original task.

## Scoring Rubric (0-10 scale):

**10 — Exceptional:** Response is complete, accurate, well-structured, and exceeds expectations.
**8-9 — Strong:** Response fulfills the task well with minor omissions or style issues.
**7 — Acceptable:** Response is adequate but could be improved in specificity or depth.
**5-6 — Weak:** Response is partially correct but has notable gaps, errors, or vague sections.
**3-4 — Poor:** Response is mostly incorrect, off-topic, or missing key requirements.
**1-2 — Failing:** Response is fundamentally wrong or irrelevant.
**0 — Empty/No Response.**

## Evaluation Criteria:

1. **Task Alignment:** Does the response address what was asked?
2. **Completeness:** Are all parts of the request covered?
3. **Accuracy:** Is the information correct and well-reasoned?
4. **Actionability:** Can the user act on this response?
5. **Tone & Style:** Is the response appropriately professional?

## Output Format:

You MUST respond with ONLY a JSON object (no markdown, no explanation):
{
  "score": <number 0-10>,
  "shouldIterate": <boolean>,
  "feedback": "<specific improvement suggestions if score < 7, otherwise 'PASS'>"
}`;

// ============================================================================
// Configuration
// ============================================================================

interface ReflectionConfig {
  /** Score threshold for Phase 2 evaluate() method (0-10 scale) */
  qualityThreshold: number;
  /** Maximum iterations (hard cap) */
  maxIterations: number;
  /** Maximum chars for the response to evaluate (truncate if longer) */
  maxResponseChars: number;
}

const DEFAULT_CONFIG: ReflectionConfig = {
  qualityThreshold: 7,
  maxIterations: 3,
  maxResponseChars: 8000,
};

// ============================================================================
// ReflectionLoop
// ============================================================================

export class ReflectionLoop {
  private state: ReflectionLoopState = {
    isRunning: false,
    currentIteration: 0,
    maxIterations: 3,
    qualityThreshold: 0.75,
    iterations: [],
  };
  private readonly config: ReflectionConfig;

  constructor(config?: Partial<ReflectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Phase 2: evaluate() — Returns structured ReflectionResult
  // ==========================================================================

  /**
   * Evaluate an agent's response against the original task.
   * Returns a structured ReflectionResult for the caller to act on.
   *
   * @param task           The original user request / task description
   * @param response       The agent's generated response text
   * @param iterationCount Which iteration this is (1-indexed)
   * @param _context       Optional AgentContext (reserved for future use)
   * @returns              ReflectionResult with score, feedback, and shouldIterate
   */
  async evaluate(
    task: string,
    response: string,
    iterationCount: number,
    _context?: AgentContext
  ): Promise<ReflectionResult> {
    // Hard cap check — never exceed maxIterations
    if (iterationCount >= this.config.maxIterations) {
      logger.debug(`[ReflectionLoop] Hit max iterations (${this.config.maxIterations}), forcing acceptance`);
      return {
        shouldIterate: false,
        score: -1,
        feedback: `Max iterations (${this.config.maxIterations}) reached. Accepting current output.`,
        iterationCount,
        maxIterations: this.config.maxIterations,
      };
    }

    // Truncate response if too long
    const truncatedResponse = response.length > this.config.maxResponseChars
      ? response.substring(0, this.config.maxResponseChars) + '\n[... truncated for evaluation]'
      : response;

    // Build evaluation prompt
    const evaluationPrompt = [
      `## Task Being Evaluated (Iteration ${iterationCount}):`,
      task,
      '',
      '## Agent Response:',
      truncatedResponse,
      '',
      'Evaluate this response using the rubric in your system prompt.',
      'Respond with ONLY the JSON object.',
    ].join('\n');

    try {
      const aiService = FirebaseAIService.getInstance();
      const genResult = await aiService.generateContent(
        evaluationPrompt,
        AI_MODELS.TEXT.FAST,
        {
          temperature: 0.2,
          maxOutputTokens: 200,
        },
        EVALUATION_SYSTEM_PROMPT
      );

      // Extract text from GenerateContentResult
      // The result has .response.candidates[0].content.parts[0].text
      // or .response.text() depending on SDK version
      const rawResponse = genResult?.response;
      let responseText = '';
      if (rawResponse) {
        // Try .text property/method first (newer SDK)
        if (typeof (rawResponse as unknown as { text: unknown }).text === 'function') {
          responseText = ((rawResponse as unknown as { text: () => string }).text)();
        } else {
          // Fallback to candidates traversal
          responseText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        }
      }

      const parsed = this.parseEvaluationJSON(responseText);

      const reflectionResult: ReflectionResult = {
        shouldIterate: parsed.shouldIterate && parsed.score < this.config.qualityThreshold,
        score: parsed.score,
        feedback: parsed.feedback,
        iterationCount,
        maxIterations: this.config.maxIterations,
      };

      logger.info(
        `[ReflectionLoop] Iteration ${iterationCount}: score=${reflectionResult.score}/10, ` +
        `threshold=${this.config.qualityThreshold}, shouldIterate=${reflectionResult.shouldIterate}`
      );

      return reflectionResult;
    } catch (error) {
      logger.error('[ReflectionLoop] Evaluation failed, accepting output:', error);
      return {
        shouldIterate: false,
        score: -1,
        feedback: `Evaluation error: ${error instanceof Error ? error.message : 'unknown'}. Accepting current output.`,
        iterationCount,
        maxIterations: this.config.maxIterations,
      };
    }
  }

  /**
   * Build an iteration prompt that incorporates reflection feedback.
   * Used by the caller to instruct the agent on its next iteration.
   */
  buildIterationPrompt(
    originalTask: string,
    previousResponse: string,
    reflectionResult: ReflectionResult
  ): string {
    return [
      '## REFLECTION FEEDBACK',
      '',
      `Your previous response scored ${reflectionResult.score}/10.`,
      `Iteration: ${reflectionResult.iterationCount}/${reflectionResult.maxIterations}`,
      '',
      '### Feedback:',
      reflectionResult.feedback,
      '',
      '### Original Task:',
      originalTask,
      '',
      '### Your Previous Response:',
      previousResponse.length > 2000
        ? previousResponse.substring(0, 2000) + '\n[... truncated]'
        : previousResponse,
      '',
      '### Instructions:',
      'Please revise your response addressing the feedback above. Focus on the specific improvements mentioned.',
      'Do NOT apologize or explain what changed. Just provide the improved response.',
    ].join('\n');
  }

  // ==========================================================================
  // Backward-Compatible Methods (Legacy API)
  // ==========================================================================

  /**
   * Run reflection on agent output using the legacy interface.
   * Delegates to evaluate() internally but returns the original format.
   */
  async reflect(input: ReflectionInput): Promise<ReflectionOutput> {
    try {
      const result = await this.evaluate(
        input.originalPrompt,
        input.agentOutput,
        this.state.currentIteration + 1
      );

      // Convert Phase 2 ReflectionResult to legacy ReflectionOutput
      const normalizedScore = result.score >= 0 ? result.score / 10 : 0;

      return {
        metrics: {
          correctness: normalizedScore,
          clarity: normalizedScore,
          completeness: normalizedScore,
          overall: normalizedScore,
        },
        feedback: result.feedback,
        suggestedRefinement: result.shouldIterate ? result.feedback : undefined,
        passesFinal: !result.shouldIterate,
      };
    } catch (error) {
      logger.error('[ReflectionLoop] Reflection failed', error);
      return {
        metrics: { correctness: 0, clarity: 0, completeness: 0, overall: 0 },
        feedback: 'Reflection failed',
        passesFinal: false,
      };
    }
  }

  /**
   * Run multi-turn reflection loop (legacy API).
   */
  async runLoop(
    originalPrompt: string,
    initialOutput: string,
    context?: Record<string, unknown>
  ): Promise<ReflectionIteration[]> {
    this.state = {
      isRunning: true,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      qualityThreshold: 0.75,
      iterations: [],
    };

    const currentOutput = initialOutput;
    let currentInput = originalPrompt;

    while (
      this.state.currentIteration < this.state.maxIterations &&
      this.state.isRunning
    ) {
      this.state.currentIteration++;

      const reflection = await this.reflect({
        originalPrompt: currentInput,
        agentOutput: currentOutput,
        context,
        previousReflections: this.state.iterations,
      });

      const iteration: ReflectionIteration = {
        iteration: this.state.currentIteration,
        input: currentInput,
        output: currentOutput,
        reflection,
        timestamp: Date.now(),
      };

      this.state.iterations.push(iteration);

      if (reflection.passesFinal) {
        logger.info(
          `[ReflectionLoop] Output passed quality threshold at iteration ${this.state.currentIteration}`
        );
        this.state.isRunning = false;
        break;
      }

      if (reflection.suggestedRefinement && this.state.currentIteration < this.state.maxIterations) {
        currentInput = reflection.suggestedRefinement;
      }
    }

    this.state.isRunning = false;
    return this.state.iterations;
  }

  /**
   * Get reflection state
   */
  getState(): ReflectionLoopState {
    return { ...this.state };
  }

  /**
   * Stop reflection loop
   */
  stop(): void {
    this.state.isRunning = false;
  }

  /**
   * Clear all iterations
   */
  reset(): void {
    this.state = {
      isRunning: false,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      qualityThreshold: 0.75,
      iterations: [],
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Parse evaluation model's JSON response.
   * Handles markdown wrapping, extra text, and malformed output.
   */
  private parseEvaluationJSON(raw: string): {
    score: number;
    shouldIterate: boolean;
    feedback: string;
  } {
    let jsonStr = raw.trim();

    // Try to extract JSON from markdown code block
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch?.[1]) {
      jsonStr = codeBlockMatch[1];
    }

    // Try to find raw JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) {
      jsonStr = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      const score = typeof parsed.score === 'number'
        ? Math.min(10, Math.max(0, Math.round(parsed.score)))
        : 5;

      const shouldIterate = typeof parsed.shouldIterate === 'boolean'
        ? parsed.shouldIterate
        : score < this.config.qualityThreshold;

      const feedback = typeof parsed.feedback === 'string'
        ? parsed.feedback
        : 'No specific feedback provided.';

      return { score, shouldIterate, feedback };
    } catch {
      logger.warn('[ReflectionLoop] Failed to parse evaluation JSON, extracting score manually');

      // Fallback: try to extract a score number from the raw text
      const scoreMatch = raw.match(/(?:"score"|score)\s*(?:[:=]|is)\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]!, 10) : 5;

      return {
        score,
        shouldIterate: score < this.config.qualityThreshold,
        feedback: `Could not parse structured feedback. Raw evaluation: ${raw.substring(0, 200)}`,
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let reflectionLoop: ReflectionLoop | null = null;

export function initializeReflectionLoop(): ReflectionLoop {
  if (!reflectionLoop) {
    reflectionLoop = new ReflectionLoop();
  }
  return reflectionLoop;
}

export function getReflectionLoop(): ReflectionLoop {
  if (!reflectionLoop) {
    reflectionLoop = new ReflectionLoop();
  }
  return reflectionLoop;
}
