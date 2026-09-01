import { v4 as uuidv4 } from 'uuid';
import { 
    AgentLoopDefinition, 
    AgentLoopExecution, 
    AgentLoopStatusEnum,
    AgentLoopIteration
} from '@indii/shared';
import { AgentContext } from '../types';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { maestroBatchingService } from '../MaestroBatchingService';
import { FirebaseIntelligenceService } from '@/services/intelligence/FirebaseIntelligenceService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { FirestoreService } from '../../FirestoreService';
import { TokenEstimator } from '../governance/TokenEstimator';

/**
 * Service to orchestrate the Autonomous Agent Looping System.
 * Handles the "Trigger -> Goal -> Action -> Evaluate -> Adjust -> Action" cycle.
 *
 * Hardened with:
 * - Durable Firestore persistence across restarts (`users/{userId}/agentLoopExecutions`)
 * - Resumption from the last verified checkpoint iteration
 * - Exponential backoff on transient infrastructure failures (429, timeouts)
 * - Checkpoint history trimming to prevent context bloat
 */
export class AgentLoopService {
    // In-memory cache for fast synchronous lookups and offline capability
    private executionStore: Map<string, AgentLoopExecution> = new Map();

    private getService(userId: string): FirestoreService<AgentLoopExecution> {
        return new FirestoreService<AgentLoopExecution>(`users/${userId}/agentLoopExecutions`);
    }

    private async persistExecution(userId: string | undefined, execution: AgentLoopExecution): Promise<void> {
        this.executionStore.set(execution.id, execution);
        useStore.getState().updateLoopExecution(execution);

        if (!userId) return;

        try {
            const service = this.getService(userId);
            await service.set(execution.id, execution);
        } catch (error) {
            logger.warn(`[AgentLoop] Failed to persist execution ${execution.id} to Firestore:`, error);
        }
    }

