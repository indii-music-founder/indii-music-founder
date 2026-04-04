import { FirestoreService } from '../FirestoreService';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
    WorkflowExecution,
    WorkflowStepExecution,
    WorkflowExecutionStatus,
} from './types';
import type { WorkflowStep } from './WorkflowRegistry';

/**
 * WorkflowStateService — Persistent Workflow State Machine
 *
 * Agentic Harness Primitive #4: Workflow State Tracking
 *
 * Tracks the discrete execution state of multi-step workflows in Firestore
 * so that interrupted workflows can be resumed exactly where they left off
 * without duplicating completed steps.
 *
 * Stored under: `users/{userId}/workflowExecutions/{id}`
 */
class WorkflowStateServiceImpl {
    private getService(userId: string): FirestoreService<WorkflowExecution> {
        return new FirestoreService<WorkflowExecution>(`users/${userId}/workflowExecutions`);
    }

    /**
     * Create a new workflow execution record with all steps initialized as 'planned'.
     */
    async createExecution(
        userId: string,
        workflowId: string,
        steps: WorkflowStep[],
        sessionId?: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const id = uuidv4();
        const now = Date.now();

        const stepExecutions: WorkflowStepExecution[] = steps.map((step, index) => ({
            stepIndex: index,
            agentId: step.agentId,
            prompt: step.prompt,
            status: 'planned' as WorkflowExecutionStatus,
        }));

        const execution: WorkflowExecution = {
            id,
            workflowId,
            sessionId,
            userId,
            status: 'planned',
            steps: stepExecutions,
            currentStepIndex: 0,
            createdAt: now,
            updatedAt: now,
        };

        await service.set(id, execution);
        logger.info(`[WorkflowState] Created execution ${id} for workflow '${workflowId}' with ${steps.length} steps`);
        return execution;
    }

    /**
     * Mark a step as currently executing.
     */
    async markStepExecuting(
        userId: string,
        executionId: string,
        stepIndex: number
    ): Promise<void> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepIndex];
        if (!step) {
            throw new Error(`Step ${stepIndex} not found in execution ${executionId}`);
        }

        step.status = 'executing';
        step.startedAt = Date.now();
        execution.status = 'executing';
        execution.currentStepIndex = stepIndex;
        execution.updatedAt = Date.now();

        await service.set(executionId, execution);
        logger.debug(`[WorkflowState] Step ${stepIndex} (${step.agentId}) now executing`);
    }

    /**
     * Advance a step to 'step_complete' and persist the result.
     * If this was the last step, the entire workflow transitions to 'completed'.
     */
    async advanceStep(
        userId: string,
        executionId: string,
        stepIndex: number,
        result: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepIndex];
        if (!step) {
            throw new Error(`Step ${stepIndex} not found in execution ${executionId}`);
        }

        step.status = 'step_complete';
        step.result = result;
        step.completedAt = Date.now();
        execution.updatedAt = Date.now();

        // Check if all steps are complete
        const allComplete = execution.steps.every((s: WorkflowStepExecution) => s.status === 'step_complete');
        if (allComplete) {
            execution.status = 'completed';
            logger.info(`[WorkflowState] Execution ${executionId} fully completed`);
        } else {
            // Advance currentStepIndex to next planned step
            const nextPlanned = execution.steps.findIndex(
                (s: WorkflowStepExecution, i: number) => i > stepIndex && s.status === 'planned'
            );
            if (nextPlanned !== -1) {
                execution.currentStepIndex = nextPlanned;
            }
        }

        await service.set(executionId, execution);
        return execution;
    }

    /**
     * Mark a step as failed and set the workflow to 'failed'.
     * Subsequent planned steps remain untouched for resumability.
     */
    async failStep(
        userId: string,
        executionId: string,
        stepIndex: number,
        error: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepIndex];
        if (!step) {
            throw new Error(`Step ${stepIndex} not found in execution ${executionId}`);
        }

        step.status = 'failed';
        step.error = error;
        step.completedAt = Date.now();
        execution.status = 'failed';
        execution.updatedAt = Date.now();

        await service.set(executionId, execution);
        logger.warn(`[WorkflowState] Step ${stepIndex} (${step.agentId}) failed: ${error}`);
        return execution;
    }

    /**
     * Get a specific workflow execution by ID.
     */
    async getExecution(userId: string, executionId: string): Promise<WorkflowExecution | null> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        return execution || null;
    }

    /**
     * Find all non-terminal (resumable) workflow executions for a user.
     * Returns executions with status 'planned', 'executing', or 'failed' (can be retried).
     */
    async getResumableExecutions(userId: string): Promise<WorkflowExecution[]> {
        const service = this.getService(userId);
        const all = await service.list();
        return all.filter(e =>
            e.status === 'planned' ||
            e.status === 'executing' ||
            e.status === 'failed'
        );
    }

    /**
     * Cancel a workflow execution. Terminal state — cannot be resumed.
     */
    async cancelExecution(userId: string, executionId: string): Promise<void> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        execution.status = 'cancelled';
        execution.updatedAt = Date.now();

        // Cancel any planned/executing steps
        execution.steps.forEach((step: WorkflowStepExecution) => {
            if (step.status === 'planned' || step.status === 'executing') {
                step.status = 'cancelled';
                step.completedAt = Date.now();
            }
        });

        await service.set(executionId, execution);
        logger.info(`[WorkflowState] Execution ${executionId} cancelled`);
    }
}

export const workflowStateService = new WorkflowStateServiceImpl();
