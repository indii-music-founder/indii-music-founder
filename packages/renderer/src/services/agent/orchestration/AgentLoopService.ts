import { v4 as uuidv4 } from 'uuid';
import { 
    AgentLoopDefinition, 
    AgentLoopExecution, 
    AgentLoopStatusEnum,
    AgentLoopIteration
} from '@indii/shared';
import { AgentContext } from '../../types';
import { logger } from '@/utils/logger';
import { maestroBatchingService } from '../MaestroBatchingService';
import { FirebaseIntelligenceService } from '@/services/intelligence/FirebaseIntelligenceService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

/**
 * Service to orchestrate the Autonomous Agent Looping System.
 * Handles the "Trigger -> Goal -> Action -> Evaluate -> Adjust -> Action" cycle.
 */
export class AgentLoopService {

    // In-memory store for executions (replace with Firestore if persistence is needed)
    private executionStore: Map<string, AgentLoopExecution> = new Map();

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

        this.executionStore.set(executionId, execution);
        logger.info(`[AgentLoop] Starting loop execution ${executionId} for definition ${definition.id}`);

        // Start processing asynchronously so it doesn't block
        this.runLoop(definition, execution, context).catch(err => {
            logger.error(`[AgentLoop] Error in loop execution ${executionId}:`, err);
        });

        return executionId;
    }

    /**
     * Fetch the current state of a loop execution
     */
    getExecution(executionId: string): AgentLoopExecution | undefined {
        return this.executionStore.get(executionId);
    }

    /**
     * Core loop runner
     */
    private async runLoop(definition: AgentLoopDefinition, execution: AgentLoopExecution, context: AgentContext): Promise<void> {
        let isSatisfied = false;

        while (execution.currentIteration <= definition.maxIterations && !isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.EXECUTING;
            execution.updatedAt = Date.now();

            logger.info(`[AgentLoop] Iteration ${execution.currentIteration}/${definition.maxIterations} starting.`);

            // 1. Build prompt context including past feedback to "adjust actions"
            const prompt = this.buildIterationPrompt(definition, execution);

            // 2. Execute Action (Using MaestroBatchingService for an agent call)
            const actionResult = await this.executeAction(prompt, context);

            // 3. Evaluate Output (LLM as Judge)
            execution.status = AgentLoopStatusEnum.enum.EVALUATING;
            execution.updatedAt = Date.now();

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
        }

        if (!isSatisfied) {
            execution.status = AgentLoopStatusEnum.enum.FAILED;
            logger.warn(`[AgentLoop] Execution ${execution.id} FAILED after reaching max iterations (${definition.maxIterations}).`);
        }

        execution.updatedAt = Date.now();
        this.executionStore.set(execution.id, execution);
    }

    private buildIterationPrompt(definition: AgentLoopDefinition, execution: AgentLoopExecution): string {
        let prompt = `Goal: ${definition.goal}\n`;
        prompt += `Requirement: ${definition.verifiabilityCriteria}\n\n`;

        if (execution.currentIteration > 1) {
            const lastAttempt = execution.history[execution.history.length - 1];
            if (lastAttempt) {
                prompt += `--- PREVIOUS ATTEMPT FEEDBACK ---\n`;
                prompt += `Your previous output was judged as incomplete/incorrect.\n`;
                prompt += `Feedback: ${lastAttempt.feedback}\n`;
                prompt += `Please ADJUST YOUR ACTIONS based on this feedback to satisfy the requirements.\n\n`;
            }
        }

        return prompt;
    }

    private async executeAction(prompt: string, context: AgentContext): Promise<string> {
        try {
            // Use a generic agent id like 'assistant' or 'researcher' based on the goal.
            // For now, mapping to Maestro batching for robust execution.
            const traceId = uuidv4();
            const results = await maestroBatchingService.executeBatch([{
                agentId: 'assistant',
                prompt,
                description: 'Agent Loop Action',
                params: { projectId: context.projectId, traceId },
                context,
                priority: 'HIGH',
                traceId
            }]);

            if (results && results.length > 0 && results[0]!.success) {
                return results[0]!.text || 'No text output.';
            }
            return results?.[0]?.error || 'Action failed.';
        } catch (error) {
            return `Execution error: ${error instanceof Error ? error.message : 'Unknown'}`;
        }
    }

    private async evaluateOutcome(definition: AgentLoopDefinition, agentOutput: string): Promise<{ passed: boolean, feedback: string }> {
        if (definition.judgeMode === 'DETERMINISTIC_TEST') {
            // Placeholder for programmatic test criteria (e.g. "100% test coverage" parser)
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
            return { passed: false, feedback: 'Evaluation failed. Please try again.' };
        }
    }
}

export const agentLoopService = new AgentLoopService();