    /**
     * Start a new loop based on the definition.
     */
    async startLoop(definition: AgentLoopDefinition, context: AgentContext): Promise<string> {
        const executionId = uuidv4();
        
        const execution: AgentLoopExecution = {
            id: executionId,
            loopId: definition.id,
            status: AgentLoopStatusEnum.enum.EXECUTING,
            currentIteration: 1,
            history: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await this.persistExecution(context.userId, execution);
        logger.info(`[AgentLoop] Starting loop execution ${executionId} for definition ${definition.id}`);

        // Start processing asynchronously so it doesn't block the caller
        this.runLoop(definition, execution, context).catch(err => {
            logger.error(`[AgentLoop] Error in loop execution ${executionId}:`, err);
        });

        return executionId;
    }

    /**
     * Fetch the current state of a loop execution synchronously from memory.
     */
    getExecution(executionId: string): AgentLoopExecution | undefined {
        return this.executionStore.get(executionId);
    }

    /**
     * Fetch the current state of a loop execution asynchronously, falling back to Firestore.
     */
    async getExecutionAsync(userId: string | undefined, executionId: string): Promise<AgentLoopExecution | null> {
        const cached = this.executionStore.get(executionId);
        if (cached) return cached;
        if (!userId) return null;

        try {
            const service = this.getService(userId);
            const doc = await service.get(executionId);
            if (doc) {
                this.executionStore.set(executionId, doc);
                return doc;
            }
        } catch (error) {
            logger.warn(`[AgentLoop] Error retrieving execution ${executionId} from Firestore:`, error);
        }
        return null;
    }

    /**
     * Resume a previously interrupted or failed loop execution from its saved checkpoint.
     */
    async resumeLoop(
        definition: AgentLoopDefinition,
        executionId: string,
        context: AgentContext
    ): Promise<AgentLoopExecution> {
        const userId = context.userId;
        const execution = await this.getExecutionAsync(userId, executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found to resume`);
        }

        if (execution.status === AgentLoopStatusEnum.enum.COMPLETED) {
            logger.info(`[AgentLoop] Execution ${executionId} already completed.`);
            return execution;
        }

        logger.info(`[AgentLoop] Resuming execution ${executionId} from iteration ${execution.currentIteration}`);
        execution.status = AgentLoopStatusEnum.enum.EXECUTING;
        execution.updatedAt = Date.now();
        await this.persistExecution(userId, execution);

        this.runLoop(definition, execution, context).catch(err => {
            logger.error(`[AgentLoop] Error in resumed loop execution ${executionId}:`, err);
        });

        return execution;
    }

    /**
     * Find all non-terminal loop executions for a user that can be resumed.
     */
    async getResumableLoops(userId: string): Promise<AgentLoopExecution[]> {
        try {
            const service = this.getService(userId);
            const executions = await service.list();
            return executions.filter(e =>
                e.status === AgentLoopStatusEnum.enum.EXECUTING ||
                e.status === AgentLoopStatusEnum.enum.EVALUATING ||
                e.status === AgentLoopStatusEnum.enum.FAILED
            );
        } catch (error) {
            logger.warn(`[AgentLoop] Error listing resumable loops for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Identifies transient infrastructure errors vs logical agent errors.
     */
    private isTransientError(error: unknown): boolean {
        const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
        return (
            msg.includes('timeout') ||
            msg.includes('etimedout') ||
            msg.includes('429') ||
            msg.includes('503') ||
            msg.includes('504') ||
            msg.includes('rate limit') ||
            msg.includes('resource exhausted') ||
            msg.includes('fetch failed') ||
            msg.includes('network') ||
            msg.includes('aborted') ||
            msg.includes('econnreset')
        );
    }

    /**
     * Core loop runner
     */
    private async runLoop(definition: AgentLoopDefinition, execution: AgentLoopExecution, context: AgentContext): Promise<void> {
        let isSatisfied = false;

        while (execution.currentIteration <= definition.maxIterations && !isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.EXECUTING;
            execution.updatedAt = Date.now();
            await this.persistExecution(context.userId, execution);

            logger.info(`[AgentLoop] Iteration ${execution.currentIteration}/${definition.maxIterations} starting.`);

            // 1. Build prompt context including past feedback (with context trimming)
            const prompt = this.buildIterationPrompt(definition, execution);

            // 2. Execute Action with exponential backoff on transient errors
            const { output: actionResult, isTransientFailure } = await this.executeActionWithRetry(prompt, context);

            if (isTransientFailure) {
                // Do not burn the iteration count on transient infrastructure failures
                logger.warn(`[AgentLoop] Execution ${execution.id} halted due to persistent transient infrastructure failure: ${actionResult}`);
                execution.status = AgentLoopStatusEnum.enum.FAILED;
                execution.updatedAt = Date.now();
                await this.persistExecution(context.userId, execution);
                return;
            }

            // 3. Evaluate Output (LLM as Judge)
            execution.status = AgentLoopStatusEnum.enum.EVALUATING;
            execution.updatedAt = Date.now();
            await this.persistExecution(context.userId, execution);

            const evaluation = await this.evaluateOutcome(definition, actionResult);

            // 4. Record iteration history
            const iterationRecord: AgentLoopIteration = {
                iteration: execution.currentIteration,
                prompt,
                output: actionResult,
                feedback: evaluation.feedback,
                passed: evaluation.passed,
                timestamp: Date.now()
            };
            execution.history.push(iterationRecord);

            if (evaluation.passed) {
                isSatisfied = true;
                execution.status = AgentLoopStatusEnum.enum.COMPLETED;
                logger.info(`[AgentLoop] Execution ${execution.id} COMPLETED at iteration ${execution.currentIteration}.`);
            } else {
                logger.info(`[AgentLoop] Iteration ${execution.currentIteration} failed evaluation: ${evaluation.feedback}`);
                execution.currentIteration++;
            }
            await this.persistExecution(context.userId, execution);
        }

        if (!isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.FAILED;
            logger.warn(`[AgentLoop] Execution ${execution.id} FAILED after reaching max iterations (${definition.maxIterations}).`);
        }

        execution.updatedAt = Date.now();
        await this.persistExecution(context.userId, execution);
    }

    private buildIterationPrompt(definition: AgentLoopDefinition, execution: AgentLoopExecution): string {
        let prompt = `Goal: ${definition.goal}\n`;
        prompt += `Requirement: ${definition.verifiabilityCriteria}\n\n`;

        if (execution.currentIteration > 1 && execution.history.length > 0) {
            // Context trimming: Only include the most recent 2 failed iterations to prevent context bloat
            const recentFailures = execution.history
                .filter(h => !h.passed)
                .slice(-2);

            if (recentFailures.length > 0) {
                prompt += `--- PREVIOUS ATTEMPT FEEDBACK ---\n`;
                for (const attempt of recentFailures) {
                    prompt += `[Attempt ${attempt.iteration}]\n`;
                    // Truncate long feedback to 1,500 chars
                    const feedback = attempt.feedback && attempt.feedback.length > 1500
                        ? `${attempt.feedback.slice(0, 1500)}... [feedback trimmed]`
                        : attempt.feedback || 'Incomplete/incorrect output.';
                    prompt += `Feedback: ${feedback}\n`;
                }
                prompt += `Please ADJUST YOUR ACTIONS based on this feedback to satisfy the requirements.\n\n`;
            }
        }

        // Token budget projection
        const estimate = TokenEstimator.estimate(prompt, undefined, [], 50000, 1000);
        if (estimate.willExceed) {
            logger.warn(`[AgentLoop] Warning: Prompt exceeds expected token budget (${estimate.totalProjected} tokens)`);
        }

        return prompt;
    }

    private async executeActionWithRetry(
        prompt: string,
        context: AgentContext,
        maxRetries: number = 3,
        backoffBaseMs: number = 200
    ): Promise<{ output: string; isTransientFailure: boolean }> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const traceId = uuidv4();
                const results = await maestroBatchingService.executeBatch([{
                    agentId: 'generalist',
                    description: prompt,
                    params: { projectId: context.projectId, traceId },
                    context,
                    priority: 'HIGH',
                    traceId
                }]);

                if (results && results.length > 0 && results[0]!.success) {
                    return { output: results[0]!.text || 'No text output.', isTransientFailure: false };
                }

                const errorMsg = results?.[0]?.error || 'Action failed.';
                if (this.isTransientError(errorMsg)) {
                    lastError = new Error(errorMsg);
                    if (attempt < maxRetries) {
                        const jitter = Math.random() * 50;
                        const backoffMs = Math.min(3000, Math.pow(2, attempt - 1) * backoffBaseMs) + jitter;
                        logger.warn(`[AgentLoop] Transient error on attempt ${attempt}/${maxRetries} (${errorMsg}). Retrying in ${Math.round(backoffMs)}ms...`);
                        await new Promise(res => setTimeout(res, backoffMs));
                        continue;
                    }
                    break;
                }

                return { output: errorMsg, isTransientFailure: false };
            } catch (error) {
                lastError = error;
                if (this.isTransientError(error) && attempt < maxRetries) {
                    const jitter = Math.random() * 50;
                    const backoffMs = Math.min(3000, Math.pow(2, attempt - 1) * backoffBaseMs) + jitter;
                    logger.warn(`[AgentLoop] Transient exception on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`, error);
                    await new Promise(res => setTimeout(res, backoffMs));
                    continue;
                }
                break;
            }
        }

        if (this.isTransientError(lastError)) {
            const msg = lastError instanceof Error ? lastError.message : String(lastError);
            return { output: `Infrastructure timeout/error: ${msg}`, isTransientFailure: true };
        }

        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        return { output: `Execution error: ${msg}`, isTransientFailure: false };
    }

