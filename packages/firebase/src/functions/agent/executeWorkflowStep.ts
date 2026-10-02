import { Inngest } from 'inngest';
import * as admin from 'firebase-admin';
import { AgentTriad, AgentContext } from './AgentTriad';
import { DefaultPlanner, DefaultGenerator, DefaultEvaluator } from './DefaultAgents';
import { isCurrentWorkflowStepClaim } from './workflowExecutionGraph';

interface WorkflowStepPayload {
    executionId: string;
    userId: string;
    stepId: string;
    agentId: string;
    prompt: string;
    idempotencyKey: string;
}

export const executeWorkflowStepFn = (inngestClient: Inngest) => inngestClient.createFunction(
    { id: 'execute-workflow-step', retries: 2 },
    { event: 'workflow/step-started' },
    async ({ event, step }) => {
        const { executionId, userId, stepId, prompt, idempotencyKey } = event.data as WorkflowStepPayload;
        const db = admin.firestore();
        const ref = db.collection('users').doc(userId).collection('workflowExecutions').doc(executionId);
        const snapshot = await ref.get();
        if (!snapshot.exists || !isCurrentWorkflowStepClaim(snapshot.data() as { status: string; steps: Record<string, { status: string; idempotencyKey: string }> }, stepId, idempotencyKey)) {
            return { status: 'IGNORED_STALE_OR_CANCELLED' };
        }

        return await step.run('run-agent-triad', async () => {
            const triad = new AgentTriad({ planner: new DefaultPlanner(), generator: new DefaultGenerator(), evaluator: new DefaultEvaluator() });
            const context: AgentContext = { workflowId: executionId, stepId, userId };
            try {
                const truthfulPrompt = [
                    'You are a text-only planning assistant. You cannot inspect project files, accounts, assets, live metrics, or external sources, and you cannot execute tools or publish anything.',
                    'Produce only the requested written draft or plan. State missing evidence and assumptions; never claim an external action, audit, asset generation, or data analysis happened.',
                    `Task: ${prompt || 'Execute step'}`,
                ].join('\n\n');
                const result = await triad.executeTriadLoop(context, truthfulPrompt);
                const committed = await db.runTransaction(async tx => {
                    const fresh = await tx.get(ref);
                    if (!fresh.exists || !isCurrentWorkflowStepClaim(fresh.data() as { status: string; steps: Record<string, { status: string; idempotencyKey: string }> }, stepId, idempotencyKey)) return false;
                    const deleteField = admin.firestore.FieldValue.delete();
                    tx.update(ref, {
                        [`steps.${stepId}.status`]: result.status,
                        [`steps.${stepId}.result`]: result.result ?? deleteField,
                        [`steps.${stepId}.error`]: result.error ?? deleteField,
                        [`steps.${stepId}.completedAt`]: Date.now(),
                        updatedAt: Date.now(),
                    });
                    return true;
                });
                return committed ? result : { status: 'IGNORED_STALE_OR_CANCELLED' };
            } catch (cause) {
                const error = cause instanceof Error ? cause : new Error(String(cause));
                await db.runTransaction(async tx => {
                    const fresh = await tx.get(ref);
                    if (!fresh.exists || !isCurrentWorkflowStepClaim(fresh.data() as { status: string; steps: Record<string, { status: string; idempotencyKey: string }> }, stepId, idempotencyKey)) return;
                    tx.update(ref, {
                        [`steps.${stepId}.status`]: 'FAILED',
                        [`steps.${stepId}.result`]: admin.firestore.FieldValue.delete(),
                        [`steps.${stepId}.error`]: error.message,
                        [`steps.${stepId}.completedAt`]: Date.now(),
                        updatedAt: Date.now(),
                    });
                });
                throw error;
            }
        });
    },
);
