import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import type { WorkflowExecution } from '@indii/shared';
import { AgentTriad } from './AgentTriad';
import { DefaultPlanner, DefaultGenerator, DefaultEvaluator } from './DefaultAgents';

/**
 * Workflow Orchestrator (Cloud Function)
 *
 * Agentic Harness Primitive: Event-Driven Dormancy
 * Listens for state changes to workflow executions and processes them asynchronously.
 * This allows the agent to "sleep" (consume 0 compute) while waiting for events
 * (e.g. human approval, external webhooks) and wake up only when the state transitions.
 */
export const workflowOrchestrator = onDocumentWritten(
    {
        document: 'users/{userId}/workflowExecutions/{executionId}',
        region: 'us-central1',
        // Optional: configure concurrency/memory for heavy agent workloads
        memory: '512MiB',
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            logger.info('No data associated with the event');
            return;
        }

        const after = snapshot.after.data() as WorkflowExecution | undefined;

        if (!after) {
            logger.info(`Workflow execution ${event.params.executionId} was deleted.`);
            return;
        }

        // 1. Check if the workflow was just planned (newly created) or resumed
        if (after.status === 'PLANNED') {
            logger.info(`[WorkflowOrchestrator] Starting newly planned workflow ${after.id}`);
            // Transition to EXECUTING
            await snapshot.after.ref.update({
                status: 'EXECUTING',
                updatedAt: Date.now()
            });
            return; // Exit and let the trigger fire again for the EXECUTING state
        }

        // 2. Check if we are actively executing
        if (after.status === 'EXECUTING') {
            logger.info(`[WorkflowOrchestrator] Processing EXECUTING workflow ${after.id}`);

            // Find the next planned step
            const steps = Object.values(after.steps || {});
            const nextStep = steps.find(s => s.status === 'PLANNED');

            if (!nextStep) {
                // Check if all steps are complete
                const allComplete = steps.every(s => s.status === 'STEP_COMPLETE' || s.status === 'SKIPPED');
                if (allComplete) {
                    logger.info(`[WorkflowOrchestrator] All steps complete for ${after.id}. Transitioning to COMPLETED.`);
                    await snapshot.after.ref.update({
                        status: 'COMPLETED',
                        updatedAt: Date.now()
                    });
                } else {
                    const hasFailed = steps.some(s => s.status === 'FAILED');
                    if (hasFailed) {
                        logger.error(`[WorkflowOrchestrator] Workflow ${after.id} has failed steps. Transitioning to FAILED.`);
                        await snapshot.after.ref.update({
                            status: 'FAILED',
                            updatedAt: Date.now()
                        });
                    } else {
                        logger.info(`[WorkflowOrchestrator] Workflow ${after.id} is waiting (e.g., AWAITING_HUMAN or AWAITING_EVALUATION). Sleeping.`);
                    }
                }
                return;
            }

            logger.info(`[WorkflowOrchestrator] Executing step ${nextStep.stepId} (${nextStep.agentId})`);

            // Transition step to EXECUTING_GENERATION
            await snapshot.after.ref.update({
                [`steps.${nextStep.stepId}.status`]: 'EXECUTING_GENERATION',
                [`steps.${nextStep.stepId}.startedAt`]: Date.now(),
                updatedAt: Date.now()
            });

            // Wire up the Triad with real AI agents
            const triad = new AgentTriad({
                planner: new DefaultPlanner(),
                generator: new DefaultGenerator(),
                evaluator: new DefaultEvaluator()
            });

            const context = {
                workflowId: after.id,
                stepId: nextStep.stepId,
                userId: after.userId
            };

            // Warning: Running this inline might hit Cloud Function timeouts for long tasks.
            // In a production system, this should be deferred to a background task runner like Inngest.
            try {
                const result = await triad.executeTriadLoop(context, nextStep.prompt || 'Execute step');

                await snapshot.after.ref.update({
                    [`steps.${nextStep.stepId}.status`]: result.status,
                    [`steps.${nextStep.stepId}.result`]: result.result || null,
                    [`steps.${nextStep.stepId}.error`]: result.error || null,
                    updatedAt: Date.now()
                });
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[WorkflowOrchestrator] Failed to execute Triad Loop`, error);
                await snapshot.after.ref.update({
                    [`steps.${nextStep.stepId}.status`]: 'FAILED',
                    [`steps.${nextStep.stepId}.error`]: error.message,
                    updatedAt: Date.now()
                });
            }
            return;
        }

        logger.info(`[WorkflowOrchestrator] No action needed for workflow ${after.id} in state ${after.status}`);
    }
);
