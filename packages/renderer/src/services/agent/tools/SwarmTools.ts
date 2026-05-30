import { a2aClient, A2ATransportUnavailableError } from '../a2a/A2AClient';
import { AgentContext, ToolFunctionResult, VALID_AGENT_IDS } from '../types';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { logger } from '@/utils/logger';
import { validateHubAndSpoke } from '../types';
import { agentIdentityService } from '../governance/AgentIdentity';

/**
 * consult_specialist - A2A Swarm communication tool (canonical, single source of truth).
 * Enables an agent to securely consult another specialist agent using the A2A protocol.
 * Includes circuit-breaker fallback to in-process runAgent if A2A transport fails.
 */
export const consult_specialist = wrapTool(
    'consult_specialist',
    async (args: { targetAgentId?: string; agentId?: string; task: string; sharedContext?: string }, context?: AgentContext): Promise<ToolFunctionResult> => {
        // Normalize arg name: support both targetAgentId and agentId (deprecated)
        const targetAgentId = (args.targetAgentId || args.agentId) as string;
        const { task, sharedContext } = args;

        if (!targetAgentId) {
            return toolError('consult_specialist requires targetAgentId or agentId');
        }

        if (!context?.directive) {
            logger.warn(`[A2A:Consult] No active Directive in context for ${targetAgentId}`);
            return toolError(`Consultation with '${targetAgentId}' failed: No active Directive found. Digital Handshake requires a directive for security gating.`);
        }

        // Validate agent ID
        if (!(VALID_AGENT_IDS as readonly string[]).includes(targetAgentId)) {
            return toolError(`Invalid agent ID: ${targetAgentId}`);
        }

        // Validate hub-and-spoke (cast to valid AgentId type)
        const sourceAgentId = (context.agentIdentity?.agentId || 'unknown') as any;
        const hubSpokeError = validateHubAndSpoke(sourceAgentId, targetAgentId as any);
        if (hubSpokeError) {
            logger.warn(`[A2A:Consult] Hub-and-spoke violation: ${hubSpokeError}`);
            return toolError(hubSpokeError);
        }

        // GEAP: Record delegation provenance
        if (context.agentIdentity && agentIdentityService) {
            try {
                agentIdentityService.recordDelegation(
                    context.agentIdentity,
                    'consult_specialist',
                    targetAgentId,
                    context.traceId
                );
            } catch (e) {
                logger.debug(`[A2A:Consult] Failed to record GEAP provenance: ${e}`);
            }
        }

        // sourceAgentId is the REAL calling agent (e.g. 'generalist'), distinct from
        // the crypto reply channel. The router uses it for hub-and-spoke validation.
        const callerAgentId = context.agentIdentity?.agentId;
        const localCtx = context.runAgent ? {
            runAgent: context.runAgent,
            parentContext: context,
            traceId: context.traceId,
            streamAgent: context.streamAgent,
        } : undefined;

        // Streaming path (additive): when a live UI sink AND a streaming runner are
        // present, stream the specialist's deltas progressively into the user-facing
        // message. Any stream failure falls through to the invoke() path below.
        const canStream = typeof context.emitToken === 'function' && typeof context.streamAgent === 'function';
        if (canStream) {
            try {
                logger.info(`[A2A:Consult] ${sourceAgentId} -> ${targetAgentId} (streaming): ${task}`);
                let full = '';
                for await (const ev of a2aClient.stream(
                    targetAgentId,
                    'agent.execute',
                    { task, sharedContext, sourceAgentId: callerAgentId },
                    context.directive,
                    localCtx
                )) {
                    const e = ev as { type?: string; text?: string; done?: boolean };
                    if (e.type === 'error') throw new Error(e.text || 'A2A stream error');
                    if (e.text) {
                        full += e.text;
                        context.emitToken!(e.text); // progressive UI write
                    }
                    if (e.done) break;
                }
                return toolSuccess(
                    { text: full, agentId: targetAgentId },
                    `Consultation with ${targetAgentId} complete.`,
                    { transport: 'a2a-stream' }
                );
            } catch (streamError: any) {
                if (streamError.message?.includes('Digital Handshake approval')) {
                    return toolError(streamError.message, 'A2A_HANDSHAKE_PENDING');
                }
                logger.warn(`[A2A:Consult] Streaming failed, falling back to non-streaming invoke: ${streamError.message}`);
                // fall through to invoke() path
            }
        }

        try {
            logger.info(`[A2A:Consult] ${sourceAgentId} -> ${targetAgentId}: ${task}`);

            // A2A invocation with circuit breaker
            const result = await a2aClient.invoke(
                targetAgentId,
                'agent.execute',
                { task, sharedContext, sourceAgentId: callerAgentId },
                context.directive,
                localCtx
            );

            return toolSuccess(result, `Consultation with ${targetAgentId} complete.`);
        } catch (error: any) {
            logger.error(`[A2A:Consult] Error consulting ${targetAgentId}:`, error);

            // If it's a Digital Handshake pause, pass it through (no fallback)
            if (error.message?.includes('Digital Handshake approval')) {
                return toolError(error.message, 'A2A_HANDSHAKE_PENDING');
            }

            // If A2A transport is unavailable, fall back to in-process runAgent
            if (error instanceof A2ATransportUnavailableError && context.runAgent) {
                logger.warn(`[A2A:Consult] A2A transport unavailable, falling back to in-process delegation to ${targetAgentId}`);
                try {
                    const result = await context.runAgent(
                        targetAgentId,
                        task,
                        context,
                        context.traceId,
                        context.attachments
                    );
                    return toolSuccess(result, `Consultation with ${targetAgentId} complete (in-process fallback).`, {
                        transport: 'in-process-fallback',
                    });
                } catch (fallbackError: any) {
                    logger.error(`[A2A:Consult] In-process fallback failed:`, fallbackError);
                    return toolError(`Specialist consultation failed: ${fallbackError.message}`);
                }
            }

            return toolError(`Specialist consultation failed: ${error.message}`);
        }
    }
);

