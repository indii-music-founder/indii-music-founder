import type { AnyToolFunction, AgentContext, ValidAgentId } from '../types';
import { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from '../types';
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
        agent_id?: ValidAgentId;
        targetAgentId?: ValidAgentId;
        task: string;
        context?: AgentContext;
    }) => {
        // Support both parameter names for backwards compatibility
        const rawAgentId = args.targetAgentId || args.agent_id;

        if (!rawAgentId) {
            return toolError("Missing agent_id or targetAgentId parameter.", "MISSING_ARG");
        }

        const agentId = rawAgentId as ValidAgentId;

        // Runtime validation: reject invalid agent IDs to prevent hallucination issues
        if (!VALID_AGENT_IDS.includes(agentId)) {
            return toolError(`Invalid agent ID "${agentId}". Valid agent IDs are: ${VALID_AGENT_IDS_LIST}`, "INVALID_AGENT_ID");
        }

        const { agentRegistry } = await import('../registry');
        const agent = agentRegistry.get(agentId);

        if (!agent) {
            return toolError(`Agent '${agentId}' not found. Available: ${agentRegistry.listCapabilities()}`, "AGENT_NOT_FOUND");
        }

        const response = await agent.execute(args.task, args.context);
        return {
            text: response.text,
            agentName: agent.name,
            message: `[${agent.name}]: ${response.text}`
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
