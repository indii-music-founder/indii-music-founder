import { auth } from '@/services/firebase';
import { TraceService } from '../observability/TraceService';
import { agentRegistry } from '../registry';
import { PipelineContext } from './ContextPipeline';
import { AgentResponse } from '../types';

/**
 * AgentExecutor handles the low-level execution of a specific agent.
 * It manages tracing, context propagation, and agent fallback logic.
 */
export class AgentExecutor {
    constructor() { }

    /**
     * Executes the requested agent with the provided context and observability tracing.
     * @param agentId The ID of the agent to execute.
     * @param userGoal The user's goal or prompt.
     * @param context The resolved pipeline context.
     * @param onProgress Callback for streaming progress events.
     * @param signal AbortSignal for cancellation.
     * @param parentTraceId Optional trace ID for observability chaining.
     * @param attachments Optional file attachments.
     */
    async execute(
        agentId: string,
        userGoal: string,
        context: PipelineContext,
        onProgress?: (event: { type: string; content: string; toolName?: string }) => void,
        signal?: AbortSignal,
        parentTraceId?: string,
        attachments?: { mimeType: string; base64: string }[]
    ): Promise<AgentResponse> {
        // Try to get specific agent, or default to generalist
        let agent = await agentRegistry.getAsync(agentId);

        if (!agent) {
            console.warn(`[AgentExecutor] Agent '${agentId}' not found. Falling back to Generalist.`);
            agent = await agentRegistry.getAsync('generalist');
        }

        if (!agent) {
            throw new Error(`[AgentExecutor] Fatal: No agent found for ID '${agentId}' and fallback Generalist failed to load.`);
        }

        const userId = auth.currentUser?.uid || 'anonymous';

        // Propagate swarmId (highest level traceId)
        const swarmId = parentTraceId ? context.swarmId || parentTraceId : null;

        const traceId = await TraceService.startTrace(userId, agent.id, userGoal, {
            context: {
                module: context.activeModule,
                project: context.projectHandle?.name
            },
            swarmId: swarmId
        }, parentTraceId);

        context.swarmId = swarmId || traceId;
        context.traceId = traceId;
        context.attachments = attachments;

        try {
            // Check for aborted signal before starting
            if (signal?.aborted) {
                throw new Error('Operation cancelled');
            }

            // Intercept progress to log trace steps
            const interceptedOnProgress = async (event: { type: string; content: string; toolName?: string }) => {
                if (onProgress) onProgress(event);

                if (event.type === 'thought') {
                    await TraceService.addStep(traceId, 'thought', event.content);
                } else if (event.type === 'tool') {
                    await TraceService.addStep(traceId, 'tool_call', {
                        tool: event.toolName,
                        args: event.content
                    });
                }
            };

            const response = await agent.execute(userGoal, context, interceptedOnProgress, signal, attachments);

            await TraceService.completeTrace(traceId, response);
            return response;
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[AgentExecutor] Agent ${agent.name} failed:`, e);
            await TraceService.failTrace(traceId, errorMsg);
            throw e;
        }
    }
}

