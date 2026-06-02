import { FirestoreService } from '../FirestoreService';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
    WorkflowExecution,
    WorkflowStepExecution,
    WorkflowStep,
    WorkflowEdge,
} from './types';
import {
    WorkflowExecutionSchema,
    WorkflowExecutionStatusEnum,
    WorkflowStepStatusEnum
} from '@indii/shared';

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

    private normalizeExecution(execution: WorkflowExecution): WorkflowExecution {
        return WorkflowExecutionSchema.parse({
            edges: [],
            ...execution,
            steps: execution.steps || {},
        }) as WorkflowExecution;
    }

    private serializeEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
        return edges.map(({ from, to, label, metadata }) => ({
            from,
            to,
            ...(label ? { label } : {}),
            ...(metadata ? { metadata } : {}),
        }));
    }

    /**
     * Create a new workflow execution record with all steps initialized as WorkflowStepStatusEnum.enum.PLANNED.
     * DEFERRAL: This write will trigger the backend orchestrator to take over.
     */
    async createExecution(
        userId: string,
        workflowId: string,
        steps: WorkflowStep[],
        edges: WorkflowEdge[],
        sessionId?: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const id = uuidv4();
        const now = Date.now();

        const stepExecutions: Record<string, WorkflowStepExecution> = {};
        for (const step of steps) {
            stepExecutions[step.id] = {
                stepId: step.id,
                agentId: step.agentId,
                prompt: step.prompt,
                status: WorkflowStepStatusEnum.enum.PLANNED,
                idempotencyKey: uuidv4(),
            };
        }

        const execution: WorkflowExecution = {
            id,
            workflowId,
            sessionId,
            userId,
            status: WorkflowExecutionStatusEnum.enum.PLANNED,
            steps: stepExecutions,
            edges: this.serializeEdges(edges),
            createdAt: now,
            updatedAt: now,
        };

        await service.set(id, execution);
        logger.info(`[WorkflowState] Created execution ${id} for workflow '${workflowId}' with ${steps.length} steps and ${edges.length} edges`);
        return execution;
    }

    /**
     * Get all workflow executions for a specific user.
     */
    async getExecutionsByUser(userId: string): Promise<WorkflowExecution[]> {
        const service = this.getService(userId);
        const executions = await service.list();
        return executions.map(execution => this.normalizeExecution(execution));
    }

    /**
     * Get a specific workflow execution by ID.
     */
    async getExecution(userId: string, executionId: string): Promise<WorkflowExecution | null> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        return execution ? this.normalizeExecution(execution) : null;
    }

    /**
     * Find all non-terminal (resumable) workflow executions for a user.
     * Returns executions with status WorkflowStepStatusEnum.enum.PLANNED, WorkflowExecutionStatusEnum.enum.EXECUTING, or WorkflowExecutionStatusEnum.enum.FAILED (can be retried).
     */
    async getResumableExecutions(userId: string): Promise<WorkflowExecution[]> {
        const service = this.getService(userId);
        const all = await service.list();
        const executions = all.map(execution => this.normalizeExecution(execution));
        return executions.filter(e =>
            e.status === WorkflowExecutionStatusEnum.enum.PLANNED ||
            e.status === WorkflowExecutionStatusEnum.enum.EXECUTING ||
            e.status === WorkflowExecutionStatusEnum.enum.FAILED
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

        execution.status = WorkflowExecutionStatusEnum.enum.CANCELLED;
        execution.updatedAt = Date.now();

        // Cancel any planned/executing steps
        Object.values(execution.steps).forEach((step: WorkflowStepExecution) => {
            if (
                step.status === WorkflowStepStatusEnum.enum.PLANNED ||
                step.status === WorkflowStepStatusEnum.enum.EXECUTING_GENERATION ||
                step.status === WorkflowStepStatusEnum.enum.AWAITING_EVALUATION
            ) {
                step.status = WorkflowStepStatusEnum.enum.CANCELLED;
                step.completedAt = Date.now();
            }
        });

        await service.set(executionId, execution);
        logger.info(`[WorkflowState] Execution ${executionId} cancelled`);
    }

    /**
     * Mark a step as currently executing.
     */
    async markStepExecuting(
        userId: string,
        executionId: string,
        stepId: string
    ): Promise<void> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepId];
        if (!step) {
            throw new Error(`Step ${stepId} not found in execution ${executionId}`);
        }

        if (step.status !== WorkflowStepStatusEnum.enum.PLANNED && step.status !== WorkflowStepStatusEnum.enum.FAILED) {
            throw new Error(`Step ${stepId} cannot be executed - currently ${step.status} (Idempotency Lock)`);
        }

        step.status = WorkflowStepStatusEnum.enum.EXECUTING_GENERATION;
        step.startedAt = Date.now();
        execution.status = WorkflowExecutionStatusEnum.enum.EXECUTING;
        execution.updatedAt = Date.now();

        await service.set(executionId, execution);
        logger.debug(`[WorkflowState] Step ${stepId} (${step.agentId}) now executing`);
    }

    /**
     * Advance a step to WorkflowStepStatusEnum.enum.STEP_COMPLETE and persist the result.
     * If this was the last step, the entire workflow transitions to WorkflowExecutionStatusEnum.enum.COMPLETED.
     */
    async advanceStep(
        userId: string,
        executionId: string,
        stepId: string,
        result: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepId];
        if (!step) {
            throw new Error(`Step ${stepId} not found in execution ${executionId}`);
        }

        step.status = WorkflowStepStatusEnum.enum.STEP_COMPLETE;
        step.result = result;
        step.completedAt = Date.now();
        execution.updatedAt = Date.now();

        // Check if all steps are complete or skipped
        const allDone = Object.values(execution.steps).every((s: WorkflowStepExecution) =>
            s.status === WorkflowStepStatusEnum.enum.STEP_COMPLETE || s.status === WorkflowStepStatusEnum.enum.SKIPPED
        );
        if (allDone) {
            execution.status = WorkflowExecutionStatusEnum.enum.COMPLETED;
            logger.info(`[WorkflowState] Execution ${executionId} fully completed`);
        }

        await service.set(executionId, execution);
        return execution;
    }

    /**
     * Mark a step as skipped due to a failed condition.
     */
    async skipStep(
        userId: string,
        executionId: string,
        stepId: string,
        reason?: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepId];
        if (!step) {
            throw new Error(`Step ${stepId} not found in execution ${executionId}`);
        }

        step.status = WorkflowStepStatusEnum.enum.SKIPPED;
        step.result = reason;
        step.completedAt = Date.now();
        execution.updatedAt = Date.now();

        // Check if all steps are complete or skipped
        const allDone = Object.values(execution.steps).every((s: WorkflowStepExecution) =>
            s.status === WorkflowStepStatusEnum.enum.STEP_COMPLETE || s.status === WorkflowStepStatusEnum.enum.SKIPPED
        );
        if (allDone) {
            execution.status = WorkflowExecutionStatusEnum.enum.COMPLETED;
            logger.info(`[WorkflowState] Execution ${executionId} fully completed`);
        }

        await service.set(executionId, execution);
        logger.info(`[WorkflowState] Step ${stepId} (${step.agentId}) skipped due to condition`);
        return execution;
    }

    /**
     * Mark a step as failed and set the workflow to WorkflowExecutionStatusEnum.enum.FAILED.
     * Subsequent planned steps remain untouched for resumability.
     */
    async failStep(
        userId: string,
        executionId: string,
        stepId: string,
        error: string
    ): Promise<WorkflowExecution> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) {
            throw new Error(`Execution ${executionId} not found`);
        }

        const step = execution.steps[stepId];
        if (!step) {
            throw new Error(`Step ${stepId} not found in execution ${executionId}`);
        }

        step.status = WorkflowStepStatusEnum.enum.FAILED;
        step.error = error;
        step.completedAt = Date.now();
        execution.status = WorkflowExecutionStatusEnum.enum.FAILED;
        execution.updatedAt = Date.now();

        await service.set(executionId, execution);
        logger.warn(`[WorkflowState] Step ${stepId} (${step.agentId}) failed: ${error}`);
        return execution;
    }
}

export const workflowStateService = new WorkflowStateServiceImpl();