/**
 * seat_agent - Swarm seating tool.
 * Enables the Conductor to dynamically seat an agent at the boardroom table.
 */
export const seat_agent = wrapTool(
    'seat_agent',
    async (args: { targetAgentId: string }): Promise<ToolFunctionResult> => {
        const { targetAgentId } = args;
        const { useStore } = await import('@/core/store');
        const { VALID_AGENT_IDS } = await import('../types');

        if (!(VALID_AGENT_IDS as readonly string[]).includes(targetAgentId)) {
            return toolError(`Invalid agent ID "${targetAgentId}". Valid agent IDs are: ${VALID_AGENT_IDS.join(', ')}`);
        }

        try {
            useStore.getState().addActiveAgent(targetAgentId as any);
            logger.info(`[A2A:Swarm] Seated agent "${targetAgentId}" at the Boardroom table.`);
            return toolSuccess({ seated: true }, `Successfully seated the ${targetAgentId} agent in the Boardroom.`);
        } catch (error: any) {
            logger.error(`[A2A:Swarm] Failed to seat agent "${targetAgentId}":`, error);
            return toolError(`Failed to seat agent: ${error.message}`);
        }
    }
);

/**
 * unseat_agent - Swarm unseating tool.
 * Enables the Conductor to dynamically unseat/remove an agent from the boardroom table when they are no longer needed.
 */
export const unseat_agent = wrapTool(
    'unseat_agent',
    async (args: { targetAgentId: string }): Promise<ToolFunctionResult> => {
        const { targetAgentId } = args;
        const { useStore } = await import('@/core/store');
        const { VALID_AGENT_IDS } = await import('../types');

        if (!(VALID_AGENT_IDS as readonly string[]).includes(targetAgentId)) {
            return toolError(`Invalid agent ID "${targetAgentId}". Valid IDs: ${VALID_AGENT_IDS.join(', ')}`);
        }

        try {
            useStore.getState().removeActiveAgent(targetAgentId as any);
            logger.info(`[A2A:Swarm] Unseated agent "${targetAgentId}" from the Boardroom table.`);
            return toolSuccess({ unseated: true }, `Successfully unseated the ${targetAgentId} agent from the Boardroom.`);
        } catch (error: any) {
            logger.error(`[A2A:Swarm] Failed to unseat agent "${targetAgentId}":`, error);
            return toolError(`Failed to unseat agent: ${error.message}`);
        }
    }
);


