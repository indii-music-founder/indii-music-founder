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
import { heuristicTransientError, judgeTransientError } from '@/config/typesafeJudgments';
import { TokenEstimator } from '../governance/TokenEstimator';
import { executionTokenBudget, type ExecutionTokenBudget } from '../governance/ExecutionTokenBudget';

class ExecutionTokenBudgetExceeded extends Error {}
class InvalidEvaluationResponse extends Error {}

function requireConfiguredJudge(definition: AgentLoopDefinition): void {
    if (definition.judgeMode === 'DETERMINISTIC_TEST') {
        throw new Error('Deterministic loop evaluation is unavailable: no verifier is configured.');
    }
}

function parseEvaluationResponse(result: {
    response?: { text?: () => string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
}): { passed: boolean; feedback: string } {
    const response = result?.response;
    const text = typeof response?.text === 'function'
        ? response.text()
        : response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
        throw new InvalidEvaluationResponse('Agent loop judge returned invalid JSON.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        typeof (parsed as Record<string, unknown>).passed !== 'boolean' ||
        typeof (parsed as Record<string, unknown>).feedback !== 'string' ||
        !(parsed as { feedback: string }).feedback.trim()) {
        throw new InvalidEvaluationResponse('Agent loop judge returned an invalid verdict.');
    }
    return { passed: (parsed as { passed: boolean }).passed, feedback: (parsed as { feedback: string }).feedback.trim() };
}

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
    private executionOwners: Map<string, string> = new Map();
    private readonly activeRuns = new Set<string>();

    private getService(userId: string): FirestoreService<AgentLoopExecution> {
        return new FirestoreService<AgentLoopExecution>(`users/${userId}/agentLoopExecutions`);
    }

    private async persistExecution(userId: string | undefined, execution: AgentLoopExecution, requiredBeforeDispatch = false): Promise<void> {
        if (requiredBeforeDispatch) {
            if (!userId) throw new Error('A signed-in user is required to save the loop checkpoint before execution.');
            try {
                await this.getService(userId).set(execution.id, execution);
            } catch (error) {
                logger.warn(`[AgentLoop] Initial checkpoint could not be saved for ${execution.id}:`, error);
                throw new Error('Loop checkpoint could not be saved; no action was dispatched.');
            }
            this.executionStore.set(execution.id, execution);
            this.executionOwners.set(execution.id, userId);
            useStore.getState().updateLoopExecution(execution);
            return;
        }

        this.executionStore.set(execution.id, execution);
        if (userId) this.executionOwners.set(execution.id, userId);
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
        requireConfiguredJudge(definition);
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

        this.activeRuns.add(executionId);
        try {
            await this.persistExecution(context.userId, execution, true);
        } catch (error) {
            this.activeRuns.delete(executionId);
            throw error;
        }
        logger.info(`[AgentLoop] Starting loop execution ${executionId} for definition ${definition.id}`);

        // Start processing asynchronously so it doesn't block the caller
        void this.runLoop(definition, execution, context).catch(err => {
            logger.error(`[AgentLoop] Error in loop execution ${executionId}:`, err);
        }).finally(() => this.activeRuns.delete(executionId));

        return executionId;
    }

    /**
     * Fetch the current state of a user's loop execution synchronously from memory.
     */
    getExecution(userId: string, executionId: string): AgentLoopExecution | undefined {
        return this.executionOwners.get(executionId) === userId
            ? this.executionStore.get(executionId)
            : undefined;
    }

    /**
     * Fetch the current state of a loop execution asynchronously, falling back to Firestore.
     */
    async getExecutionAsync(userId: string | undefined, executionId: string): Promise<AgentLoopExecution | null> {
        if (!userId) return null;
        const cached = this.executionStore.get(executionId);
        if (cached && this.executionOwners.get(executionId) === userId) return cached;

        try {
            const service = this.getService(userId);
            const doc = await service.get(executionId);
            if (doc) {
                this.executionStore.set(executionId, doc);
                this.executionOwners.set(executionId, userId);
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
        requireConfiguredJudge(definition);
        if (this.activeRuns.has(executionId)) {
            throw new Error(`Execution ${executionId} is already running.`);
        }
        this.activeRuns.add(executionId);
        try {
            const userId = context.userId;
            const execution = await this.getExecutionAsync(userId, executionId);
            if (!execution) {
                throw new Error(`Execution ${executionId} not found to resume`);
            }
            if (execution.loopId !== definition.id) {
                throw new Error(`Execution ${executionId} belongs to a different loop definition.`);
            }

            if (execution.status === AgentLoopStatusEnum.enum.COMPLETED) {
                logger.info(`[AgentLoop] Execution ${executionId} already completed.`);
                this.activeRuns.delete(executionId);
                return execution;
            }

            logger.info(`[AgentLoop] Resuming execution ${executionId} from iteration ${execution.currentIteration}`);
            const resumedExecution: AgentLoopExecution = { ...execution, status: AgentLoopStatusEnum.enum.EXECUTING, updatedAt: Date.now() };
            await this.persistExecution(userId, resumedExecution, true);

            void this.runLoop(definition, resumedExecution, context).catch(err => {
                logger.error(`[AgentLoop] Error in resumed loop execution ${executionId}:`, err);
            }).finally(() => this.activeRuns.delete(executionId));

            return resumedExecution;
        } catch (error) {
            this.activeRuns.delete(executionId);
            throw error;
        }
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
     * Baseline: the deterministic keyword heuristic (constants module).
     * ISSUE-1442 pilot: the retry gate refines it with a TypeSafe Noul
     * judgment when the enable_typesafe_judgments flag is on; unavailable
     * judgments always fall back to the heuristic.
     */
    private async resolveTransient(
        error: unknown,
        context?: { retryAttempt?: number; action?: string }
    ): Promise<boolean> {
        const heuristic = heuristicTransientError(error);
        const refined = await judgeTransientError(error, heuristic, context);
        return refined ?? heuristic;
    }

    /**
     * Core loop runner
     */
    private async runLoop(definition: AgentLoopDefinition, execution: AgentLoopExecution, context: AgentContext): Promise<void> {
        let isSatisfied = false;
        // The same context is passed to every retry and iteration. The agent runner
        // inherits this ledger after cloning the context for delegated execution.
        const tokenBudget = executionTokenBudget(context, 1_500_000);

        while (execution.currentIteration <= definition.maxIterations && !isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.EXECUTING;
            execution.updatedAt = Date.now();
            await this.persistExecution(context.userId, execution);

            logger.info(`[AgentLoop] Iteration ${execution.currentIteration}/${definition.maxIterations} starting.`);

            // 1. Build prompt context including past feedback (with context trimming)
            const prompt = this.buildIterationPrompt(definition, execution);

            // 2. Execute Action with exponential backoff on transient errors
            const { output: actionResult, failureKind } = await this.executeActionWithRetry(prompt, context);

            if (failureKind) {
                logger.warn(`[AgentLoop] Execution ${execution.id} halted after ${failureKind} action error: ${actionResult}`);
                if (failureKind === 'non-transient') {
                    execution.history.push({
                        iteration: execution.currentIteration,
                        prompt,
                        output: actionResult,
                        feedback: `Action did not report success: ${actionResult}`,
                        passed: false,
                        timestamp: Date.now()
                    });
                }
                // Transient infrastructure failures do not burn an iteration.
                execution.status = AgentLoopStatusEnum.enum.FAILED;
                execution.updatedAt = Date.now();
                await this.persistExecution(context.userId, execution);
                return;
            }

            // 3. Evaluate Output (LLM as Judge)
            execution.status = AgentLoopStatusEnum.enum.EVALUATING;
            execution.updatedAt = Date.now();
            await this.persistExecution(context.userId, execution);

            let evaluation: { passed: boolean; feedback: string };
            try {
                evaluation = await this.evaluateOutcome(definition, actionResult, tokenBudget);
            } catch (error) {
                if (!(error instanceof ExecutionTokenBudgetExceeded)) throw error;
                execution.status = AgentLoopStatusEnum.enum.FAILED;
                execution.updatedAt = Date.now();
                await this.persistExecution(context.userId, execution);
                logger.warn(`[AgentLoop] Execution ${execution.id} halted: cumulative token allowance exhausted.`);
                return;
            }

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
    ): Promise<{ output: string; failureKind: 'transient' | 'non-transient' | null }> {
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
                    const output = results[0]!.message;
                    if (typeof output !== 'string' || !output.trim()) {
                        return { output: 'Agent returned no evaluable output.', failureKind: 'non-transient' };
                    }
                    return { output, failureKind: null };
                }

                const errorMsg = results?.[0]?.error || 'Action failed.';
                if (await this.resolveTransient(errorMsg, { retryAttempt: attempt, action: 'executeBatch' })) {
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

                return { output: errorMsg, failureKind: 'non-transient' };
            } catch (error) {
                lastError = error;
                if (await this.resolveTransient(error, { retryAttempt: attempt, action: 'executeBatch' }) && attempt < maxRetries) {
                    const jitter = Math.random() * 50;
                    const backoffMs = Math.min(3000, Math.pow(2, attempt - 1) * backoffBaseMs) + jitter;
                    logger.warn(`[AgentLoop] Transient exception on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`, error);
                    await new Promise(res => setTimeout(res, backoffMs));
                    continue;
                }
                break;
            }
        }

        if (lastError && (await this.resolveTransient(lastError, { action: 'executeBatchExhausted' }))) {
            const msg = lastError instanceof Error ? lastError.message : String(lastError);
            return { output: `Infrastructure timeout/error: ${msg}`, failureKind: 'transient' };
        }

        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        return { output: `Execution error: ${msg}`, failureKind: 'non-transient' };
    }

    private async evaluateOutcome(definition: AgentLoopDefinition, agentOutput: string, tokenBudget: ExecutionTokenBudget): Promise<{ passed: boolean, feedback: string }> {
        requireConfiguredJudge(definition);

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

        const judgeInstruction = 'You are an impartial judge. Only return valid JSON.';
        const generateJudge = async () => {
            const estimate = TokenEstimator.estimate(prompt, judgeInstruction, [], 1_500_000, 300);
            const reservation = estimate.willExceed ? null : tokenBudget.reserve(estimate.totalProjected);
            if (reservation === null) throw new ExecutionTokenBudgetExceeded();
            const result = await FirebaseIntelligenceService.getInstance().generateContent(
                prompt,
                INTELLIGENCE_MODELS.TEXT.FAST,
                { temperature: 0.1, maxOutputTokens: 300 },
                judgeInstruction
            );
            tokenBudget.settle(reservation, result?.response?.usageMetadata?.totalTokenCount);
            return result;
        };

        try {
            const genResult = await generateJudge();

            return parseEvaluationResponse(genResult);
        } catch (error) {
            if (error instanceof ExecutionTokenBudgetExceeded) throw error;
            if (error instanceof InvalidEvaluationResponse) {
                logger.warn('[AgentLoop] Judge returned an invalid verdict.');
                return { passed: false, feedback: 'Evaluation returned an invalid verdict.' };
            }
            logger.error('[AgentLoop] Evaluation error:', error);
            // If judge fails due to transient error, retry once
            if (await this.resolveTransient(error, { action: 'evaluateOutcome' })) {
                try {
                    await new Promise(r => setTimeout(r, 500));
                    const retryResult = await generateJudge();
                    return parseEvaluationResponse(retryResult);
                } catch (retryErr) {
                    if (retryErr instanceof ExecutionTokenBudgetExceeded) throw retryErr;
                    if (retryErr instanceof InvalidEvaluationResponse) {
                        logger.warn('[AgentLoop] Judge retry returned an invalid verdict.');
                        return { passed: false, feedback: 'Evaluation returned an invalid verdict.' };
                    }
                    logger.error('[AgentLoop] Evaluation retry also failed:', retryErr);
                }
            }
            return { passed: false, feedback: 'Evaluation failed. Please try again.' };
        }
    }
}

export const agentLoopService = new AgentLoopService();
