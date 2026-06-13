import { Inngest } from 'inngest';
import * as admin from 'firebase-admin';
import { AgentTriad, AgentContext } from './AgentTriad';
import { DefaultPlanner, DefaultGenerator, DefaultEvaluator } from './DefaultAgents';

interface WorkflowStepPayload {
    executionId: string;
    userId: string;
    stepId: string;
    agentId: string;
    prompt: string;
}

export const executeWorkflowStepFn = (inngestClient: Inngest) => inngestClient.createFunction(
    { id: 'execute-workflow-step', retries: 2 },
    { event: 'workflow/step-started' },
    async ({ event, step }) => {
        const { executionId, userId, stepId, prompt } = event.data as WorkflowStepPayload;

        const result = await step.run('run-agent-triad', async () => {
            const db = admin.firestore();
            const triad = new AgentTriad({
                planner: new DefaultPlanner(),
                generator: new DefaultGenerator(),
                evaluator: new DefaultEvaluator()
            });

            const context: AgentContext = {
                workflowId: executionId,
                stepId,
                userId
            };

            try {
                const triadResult = await triad.executeTriadLoop(context, prompt || 'Execute step');
                
                await db
                    .collection('users').doc(userId)
                    .collection('workflowExecutions').doc(executionId)
                    .update({
                        [`steps.${stepId}.status`]: triadResult.status,
                        [`steps.${stepId}.result`]: triadResult.result || null,
                        [`steps.${stepId}.error`]: triadResult.error || null,
                        updatedAt: Date.now()
                    });
                    
                return triadResult;
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                await db
                    .collection('users').doc(userId)
                    .collection('workflowExecutions').doc(executionId)
                    .update({
                        [`steps.${stepId}.status`]: 'FAILED',
                        [`steps.${stepId}.error`]: error.message,
                        updatedAt: Date.now()
                    });
                throw error;
            }
        });

        return result;
    }
);