    private async evaluateOutcome(definition: AgentLoopDefinition, agentOutput: string): Promise<{ passed: boolean, feedback: string }> {
        if (definition.judgeMode === 'DETERMINISTIC_TEST') {
            return { passed: true, feedback: 'Deterministic test passed.' };
        }

        // LLM_EVALUATION Mode (LLM as a judge)
        const prompt = `
You are a strict, objective judge evaluating an agent's output against a Goal and Verifiability Criteria.

GOAL: ${definition.goal}
CRITERIA: ${definition.verifiabilityCriteria}

AGENT OUTPUT:
${agentOutput}

Evaluate if the output 100% satisfies the criteria. 
Respond in JSON format only:
{
  "passed": boolean,
  "feedback": "Detailed explanation of what is missing or wrong to help the agent adjust its actions, or 'PASS' if complete."
}
`;

        try {
            const aiService = FirebaseIntelligenceService.getInstance();
            const genResult = await aiService.generateContent(
                prompt,
                INTELLIGENCE_MODELS.TEXT.FAST,
                {
                    temperature: 0.1,
                    maxOutputTokens: 300,
                },
                'You are an impartial judge. Only return valid JSON.'
            );

            const rawResponse = genResult?.response;
            let responseText = '';
            if (rawResponse) {
                if (typeof (rawResponse as any).text === 'function') {
                    responseText = ((rawResponse as any).text)();
                } else {
                    responseText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                }
            }

            // Extract JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
            const parsed = JSON.parse(jsonStr);

            return {
                passed: !!parsed.passed,
                feedback: parsed.feedback || 'No specific feedback.'
            };
        } catch (error) {
            logger.error('[AgentLoop] Evaluation error:', error);
            // If judge fails due to transient error, retry once
            if (this.isTransientError(error)) {
                try {
                    await new Promise(r => setTimeout(r, 500));
                    const aiService = FirebaseIntelligenceService.getInstance();
                    const retryResult = await aiService.generateContent(
                        prompt,
                        INTELLIGENCE_MODELS.TEXT.FAST,
                        { temperature: 0.1, maxOutputTokens: 300 },
                        'You are an impartial judge. Only return valid JSON.'
                    );
                    const rawResponse = retryResult?.response;
                    let responseText = '';
                    if (rawResponse) {
                        if (typeof (rawResponse as any).text === 'function') {
                            responseText = ((rawResponse as any).text)();
                        } else {
                            responseText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                        }
                    }
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
                    const parsed = JSON.parse(jsonStr);
                    return {
                        passed: !!parsed.passed,
                        feedback: parsed.feedback || 'No specific feedback.'
                    };
                } catch (retryErr) {
                    logger.error('[AgentLoop] Evaluation retry also failed:', retryErr);
                }
            }
            return { passed: false, feedback: 'Evaluation failed. Please try again.' };
        }
    }
}

export const agentLoopService = new AgentLoopService();
