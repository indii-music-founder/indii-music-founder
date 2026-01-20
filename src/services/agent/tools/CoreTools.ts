import type { AnyToolFunction } from '../types';
import { useStore } from '@/core/store';
import type { AgentMode } from '@/core/store/slices/agentSlice';
import { wrapTool, toolError } from '../utils/ToolUtils';

// ============================================================================
// Types for CoreTools
// ============================================================================

const VALID_AGENT_MODES: AgentMode[] = ['assistant', 'autonomous', 'creative', 'research'];

// ============================================================================
// CoreTools Implementation
// ============================================================================

export const CoreTools: Record<string, AnyToolFunction> = {
    delegate_task: wrapTool('delegate_task', async (args: {
        targetAgentId: string;
        task: string;
    }, context) => {
        const { agentService } = await import('../AgentService');
        const { toolError } = await import('../utils/ToolUtils');
        const { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } = await import('../types');
        const { DelegationLoopDetector } = await import('../LoopDetector');

        if (typeof args.targetAgentId !== 'string' || typeof args.task !== 'string') {
            return toolError('Invalid delegation parameters', 'INVALID_ARGS');
        }

        if (!VALID_AGENT_IDS.includes(args.targetAgentId as any)) {
            return toolError(
                `Invalid agent ID: "${args.targetAgentId}". Valid IDs are: ${VALID_AGENT_IDS_LIST}`,
                'INVALID_AGENT_ID'
            );
        }

        // Detect loops
        const traceId = context?.traceId || 'unknown';
        const delegationCheck = DelegationLoopDetector.recordDelegation(traceId, args.targetAgentId);
        if (delegationCheck.isLoop) {
            return toolError(
                `Cannot delegate: ${delegationCheck.reason}. Chain: ${delegationCheck.pattern}`,
                'DELEGATION_LOOP'
            );
        }

        const result = await agentService.runAgent(args.targetAgentId, args.task, context, context?.traceId, context?.attachments);
        return {
            success: true,
            data: result,
            message: `Delegated to ${args.targetAgentId}. Result: ${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}`
        };
    }),

    request_approval: wrapTool('request_approval', async (args: {
        content: string;
        type?: string;
    }) => {
        const { requestApproval } = useStore.getState();
        const actionType = args.type || 'default';

        console.info(`[CoreTools] Requesting approval for: ${args.content} (type: ${actionType})`);

        const approved = await requestApproval(args.content, actionType);

        if (approved) {
            return {
                approved: true,
                message: `[APPROVED] User approved the action: "${args.content}". You may proceed with the operation.`
            };
        } else {
            return {
                approved: false,
                message: `[REJECTED] User rejected the action: "${args.content}". Do not proceed with this operation.`
            };
        }
    }),

    set_mode: wrapTool('set_mode', async (args: { mode: string }) => {
        const { setAgentMode, agentMode } = useStore.getState();
        const requestedMode = args.mode.toLowerCase() as AgentMode;

        if (!VALID_AGENT_MODES.includes(requestedMode)) {
            return toolError(`Invalid mode "${args.mode}". Valid modes: ${VALID_AGENT_MODES.join(', ')}. Current mode: ${agentMode}`, "INVALID_MODE");
        }

        setAgentMode(requestedMode);
        return {
            previousMode: agentMode,
            newMode: requestedMode,
            message: `Successfully switched to ${requestedMode} mode. Previous mode was ${agentMode}.`
        };
    }),

    update_prompt: wrapTool('update_prompt', async (args: { text: string }) => {
        return {
            text: args.text,
            message: `Prompt updated to: "${args.text}"`
        };
    })
};
