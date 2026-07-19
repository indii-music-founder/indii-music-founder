import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';


interface WorkflowStepExecution {
    stepId: string;
    agentId: string;
    prompt?: string;
    status: 'PLANNED' | 'EXECUTING_GENERATION' | 'AWAITING_HUMAN' | 'AWAITING_EVALUATION' | 'STEP_COMPLETE' | 'SKIPPED' | 'FAILED' | 'CANCELLED';
    result?: string;
    error?: string;
}

interface WorkflowExecution {
    id: string;
    userId: string;
    status: 'PLANNED' | 'EXECUTING' | 'AWAITING_HUMAN' | 'AWAITING_EVALUATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    steps: Record<string, WorkflowStepExecution>;
}

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

            // Get Inngest Client
            const { inngest } = await import('../orchestration/inngest');

            try {
                // Fire an event to Inngest to handle the execution in the background
                await inngest.send({
                    name: 'workflow/step-started',
                    data: {
                        executionId: after.id,
                        userId: after.userId,
                        stepId: nextStep.stepId,
                        agentId: nextStep.agentId,
                        prompt: nextStep.prompt || 'Execute step'
                    }
                });
                
                logger.info(`[WorkflowOrchestrator] Successfully dispatched step ${nextStep.stepId} to Inngest`);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[WorkflowOrchestrator] Failed to dispatch step to Inngest`, error);
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
