/**
 * ReflectionLoop Service
 *
 * Enables agents to evaluate their own outputs and iteratively improve.
 * Implements multi-turn reflection with quality scoring and refinement.
 *
 * Architecture:
 * 1. Agent produces initial output
 * 2. Reflection evaluates quality (correctness, clarity, completeness)
 * 3. If quality < threshold, proposes refinement
 * 4. Agent refines based on feedback
 * 5. Loop continues or completes based on quality threshold
 */

import { logger } from '@/utils/logger';
import { GoogleGenAI } from '@google/genai';

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

interface ReflectionIteration {
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

export class ReflectionLoop {
  private genAI: GoogleGenAI | null = null;
  private state: ReflectionLoopState = {
    isRunning: false,
    currentIteration: 0,
    maxIterations: 3,
    qualityThreshold: 0.75,
    iterations: []
  };
  private initialized = false;

  async initialize(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_API_KEY not configured');
      }

      this.genAI = new GoogleGenAI({ apiKey });
      this.initialized = true;
      logger.info('[ReflectionLoop] Initialized');
    } catch (error) {
      logger.error('[ReflectionLoop] Initialization failed', error);
    }
  }

  /**
   * Run reflection loop on agent output
   */
  async reflect(input: ReflectionInput): Promise<ReflectionOutput> {
    try {
      if (!this.genAI || !this.initialized) {
        await this.initialize();
      }

      if (!this.genAI) {
        throw new Error('GenAI not initialized');
      }

      const reflectionPrompt = this.buildReflectionPrompt(input);

      const result = await this.genAI.models.generateContent({
        model: 'models/gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: reflectionPrompt }] }]
      });

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const reflection = this.parseReflectionResponse(responseText);

      logger.debug(
        `[ReflectionLoop] Reflection complete: quality=${reflection.metrics.overall.toFixed(2)}`
      );

      return reflection;
    } catch (error) {
      logger.error('[ReflectionLoop] Reflection failed', error);
      return {
        metrics: { correctness: 0, clarity: 0, completeness: 0, overall: 0 },
        feedback: 'Reflection failed',
        passesFinal: false
      };
    }
  }

  /**
   * Run multi-turn reflection loop
   */
  async runLoop(
    originalPrompt: string,
    initialOutput: string,
    context?: Record<string, unknown>
  ): Promise<ReflectionIteration[]> {
    this.state = {
      isRunning: true,
      currentIteration: 0,
      maxIterations: 3,
      qualityThreshold: 0.75,
      iterations: []
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
        previousReflections: this.state.iterations
      });

      const iteration: ReflectionIteration = {
        iteration: this.state.currentIteration,
        input: currentInput,
        output: currentOutput,
        reflection,
        timestamp: Date.now()
      };

      this.state.iterations.push(iteration);

      if (reflection.passesFinal) {
        logger.info(`[ReflectionLoop] Output passed quality threshold at iteration ${this.state.currentIteration}`);
        this.state.isRunning = false;
        break;
      }

      if (reflection.suggestedRefinement && this.state.currentIteration < this.state.maxIterations) {
        currentInput = reflection.suggestedRefinement;
        // In production, this would be sent back to the agent for refinement
        // For now, we track the iteration but don't auto-refine
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
      maxIterations: 3,
      qualityThreshold: 0.75,
      iterations: []
    };
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private buildReflectionPrompt(input: ReflectionInput): string {
    const contextStr = input.context ? JSON.stringify(input.context) : 'none';

    return `You are evaluating an AI agent's response. Analyze the following carefully:

Original Prompt: "${input.originalPrompt}"
Agent Output: "${input.agentOutput}"
Context: ${contextStr}

Rate this output on three dimensions (0.0-1.0):
1. Correctness: Does it accurately address the prompt?
2. Clarity: Is the response clear and well-structured?
3. Completeness: Does it cover all necessary aspects?

Respond in JSON format ONLY:
{
  "correctness": <number>,
  "clarity": <number>,
  "completeness": <number>,
  "feedback": "Brief assessment",
  "suggestedRefinement": "If quality < 0.75, suggest how to improve. Otherwise null.",
  "passesFinal": <true if overall >= 0.75, false otherwise>
}`;
  }

  private parseReflectionResponse(responseText: string): ReflectionOutput {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const correctness = Math.min(1, Math.max(0, parsed.correctness ?? 0));
      const clarity = Math.min(1, Math.max(0, parsed.clarity ?? 0));
      const completeness = Math.min(1, Math.max(0, parsed.completeness ?? 0));

      return {
        metrics: {
          correctness,
          clarity,
          completeness,
          overall: (correctness + clarity + completeness) / 3
        },
        feedback: parsed.feedback || 'No feedback provided',
        suggestedRefinement: parsed.suggestedRefinement || undefined,
        passesFinal: parsed.passesFinal ?? false
      };
    } catch (error) {
      logger.warn('[ReflectionLoop] Failed to parse response', error);
      return {
        metrics: { correctness: 0, clarity: 0, completeness: 0, overall: 0 },
        feedback: 'Failed to parse reflection',
        passesFinal: false
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let reflectionLoop: ReflectionLoop | null = null;

export async function initializeReflectionLoop(): Promise<ReflectionLoop> {
  if (!reflectionLoop) {
    reflectionLoop = new ReflectionLoop();
    await reflectionLoop.initialize();
  }
  return reflectionLoop;
}

export function getReflectionLoop(): ReflectionLoop {
  if (!reflectionLoop) {
    throw new Error('ReflectionLoop not initialized');
  }
  return reflectionLoop;
}
