import type { ToolFunctionArgs, AgentContext } from '../types';

// ============================================================================
// Types for CoreTools
// ============================================================================
// Note: create_project, list_projects, open_project moved to ProjectTools
// Note: switch_module moved to NavigationTools

interface DelegateTaskArgs extends ToolFunctionArgs {
    agent_id: string;
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

// ============================================================================
// CoreTools Implementation
// ============================================================================

export const CoreTools = {
    delegate_task: async (args: DelegateTaskArgs): Promise<string> => {
        try {
            const { agentRegistry } = await import('../registry');
            const agent = agentRegistry.get(args.agent_id);

            if (!agent) {
                return `Error: Agent '${args.agent_id}' not found. Available: ${agentRegistry.listCapabilities()}`;
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
        // SAFETY: Auto-reject until UI approval flow is implemented
        // This prevents high-stakes actions from executing without real user confirmation
        console.warn('[CoreTools] request_approval called but UI not integrated - auto-rejecting for safety');
        return `[APPROVAL DENIED - SAFETY] Action "${args.content}" was automatically denied. The approval UI is not yet implemented. Please perform this action manually outside the agent system.`;
    },

    set_mode: async (args: SetModeArgs): Promise<string> => {
        return `Switched to ${args.mode} mode (Simulation).`;
    },

    update_prompt: async (args: UpdatePromptArgs): Promise<string> => {
        return `Prompt updated to: "${args.text}"`;
    }
};
