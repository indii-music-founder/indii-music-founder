import * as logger from 'firebase-functions/logger';

type WorkflowStepStatus = 'STEP_COMPLETE' | 'FAILED';

const WORKFLOW_STEP_STATUS = {
    STEP_COMPLETE: 'STEP_COMPLETE',
    FAILED: 'FAILED',
} as const;

export interface TriadResult {
    status: WorkflowStepStatus;
    result?: string;
    error?: string;
}

export interface AgentContext {
    workflowId: string;
    stepId: string;
    userId: string;
}

export interface EvaluationResult {
    passed: boolean;
    feedback?: string;
}

export interface PlannerAgent {
    plan(context: AgentContext, objective: string): Promise<string>;
}

export interface GeneratorAgent {
    generate(context: AgentContext, objective: string, plan: string, feedback?: string): Promise<string>;
}

export interface EvaluatorAgent {
    evaluate(context: AgentContext, objective: string, plan: string, result: string): Promise<EvaluationResult>;
}

export interface AgentTriadDependencies {
    planner: PlannerAgent;
    generator: GeneratorAgent;
    evaluator: EvaluatorAgent;
}

/**
 * AgentTriad Harness
 * Implements the Planner -> Generator -> Evaluator pattern.
 * This separates the "doer" from the "checker" to prevent agent overconfidence.
 */
export class AgentTriad {
    constructor(private readonly agents?: AgentTriadDependencies) {}

    /**
     * Executes the Triad Pattern:
     * 1. Planner defines the approach
     * 2. Generator attempts the work
     * 3. Evaluator checks the work against the plan
     */
    async executeTriadLoop(
        context: AgentContext,
        objective: string,
        maxRetries: number = 3
    ): Promise<TriadResult> {
        let retries = 0;
        let lastError: string | undefined;

        try {
            logger.info(`[AgentTriad] Starting Triad Loop for step ${context.stepId}`);

            // Step 1: Planning
            const plan = await this.invokePlanner(context, objective);
            logger.debug(`[AgentTriad] Plan created: ${plan.substring(0, 50)}...`);

            while (retries < maxRetries) {
                // Step 2: Generation
                logger.info(`[AgentTriad] Invoking Generator (Attempt ${retries + 1}/${maxRetries})`);
                const generationResult = await this.invokeGenerator(context, objective, plan, lastError);

                // Step 3: Evaluation
                logger.info(`[AgentTriad] Invoking Evaluator`);
                const evaluation = await this.invokeEvaluator(context, objective, plan, generationResult);

                if (evaluation.passed) {
                    logger.info(`[AgentTriad] Evaluation passed for step ${context.stepId}`);
                    return {
                        status: WORKFLOW_STEP_STATUS.STEP_COMPLETE,
                        result: generationResult
                    };
                }

                logger.warn(`[AgentTriad] Evaluation failed: ${evaluation.feedback}`);
                lastError = evaluation.feedback;
                retries++;
            }

            logger.error(`[AgentTriad] Triad loop failed after ${maxRetries} retries`);
            return {
                status: WORKFLOW_STEP_STATUS.FAILED,
                error: `Failed to pass evaluation after ${maxRetries} retries. Last feedback: ${lastError}`
            };

        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            logger.error(`[AgentTriad] Fatal error in triad loop`, error);
            return {
                status: WORKFLOW_STEP_STATUS.FAILED,
                error: error.message
            };
        }
    }

    private requireAgents(): AgentTriadDependencies {
        if (!this.agents) {
            throw new Error('AgentTriad requires configured planner, generator, and evaluator agents before execution.');
        }
        return this.agents;
    }

    private async invokePlanner(context: AgentContext, objective: string): Promise<string> {
        const plan = await this.requireAgents().planner.plan(context, objective);
        if (!plan.trim()) {
            throw new Error('Planner returned an empty plan.');
        }
        return plan;
    }

    private async invokeGenerator(context: AgentContext, objective: string, plan: string, feedback?: string): Promise<string> {
        const result = await this.requireAgents().generator.generate(context, objective, plan, feedback);
        if (!result.trim()) {
            throw new Error('Generator returned an empty result.');
        }
        return result;
    }

    private async invokeEvaluator(context: AgentContext, objective: string, plan: string, result: string): Promise<EvaluationResult> {
        const evaluation = await this.requireAgents().evaluator.evaluate(context, objective, plan, result);
        if (typeof evaluation.passed !== 'boolean') {
            throw new Error('Evaluator returned an invalid result; expected a boolean passed field.');
        }
        return evaluation;
    }
}
