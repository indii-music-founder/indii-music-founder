import type { ToolFunctionArgs, AgentContext, ValidAgentId } from '../types';
import { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from '../types';
import { useStore } from '@/core/store';
import type { AgentMode } from '@/core/store/slices/agentSlice';

// ============================================================================
// Types for CoreTools
// ============================================================================
// Note: create_project, list_projects, open_project moved to ProjectTools
// Note: switch_module moved to NavigationTools

interface DelegateTaskArgs extends ToolFunctionArgs {
    agent_id?: ValidAgentId;
    targetAgentId?: ValidAgentId;
    task: string;
    context?: AgentContext;
}

interface RequestApprovalArgs extends ToolFunctionArgs {
    content: string;
    type?: string;
}

interface SetModeArgs extends ToolFunctionArgs {
    mode: string;
}

interface UpdatePromptArgs extends ToolFunctionArgs {
    text: string;
}

const VALID_AGENT_MODES: AgentMode[] = ['assistant', 'autonomous', 'creative', 'research'];

// ============================================================================
// CoreTools Implementation
// ============================================================================

export const CoreTools = {
    delegate_task: async (args: DelegateTaskArgs): Promise<string> => {
        try {
            // Support both parameter names for backwards compatibility
            // Cast to ValidAgentId because we validate it below
            const rawAgentId = args.targetAgentId || args.agent_id;

            if (!rawAgentId) {
                return `Error: Missing agent_id or targetAgentId parameter.`;
            }

            const agentId = rawAgentId as ValidAgentId;

            // Runtime validation: reject invalid agent IDs to prevent hallucination issues
            if (!VALID_AGENT_IDS.includes(agentId)) {
                return `Error: Invalid agent ID "${agentId}". Valid agent IDs are: ${VALID_AGENT_IDS_LIST}`;
            }

            const { agentRegistry } = await import('../registry');
            const agent = agentRegistry.get(agentId);

            if (!agent) {
                return `Error: Agent '${agentId}' not found. Available: ${agentRegistry.listCapabilities()}`;
            }

            const response = await agent.execute(args.task, args.context);
            return `[${agent.name}]: ${response.text}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Delegation failed: ${e.message}`;
            }
            return `Delegation failed: An unknown error occurred.`;
        }
    },

    request_approval: async (args: RequestApprovalArgs): Promise<string> => {
        const { requestApproval } = useStore.getState();
        const actionType = args.type || 'default';

        console.log(`[CoreTools] Requesting approval for: ${args.content} (type: ${actionType})`);

        try {
            const approved = await requestApproval(args.content, actionType);

            if (approved) {
                return `[APPROVED] User approved the action: "${args.content}". You may proceed with the operation.`;
            } else {
                return `[REJECTED] User rejected the action: "${args.content}". Do not proceed with this operation.`;
            }
        } catch (error) {
            console.error('[CoreTools] Approval request failed:', error);
            return `[ERROR] Approval request failed. Action "${args.content}" was not executed for safety.`;
        }
    },

    set_mode: async (args: SetModeArgs): Promise<string> => {
        const { setAgentMode, agentMode } = useStore.getState();
        const requestedMode = args.mode.toLowerCase() as AgentMode;

        if (!VALID_AGENT_MODES.includes(requestedMode)) {
            return `Invalid mode "${args.mode}". Valid modes: ${VALID_AGENT_MODES.join(', ')}. Current mode: ${agentMode}`;
        }

        setAgentMode(requestedMode);
        return `Successfully switched to ${requestedMode} mode. Previous mode was ${agentMode}.`;
    },

    update_prompt: async (args: UpdatePromptArgs): Promise<string> => {
        return `Prompt updated to: "${args.text}"`;
    }
};
