import { auth } from '@/services/firebase';
import { TraceService } from '../observability/TraceService';
import { agentRegistry } from '../registry';
import { PipelineContext } from './ContextPipeline';

export class AgentExecutor {
    constructor() { }

    async execute(agentId: string, userGoal: string, context: PipelineContext, onProgress?: (event: { type: string; content: string; toolName?: string }) => void) {
        // Try to get specific agent, or default to generalist
        let agent = agentRegistry.get(agentId);

        if (!agent) {
            console.warn(`[AgentExecutor] Agent '${agentId}' not found. Falling back to Generalist.`);
            agent = agentRegistry.get('generalist');
        }

        if (!agent) {
            throw new Error(`[AgentExecutor] Fatal: No agent found for ID '${agentId}' and no Generalist registered.`);
        }

        const userId = auth.currentUser?.uid || 'anonymous';
        const traceId = await TraceService.startTrace(userId, agent.id, userGoal, {
            context: {
                module: context.activeModule,
                project: context.projectHandle?.name
            }
        });

        try {
            // Intercept progress to log trace steps
            const interceptedOnProgress = async (event: { type: string; content: string; toolName?: string }) => {
                if (onProgress) onProgress(event);

                if (event.type === 'thought') {
                    await TraceService.addStep(traceId, 'thought', event.content);
                } else if (event.type === 'tool') {
                    await TraceService.addStep(traceId, 'tool_call', {
                        tool: event.toolName,
                        args: event.content // Assuming content is args string here, might differ
                    });
                }
            };

            const response = await agent.execute(userGoal, context, interceptedOnProgress);

            await TraceService.completeTrace(traceId, response);
            return response;
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[AgentExecutor] Agent ${agent.name} failed.`, e);
            await TraceService.failTrace(traceId, errorMsg);
            throw e;
        }
    }
}

