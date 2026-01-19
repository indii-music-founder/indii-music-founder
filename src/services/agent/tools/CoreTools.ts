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
    // delegate_task REMOVED - Use BaseAgent.functions implementation instead
    // The BaseAgent version properly handles async agent loading and context passing
    // via AgentService.runAgent(). This prevents "agent not found" errors.

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
