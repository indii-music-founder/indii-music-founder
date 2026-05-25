import { a2aClient } from '../a2a/A2AClient';
import { AgentContext, ToolFunctionResult } from '../types';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { logger } from '@/utils/logger';

/**
 * consult_specialist - A2A Swarm communication tool.
 * Enables an agent to securely consult another specialist agent using the A2A protocol.
 * This tool bridges the gap between the Hub-and-Spoke and Swarm architectures.
 */
export const consult_specialist = wrapTool(
    'consult_specialist',
    async (args: { agentId: string; task: string; sharedContext?: string }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { agentId, task, sharedContext } = args;

        if (!context?.directive) {
            logger.warn(`[A2A:Consult] Digital Handshake failed for ${agentId}: No active Directive in context.`);
            return toolError(`Consultation with '${agentId}' failed: No active Directive found in AgentContext. Digital Handshake requires a directive for security gating.`);
        }

        try {
            logger.info(`[A2A:Consult] ${context.agentIdentity?.agentId || 'agent'} -> ${agentId}: ${task}`);
            
            // In A2A, we treat the specialist as a JSON-RPC service.
            // The 'task' is mapped to the 'agent.execute' method of the peer agent.
            const result = await a2aClient.invoke(
                agentId,
                'agent.execute',
                { task, sharedContext },
                context.directive
            );

            return toolSuccess(result, `Consultation with ${agentId} complete.`);
        } catch (error: any) {
            logger.error(`[A2A:Consult] Error consulting ${agentId}:`, error);
            
            // If it's a Digital Handshake pause, we pass it through so the UI can handle the approval flow
            if (error.message?.includes('Digital Handshake approval')) {
                return toolError(error.message, 'A2A_HANDSHAKE_PENDING');
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


