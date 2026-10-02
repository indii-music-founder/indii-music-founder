import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { findReadyWorkflowStep, hasActiveWorkflowStep } from './workflowExecutionGraph';

interface WorkflowStepExecution {
    stepId: string;
    agentId: string;
    prompt?: string;
    status: 'PLANNED' | 'EXECUTING_GENERATION' | 'AWAITING_HUMAN' | 'AWAITING_EVALUATION' | 'STEP_COMPLETE' | 'SKIPPED' | 'FAILED' | 'CANCELLED';
    idempotencyKey: string;
    result?: string;
    error?: string;
}

interface WorkflowExecution {
    id: string;
    userId: string;
    status: 'PLANNED' | 'EXECUTING' | 'AWAITING_HUMAN' | 'AWAITING_EVALUATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    steps: Record<string, WorkflowStepExecution>;
    edges?: Array<{ from: string; to: string }>;
}

export const workflowOrchestrator = onDocumentWritten(
    { document: 'users/{userId}/workflowExecutions/{executionId}', region: 'us-central1', memory: '512MiB' },
    async event => {
        const snapshot = event.data;
        const after = snapshot?.after.data() as WorkflowExecution | undefined;
        if (!snapshot || !after) return;

        const ref = snapshot.after.ref;
        const db = admin.firestore();

        if (after.status === 'PLANNED') {
            await db.runTransaction(async tx => {
                const fresh = await tx.get(ref);
                if (fresh.exists && fresh.get('status') === 'PLANNED') tx.update(ref, { status: 'EXECUTING', updatedAt: Date.now() });
            });
            return;
        }
        if (after.status !== 'EXECUTING') return;

        const claimed = await db.runTransaction(async tx => {
            const fresh = await tx.get(ref);
            if (!fresh.exists || fresh.get('status') !== 'EXECUTING') return null;
            const execution = fresh.data() as WorkflowExecution;
            const steps = execution.steps ?? {};
            const ordered = Object.values(steps);
            const ready = findReadyWorkflowStep(steps, execution.edges ?? []);

            if (!ready) {
                const values = Object.values(steps);
                if (values.length > 0 && values.every(step => ['STEP_COMPLETE', 'SKIPPED'].includes(step.status))) {
                    tx.update(ref, { status: 'COMPLETED', updatedAt: Date.now() });
                } else if (values.some(step => step.status === 'FAILED') && !hasActiveWorkflowStep(ordered)) {
                    tx.update(ref, { status: 'FAILED', updatedAt: Date.now() });
                }
                return null;
            }
            const now = Date.now();
            tx.update(ref, {
                [`steps.${ready.stepId}.status`]: 'EXECUTING_GENERATION',
                [`steps.${ready.stepId}.startedAt`]: now,
                updatedAt: now,
            });
            return ready;
        });
        if (!claimed) return;

        const { inngest } = await import('../orchestration/inngest');
        try {
            await inngest.send({
                name: 'workflow/step-started',
                data: {
                    executionId: after.id,
                    userId: after.userId,
                    stepId: claimed.stepId,
                    agentId: claimed.agentId,
                    prompt: claimed.prompt || 'Execute step',
                    idempotencyKey: claimed.idempotencyKey,
                },
            });
        } catch (cause) {
            const error = cause instanceof Error ? cause : new Error(String(cause));
            logger.error('[WorkflowOrchestrator] Failed to dispatch step to Inngest', error);
            await db.runTransaction(async tx => {
                const fresh = await tx.get(ref);
                if (!fresh.exists || fresh.get('status') === 'CANCELLED' || fresh.get(`steps.${claimed.stepId}.idempotencyKey`) !== claimed.idempotencyKey) return;
                tx.update(ref, {
                    [`steps.${claimed.stepId}.status`]: 'FAILED',
                    [`steps.${claimed.stepId}.error`]: error.message,
                    updatedAt: Date.now(),
                });
            });
        }
    },
);
