import { v4 as uuidv4 } from 'uuid';
import { 
    AgentLoopDefinition, 
    AgentLoopExecution, 
    AgentLoopStatusEnum,
    AgentLoopIteration,
    AgentLoopDefinitionSnapshot,
    AgentLoopActionCheckpointSchema,
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
class ExecutionBudgetCheckpointFailed extends Error {}
class EvaluationUnavailable extends Error {}
class InvalidEvaluationResponse extends EvaluationUnavailable {}

function requireConfiguredJudge(definition: AgentLoopDefinition): void {
    if (definition.judgeMode === 'DETERMINISTIC_TEST') {
        throw new Error('Deterministic loop evaluation is unavailable: no verifier is configured.');
    }
}

function snapshotDefinition(definition: AgentLoopDefinition): AgentLoopDefinitionSnapshot {
    return {
        id: definition.id,
        trigger: definition.trigger,
        goal: definition.goal,
        verifiabilityCriteria: definition.verifiabilityCriteria,
        judgeMode: definition.judgeMode,
        maxIterations: definition.maxIterations,
    };
}

function definitionMatches(snapshot: AgentLoopDefinitionSnapshot, definition: AgentLoopDefinition): boolean {
    return snapshot.id === definition.id &&
        snapshot.trigger === definition.trigger &&
        snapshot.goal === definition.goal &&
        snapshot.verifiabilityCriteria === definition.verifiabilityCriteria &&
        snapshot.judgeMode === definition.judgeMode &&
        snapshot.maxIterations === definition.maxIterations;
}

function resumableCheckpoint(execution: AgentLoopExecution) {
    const parsed = AgentLoopActionCheckpointSchema.safeParse(execution.actionCheckpoint);
    if (!parsed.success || parsed.data.iteration !== execution.currentIteration) return undefined;
    const checkpoint = parsed.data;
    if (checkpoint.phase === 'DISPATCHING') return undefined;
    if (checkpoint.phase === 'RESULT_RECORDED' && !checkpoint.output.trim()) return undefined;
    return checkpoint;
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

    private async persistExecution(
        userId: string | undefined,
        execution: AgentLoopExecution,
        requiredPhase?: 'before-dispatch' | 'after-action' | 'before-judge',
        tokenBudget?: ExecutionTokenBudget,
        createOnly = false,
    ): Promise<void> {
        if (tokenBudget) execution.tokenBudgetSpent = Math.max(execution.tokenBudgetSpent ?? 0, tokenBudget.spent);
        const save = async () => {
            if (!userId) throw new Error('A signed-in user is required to save a loop checkpoint.');
            const revision = await this.getService(userId).setIfRevision(
                execution.id, execution, 'checkpointRevision', createOnly ? null : execution.checkpointRevision ?? 0,
            );
            execution.checkpointRevision = revision;
        };
        if (requiredPhase) {
            if (!userId) throw new Error('A signed-in user is required to save the loop checkpoint before execution.');
            try {
                await save();
            } catch (error) {
                logger.warn(`[AgentLoop] Required checkpoint could not be saved for ${execution.id}:`, error);
                throw new Error(requiredPhase === 'before-dispatch'
                    ? 'Loop checkpoint could not be saved; no action was dispatched.'
                    : requiredPhase === 'after-action'
                        ? 'Action result checkpoint could not be saved; the action outcome requires reconciliation.'
                        : 'Token budget checkpoint could not be saved; no judge call was dispatched.');
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
            await save();
        } catch (error) {
            logger.warn(`[AgentLoop] Failed to persist execution ${execution.id} to Firestore:`, error);
        }
    }

    /**
     * Start a new loop based on the definition.
     */
    async startLoop(definition: AgentLoopDefinition, context: AgentContext): Promise<string> {
        requireConfiguredJudge(definition);
        if (!Number.isSafeInteger(definition.maxIterations) || definition.maxIterations < 1) {
            throw new Error('Loop iteration limit must be a positive safe integer.');
        }
        const executionId = uuidv4();
        
        const execution: AgentLoopExecution = {
            id: executionId,
            loopId: definition.id,
            definitionSnapshot: snapshotDefinition(definition),
            actionCheckpoint: { phase: 'READY', iteration: 1 },
            status: AgentLoopStatusEnum.enum.EXECUTING,
            currentIteration: 1,
            history: [],
            tokenBudgetSpent: executionTokenBudget(context, 1_500_000).spent,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.activeRuns.add(executionId);
        try {
            await this.persistExecution(context.userId, execution, 'before-dispatch', undefined, true);
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
    async getExecutionAsync(userId: string | undefined, executionId: string, refresh = false): Promise<AgentLoopExecution | null> {
        if (!userId) return null;
        const cached = this.executionStore.get(executionId);
        if (!refresh && cached && this.executionOwners.get(executionId) === userId) return cached;

        try {
            const service = this.getService(userId);
            const doc = await service.get(executionId, refresh);
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
            const execution = await this.getExecutionAsync(userId, executionId, true);
            if (!execution) {
                throw new Error(`Execution ${executionId} not found to resume`);
            }
            if (execution.id !== executionId) {
                throw new Error(`Execution ${executionId} has a mismatched saved checkpoint identity.`);
            }
            if (execution.loopId !== definition.id) {
                throw new Error(`Execution ${executionId} belongs to a different loop definition.`);
            }

            if (execution.status === AgentLoopStatusEnum.enum.COMPLETED) {
                logger.info(`[AgentLoop] Execution ${executionId} already completed.`);
                this.activeRuns.delete(executionId);
                return execution;
            }
            if (!execution.definitionSnapshot || !definitionMatches(execution.definitionSnapshot, definition)) {
                throw new Error(`Execution ${executionId} cannot resume because its saved loop definition is missing or has changed.`);
            }
            if (!Number.isSafeInteger(definition.maxIterations) || execution.currentIteration > definition.maxIterations) {
                throw new Error(`Execution ${executionId} has no iterations left to resume.`);
            }
            if (!resumableCheckpoint(execution)) {
                throw new Error(`Execution ${executionId} may have dispatched an action without a recorded result; reconcile its outcome before resuming.`);
            }
            if (execution.tokenBudgetSpent === undefined || !Number.isSafeInteger(execution.tokenBudgetSpent) || execution.tokenBudgetSpent < 0) {
                throw new Error(`Execution ${executionId} cannot resume without a valid saved token allowance.`);
            }

            logger.info(`[AgentLoop] Resuming execution ${executionId} from iteration ${execution.currentIteration}`);
            executionTokenBudget(context, 1_500_000).ensureSpentAtLeast(execution.tokenBudgetSpent);
            const resumedExecution: AgentLoopExecution = { ...execution, status: AgentLoopStatusEnum.enum.EXECUTING, updatedAt: Date.now() };
            delete resumedExecution.evaluationFailure;
            await this.persistExecution(userId, resumedExecution, 'before-dispatch', executionTokenBudget(context, 1_500_000));

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
            return executions.filter(execution => {
                const snapshot = execution.definitionSnapshot;
                const spent = execution.tokenBudgetSpent;
                return ['IDLE', 'EXECUTING', 'EVALUATING', 'FAILED'].includes(execution.status)
                    && !this.activeRuns.has(execution.id)
                    && snapshot !== undefined && snapshot.id === execution.loopId
                    && snapshot.judgeMode === 'LLM_EVALUATION'
                    && Number.isSafeInteger(snapshot.maxIterations)
                    && execution.currentIteration <= snapshot.maxIterations
                    && spent !== undefined && Number.isSafeInteger(spent) && spent >= 0
                    && Boolean(resumableCheckpoint(execution));
            });
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
            logger.info(`[AgentLoop] Iteration ${execution.currentIteration}/${definition.maxIterations} starting.`);
            const parsedCheckpoint = AgentLoopActionCheckpointSchema.safeParse(execution.actionCheckpoint);
            const checkpoint = parsedCheckpoint.success ? parsedCheckpoint.data : undefined;
            if (!checkpoint || checkpoint.iteration !== execution.currentIteration ||
                checkpoint.phase === 'DISPATCHING' ||
                (checkpoint.phase === 'RESULT_RECORDED' && !checkpoint.output.trim())) {
                execution.status = AgentLoopStatusEnum.enum.FAILED;
                execution.updatedAt = Date.now();
                await this.persistExecution(context.userId, execution, undefined, tokenBudget);
                return;
            }

            let prompt: string;
            let actionResult: string;
            if (checkpoint.phase === 'RESULT_RECORDED') {
                // A previous process already dispatched this action. Re-evaluate
                // its saved output without submitting the external effect again.
                prompt = checkpoint.prompt;
                actionResult = checkpoint.output;
            } else {
                prompt = this.buildIterationPrompt(definition, execution);
                execution.status = AgentLoopStatusEnum.enum.EXECUTING;
                execution.actionCheckpoint = { phase: 'DISPATCHING', iteration: execution.currentIteration, prompt };
                execution.updatedAt = Date.now();
                try {
                    await this.persistExecution(context.userId, execution, 'before-dispatch', tokenBudget);
                } catch (error) {
                    execution.actionCheckpoint = { phase: 'READY', iteration: execution.currentIteration };
                    execution.status = AgentLoopStatusEnum.enum.FAILED;
                    execution.updatedAt = Date.now();
                    await this.persistExecution(context.userId, execution, undefined, tokenBudget);
                    logger.warn(`[AgentLoop] Execution ${execution.id} stopped before dispatch:`, error);
                    return;
                }

                const action = await this.executeActionOnce(prompt, context);
                actionResult = action.output;
                if (action.failureKind) {
                    logger.warn(`[AgentLoop] Execution ${execution.id} halted after ${action.failureKind} action error: ${actionResult}`);
                    if (action.failureKind === 'non-transient') {
                        execution.history.push({
                            iteration: execution.currentIteration,
                            prompt,
                            output: actionResult,
                            feedback: `Action did not report success: ${actionResult}`,
                            passed: false,
                            timestamp: Date.now()
                        });
                    }
                    // A failed or timed-out action may still have produced an
                    // external effect. Keep DISPATCHING so resume cannot repeat it.
                    execution.status = AgentLoopStatusEnum.enum.FAILED;
                    execution.updatedAt = Date.now();
                    await this.persistExecution(context.userId, execution, undefined, tokenBudget);
                    return;
                }

                execution.actionCheckpoint = {
                    phase: 'RESULT_RECORDED', iteration: execution.currentIteration, prompt, output: actionResult,
                };
                execution.status = AgentLoopStatusEnum.enum.EVALUATING;
                execution.updatedAt = Date.now();
                try {
                    await this.persistExecution(context.userId, execution, 'after-action', tokenBudget);
                } catch (error) {
                    execution.actionCheckpoint = { phase: 'DISPATCHING', iteration: execution.currentIteration, prompt };
                    execution.status = AgentLoopStatusEnum.enum.FAILED;
                    execution.updatedAt = Date.now();
                    await this.persistExecution(context.userId, execution, undefined, tokenBudget);
                    logger.warn(`[AgentLoop] Execution ${execution.id} needs action outcome reconciliation:`, error);
                    return;
                }
            }

            // Evaluate only an action output that has a durable checkpoint.
            execution.status = AgentLoopStatusEnum.enum.EVALUATING;
            execution.updatedAt = Date.now();

            let evaluation: { passed: boolean; feedback: string };
            try {
                evaluation = await this.evaluateOutcome(definition, actionResult, tokenBudget, async () => {
                    try {
                        await this.persistExecution(context.userId, execution, 'before-judge', tokenBudget);
                    } catch (checkpointError) {
                        throw new ExecutionBudgetCheckpointFailed('Token budget checkpoint failed before judge call', { cause: checkpointError });
                    }
                });
            } catch (error) {
                if (!(error instanceof ExecutionTokenBudgetExceeded || error instanceof ExecutionBudgetCheckpointFailed || error instanceof EvaluationUnavailable)) throw error;
                execution.status = AgentLoopStatusEnum.enum.FAILED;
                execution.evaluationFailure = error.message;
                execution.updatedAt = Date.now();
                await this.persistExecution(context.userId, execution, undefined, tokenBudget);
                logger.warn(`[AgentLoop] Execution ${execution.id} halted: ${error.message}`);
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
                execution.actionCheckpoint = { phase: 'READY', iteration: execution.currentIteration };
            }
            await this.persistExecution(context.userId, execution, undefined, tokenBudget);
        }

        if (!isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.FAILED;
            logger.warn(`[AgentLoop] Execution ${execution.id} FAILED after reaching max iterations (${definition.maxIterations}).`);
        }

        execution.updatedAt = Date.now();
        await this.persistExecution(context.userId, execution, undefined, tokenBudget);
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

    private async executeActionOnce(
        prompt: string,
        context: AgentContext,
    ): Promise<{ output: string; failureKind: 'transient' | 'non-transient' | null }> {
        // A transport failure cannot prove whether an external effect happened.
        // Do not submit a second action until adapters provide idempotent receipts.
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
            if (results?.[0]?.success) {
                const output = results[0].message;
                return typeof output === 'string' && output.trim()
                    ? { output, failureKind: null }
                    : { output: 'Agent returned no evaluable output.', failureKind: 'non-transient' };
            }
            const errorMsg = results?.[0]?.error || 'Action failed.';
            return { output: errorMsg, failureKind: await this.resolveTransient(errorMsg, { retryAttempt: 1, action: 'executeBatch' })
                ? 'transient' : 'non-transient' };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return await this.resolveTransient(error, { retryAttempt: 1, action: 'executeBatch' })
                ? { output: `Infrastructure timeout/error: ${msg}`, failureKind: 'transient' }
                : { output: `Execution error: ${msg}`, failureKind: 'non-transient' };
        }
    }

    private async evaluateOutcome(definition: AgentLoopDefinition, agentOutput: string, tokenBudget: ExecutionTokenBudget, checkpointBudget: () => Promise<void>): Promise<{ passed: boolean, feedback: string }> {
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
            let actualTokens: number | undefined;
            try {
                await checkpointBudget();
                const result = await FirebaseIntelligenceService.getInstance().generateContent(
                    prompt,
                    INTELLIGENCE_MODELS.TEXT.FAST,
                    { temperature: 1.0, maxOutputTokens: 300 },
                    judgeInstruction
                );
                actualTokens = result?.response?.usageMetadata?.totalTokenCount;
                return result;
            } finally {
                tokenBudget.settle(reservation, actualTokens);
            }
        };

        try {
            const genResult = await generateJudge();

            return parseEvaluationResponse(genResult);
        } catch (error) {
            if (error instanceof ExecutionTokenBudgetExceeded || error instanceof ExecutionBudgetCheckpointFailed) throw error;
            if (error instanceof InvalidEvaluationResponse) {
                logger.warn('[AgentLoop] Judge returned an invalid verdict.');
                throw new InvalidEvaluationResponse('Evaluation returned an invalid verdict.');
            }
            logger.error('[AgentLoop] Evaluation error:', error);
            // If judge fails due to transient error, retry once
            if (await this.resolveTransient(error, { action: 'evaluateOutcome' })) {
                try {
                    await new Promise(r => setTimeout(r, 500));
                    const retryResult = await generateJudge();
                    return parseEvaluationResponse(retryResult);
                } catch (retryErr) {
                    if (retryErr instanceof ExecutionTokenBudgetExceeded || retryErr instanceof ExecutionBudgetCheckpointFailed) throw retryErr;
                    if (retryErr instanceof InvalidEvaluationResponse) {
                        logger.warn('[AgentLoop] Judge retry returned an invalid verdict.');
                        throw new InvalidEvaluationResponse('Evaluation returned an invalid verdict.');
                    }
                    logger.error('[AgentLoop] Evaluation retry also failed:', retryErr);
                }
            }
            throw new EvaluationUnavailable('Evaluation failed. Resume to evaluate the saved result.');
        }
    }
}

export const agentLoopService = new AgentLoopService();
