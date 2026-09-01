import { FirestoreService } from '../FirestoreService';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
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
     * Operates within a Firestore atomic transaction.
     */
    async cancelExecution(userId: string, executionId: string): Promise<void> {
        const docRef = doc(db, 'users', userId, 'workflowExecutions', executionId);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Execution ${executionId} not found`);
            }
            const execution = snap.data() as WorkflowExecution;
            const now = Date.now();
            const updates: Record<string, unknown> = {
                status: WorkflowExecutionStatusEnum.enum.CANCELLED,
                updatedAt: now,
            };

            if (execution.steps) {
                Object.entries(execution.steps).forEach(([stepId, step]: [string, WorkflowStepExecution]) => {
                    if (
                        step.status === WorkflowStepStatusEnum.enum.PLANNED ||
                        step.status === WorkflowStepStatusEnum.enum.EXECUTING_GENERATION ||
                        step.status === WorkflowStepStatusEnum.enum.AWAITING_EVALUATION
                    ) {
                        updates[`steps.${stepId}.status`] = WorkflowStepStatusEnum.enum.CANCELLED;
                        updates[`steps.${stepId}.completedAt`] = now;
                    }
                });
            }

            tx.update(docRef, updates);
        });
        logger.info(`[WorkflowState] Execution ${executionId} cancelled`);
    }

    /**
     * Mark a step as currently executing.
     * Operates within a Firestore atomic transaction with an idempotency lock.
     */
    async markStepExecuting(
        userId: string,
        executionId: string,
        stepId: string
    ): Promise<void> {
        const docRef = doc(db, 'users', userId, 'workflowExecutions', executionId);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Execution ${executionId} not found`);
            }
            const execution = snap.data() as WorkflowExecution;
            const step = execution.steps?.[stepId];
            if (!step) {
                throw new Error(`Step ${stepId} not found in execution ${executionId}`);
            }

            if (step.status !== WorkflowStepStatusEnum.enum.PLANNED && step.status !== WorkflowStepStatusEnum.enum.FAILED) {
                throw new Error(`Step ${stepId} cannot be executed - currently ${step.status} (Idempotency Lock)`);
            }

            const now = Date.now();
            tx.update(docRef, {
                [`steps.${stepId}.status`]: WorkflowStepStatusEnum.enum.EXECUTING_GENERATION,
                [`steps.${stepId}.startedAt`]: now,
                status: WorkflowExecutionStatusEnum.enum.EXECUTING,
                updatedAt: now,
            });
        });
        logger.debug(`[WorkflowState] Step ${stepId} now executing`);
    }

    /**
     * Advance a step to WorkflowStepStatusEnum.enum.STEP_COMPLETE and persist the result.
     * If this was the last step, the entire workflow transitions to WorkflowExecutionStatusEnum.enum.COMPLETED.
     * Operates within a Firestore atomic transaction.
     *
     * ISSUE-571: If blockers are provided, the step fails instead of completing.
     * This enforces readiness gates: workflow steps cannot advance if the harness reports blockers.
     */
    async advanceStep(
        userId: string,
        executionId: string,
        stepId: string,
        result: string,
        blockers?: string[]
    ): Promise<WorkflowExecution> {
        const docRef = doc(db, 'users', userId, 'workflowExecutions', executionId);
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Execution ${executionId} not found`);
            }
            const execution = snap.data() as WorkflowExecution;
            const step = execution.steps?.[stepId];
            if (!step) {
                throw new Error(`Step ${stepId} not found in execution ${executionId}`);
            }

            const now = Date.now();

            // ISSUE-571: If readiness blockers exist, fail the step instead of completing it
            if (blockers && blockers.length > 0) {
                tx.update(docRef, {
                    [`steps.${stepId}.status`]: WorkflowStepStatusEnum.enum.FAILED,
                    [`steps.${stepId}.result`]: `Blocked by readiness: ${blockers.join('; ')}`,
                    [`steps.${stepId}.completedAt`]: now,
                    status: WorkflowExecutionStatusEnum.enum.FAILED,
                    updatedAt: now,
                });
                logger.warn(`[WorkflowState] Step ${stepId} failed due to readiness blockers: ${blockers.join(', ')}`);
                execution.steps[stepId] = {
                    ...step,
                    status: WorkflowStepStatusEnum.enum.FAILED,
                    result: `Blocked by readiness: ${blockers.join('; ')}`,
                    completedAt: now,
                };
                execution.status = WorkflowExecutionStatusEnum.enum.FAILED;
                execution.updatedAt = now;
                return this.normalizeExecution(execution);
            }

            const updatedSteps = { ...(execution.steps || {}) };
            updatedSteps[stepId] = {
                ...step,
                status: WorkflowStepStatusEnum.enum.STEP_COMPLETE,
                result,
                completedAt: now,
            };

            const allDone = Object.values(updatedSteps).every((s: WorkflowStepExecution) =>
                s.status === WorkflowStepStatusEnum.enum.STEP_COMPLETE || s.status === WorkflowStepStatusEnum.enum.SKIPPED
            );

            const newOverallStatus = allDone
                ? WorkflowExecutionStatusEnum.enum.COMPLETED
                : execution.status === WorkflowExecutionStatusEnum.enum.PLANNED
                    ? WorkflowExecutionStatusEnum.enum.EXECUTING
                    : execution.status;

            tx.update(docRef, {
                [`steps.${stepId}.status`]: WorkflowStepStatusEnum.enum.STEP_COMPLETE,
                [`steps.${stepId}.result`]: result,
                [`steps.${stepId}.completedAt`]: now,
                status: newOverallStatus,
                updatedAt: now,
            });

            execution.steps = updatedSteps;
            execution.status = newOverallStatus;
            execution.updatedAt = now;
            return this.normalizeExecution(execution);
        });
    }

    /**
     * Mark a step as skipped due to a failed condition.
     * Operates within a Firestore atomic transaction.
     */
    async skipStep(
        userId: string,
        executionId: string,
        stepId: string,
        reason?: string
    ): Promise<WorkflowExecution> {
        const docRef = doc(db, 'users', userId, 'workflowExecutions', executionId);
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Execution ${executionId} not found`);
            }
            const execution = snap.data() as WorkflowExecution;
            const step = execution.steps?.[stepId];
            if (!step) {
                throw new Error(`Step ${stepId} not found in execution ${executionId}`);
            }

            const now = Date.now();
            const updatedSteps = { ...(execution.steps || {}) };
            updatedSteps[stepId] = {
                ...step,
                status: WorkflowStepStatusEnum.enum.SKIPPED,
                result: reason,
                completedAt: now,
            };

            const allDone = Object.values(updatedSteps).every((s: WorkflowStepExecution) =>
                s.status === WorkflowStepStatusEnum.enum.STEP_COMPLETE || s.status === WorkflowStepStatusEnum.enum.SKIPPED
            );

            const newOverallStatus = allDone
                ? WorkflowExecutionStatusEnum.enum.COMPLETED
                : execution.status;

            tx.update(docRef, {
                [`steps.${stepId}.status`]: WorkflowStepStatusEnum.enum.SKIPPED,
                [`steps.${stepId}.result`]: reason,
                [`steps.${stepId}.completedAt`]: now,
                status: newOverallStatus,
                updatedAt: now,
            });

            execution.steps = updatedSteps;
            execution.status = newOverallStatus;
            execution.updatedAt = now;
            logger.info(`[WorkflowState] Step ${stepId} (${step.agentId}) skipped due to condition`);
            return this.normalizeExecution(execution);
        });
    }

    /**
     * Mark a step as failed and set the workflow to WorkflowExecutionStatusEnum.enum.FAILED.
     * Subsequent planned steps remain untouched for resumability.
     * Operates within a Firestore atomic transaction.
     */
    async failStep(
        userId: string,
        executionId: string,
        stepId: string,
        error: string
    ): Promise<WorkflowExecution> {
        const docRef = doc(db, 'users', userId, 'workflowExecutions', executionId);
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (!snap.exists()) {
                throw new Error(`Execution ${executionId} not found`);
            }
            const execution = snap.data() as WorkflowExecution;
            const step = execution.steps?.[stepId];
            if (!step) {
                throw new Error(`Step ${stepId} not found in execution ${executionId}`);
            }

            const now = Date.now();
            tx.update(docRef, {
                [`steps.${stepId}.status`]: WorkflowStepStatusEnum.enum.FAILED,
                [`steps.${stepId}.error`]: error,
                [`steps.${stepId}.completedAt`]: now,
                status: WorkflowExecutionStatusEnum.enum.FAILED,
                updatedAt: now,
            });

            execution.steps[stepId] = {
                ...step,
                status: WorkflowStepStatusEnum.enum.FAILED,
                error,
                completedAt: now,
            };
            execution.status = WorkflowExecutionStatusEnum.enum.FAILED;
            execution.updatedAt = now;
            logger.warn(`[WorkflowState] Step ${stepId} (${step.agentId}) failed: ${error}`);
            return this.normalizeExecution(execution);
        });
    }
}

export const workflowStateService = new WorkflowStateServiceImpl();
