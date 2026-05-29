import { auth, db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { TraceService } from '../observability/TraceService';
import {
    AgentRegistryProvider,
    AgentResponse,
    AgentProgressCallback,
    type ValidAgentId
} from '../types';
import { PipelineContext } from './ContextPipeline';
import { logger } from '@/utils/logger';
import { DelegationLoopDetector } from '../LoopDetector';
import { getFineTunedModel } from '../fine-tuned-models';

/**
 * AgentExecutor handles the low-level execution of a specific agent.
 * It manages tracing and context propagation for a specific agent.
 */
export class AgentExecutor {
    private registry: AgentRegistryProvider;

    constructor(registry: AgentRegistryProvider) {
        this.registry = registry;
    }

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
        onProgress?: AgentProgressCallback,
        signal?: AbortSignal,
        parentTraceId?: string,
        attachments?: { mimeType: string; base64: string }[]
    ): Promise<AgentResponse> {
        let agent = await this.registry.getAsync(agentId);

        if (!agent) {
            // Try lowercase version first (handle LLM casing hallucinations)
            if (agentId !== agentId.toLowerCase()) {
                const lowerId = agentId.toLowerCase();
                agent = await this.registry.getAsync(lowerId);
            }
        }

        if (!agent) {
            // Get diagnostic info about why the load failed
            const loadError = this.registry.getLoadError(agentId);
            const errorDetail = loadError
                ? `Last error: ${loadError.error.message} (${loadError.attempts} attempts)`
                : 'No error details available';

            logger.error(`[AgentExecutor] FATAL: Agent load failure diagnostic:`, {
                requestedAgentId: agentId,
                loadError,
                registeredAgents: this.registry.getAll().map(a => a.id)
            });

            throw new Error(`[AgentExecutor] Fatal: No agent found for ID '${agentId}'. ${errorDetail}`);
        }

        const isE2EMode = typeof window !== 'undefined' && ((window as any).FIREBASE_E2E_MOCK || localStorage.getItem('FIREBASE_E2E_MOCK'));
        const userId = auth.currentUser?.uid || (isE2EMode ? 'e2e-agent-user' : null);
        if (!userId) {
            throw new Error('[AgentExecutor] User must be authenticated to execute agents.');
        }

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
            const interceptedOnProgress: AgentProgressCallback = async (event) => {
                if (onProgress) onProgress(event);

                const currentModel = agent?.id ? getFineTunedModel(agent.id as ValidAgentId) : '';

                if (event.type === 'thought') {
                    await TraceService.addStep(traceId, 'thought', event.content);
                } else if (event.type === 'tool') {
                    await TraceService.addStep(traceId, 'tool_call', {
                        tool: event.toolName,
                        args: event.content
                    });
                    // Item 401: Stream tool progress to Firestore so UI can subscribe in real-time
                    if (!isE2EMode) {
                        setDoc(doc(db, 'agent_tasks', traceId, 'progress', String(Date.now())), {
                            type: 'tool_call',
                            toolName: event.toolName ?? null,
                            content: typeof event.content === 'string' ? event.content : null,
                            agentId: agent?.id ?? null,
                            timestamp: serverTimestamp(),
                        }, { merge: false }).catch(() => { /* best-effort */ });
                    }
                } else if (event.type === 'usage' && event.usage) {
                    await TraceService.addStepWithUsage(
                        traceId,
                        'thought', // Usage is usually associated with a thought/generation
                        'Token usage report',
                        currentModel,
                        {
                            promptTokenCount: event.usage.promptTokens,
                            candidatesTokenCount: event.usage.completionTokens,
                            totalTokenCount: event.usage.totalTokens
                        }
                    );
                }
            };

            const response = await agent.execute(userGoal, context, interceptedOnProgress, signal, attachments);

            // Sanitize response to remove functions before persistence
            const safeResponse = JSON.parse(JSON.stringify(response, (key, value) => {
                if (typeof value === 'function') return undefined; // Explicitly drop functions
                return value;
            }));

            await TraceService.completeTrace(traceId, safeResponse);
            return response;
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logger.error(`[AgentExecutor] Agent ${agent.name} failed:`, e);
            await TraceService.failTrace(traceId, errorMsg);
            throw e;
        } finally {
            // Cleanup delegation chain if this was the root call
            if (!parentTraceId) {
                DelegationLoopDetector.cleanup(context.swarmId || traceId);
            }
        }
    }
}
