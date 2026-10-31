import { auth } from '@/services/firebase';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const FoundationalTools = {
    /**
     * Scans the INDII agent directory to map the current state and capabilities.
     * Use this to audit existing agents and prevent redundant tool creation.
     */
    audit_architecture: wrapTool('audit_architecture', async () => {
        try {
            const result = await window.electronAPI!.agent.scanDirectory();
            if (result.success) {
                return toolSuccess(result.data, "Architecture audit complete. Map retrieved.");
            } else {
                return toolError(result.error || "Failed to scan directory", "AUDIT_FAILED");
            }
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : String(error), "AUDIT_ERROR");
        }
    }),

    /** Saves a signed-in user's local agent preferences for future desktop sessions. */
    update_agent_memory: wrapTool('update_agent_memory', async (args: {
        agentId: string,
        action: 'add' | 'remove',
        knowledge: string
    }) => {
        try {
            // Construct path based on agentId
            const filePath = `agents/${args.agentId}/instructions.md`;
            
            const user = auth.currentUser;
            if (!user) return toolError('Sign in before saving local agent knowledge.', 'AUTH_REQUIRED');
            const idToken = await user.getIdToken();
            if (auth.currentUser?.uid !== user.uid) return toolError('Account changed before saving local agent knowledge.', 'AUTH_CHANGED');
            const result = await window.electronAPI!.agent.updateKnowledge(filePath, args.action, args.knowledge, idToken);
            
            if (result.success) {
                return toolSuccess(result, `Local knowledge saved for ${args.agentId}; it will be read when the next desktop agent execution builds its prompt.`);
            } else {
                return toolError(result.error || "Failed to update memory", "MEMORY_UPDATE_FAILED");
            }
        } catch (error: unknown) {
            return toolError(error instanceof Error ? error.message : String(error), "MEMORY_UPDATE_ERROR");
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const FOUNDATIONAL_TOOL_DECLARATIONS = [
    {
        name: 'audit_architecture',
        description: 'Scans the INDII agent directory to map the current state and capabilities. Use this to audit existing agents and prevent redundant tool creation.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'update_agent_memory',
        description: "Saves or removes a signed-in user's local agent preference for future desktop sessions. Saved notes do not change tool permissions or security policy.",
        parameters: {
            type: 'object',
            properties: {
                agentId: {
                    type: 'string',
                    description: "The ID of the agent to update (e.g., 'merchandise', 'generalist')."
                },
                action: {
                    type: 'string',
                    enum: ['add', 'remove'],
                    description: "Whether to add a new instruction or remove an existing string."
                },
                knowledge: {
                    type: 'string',
                    description: "The specific user preference or note to save."
                }
            },
            required: ['agentId', 'action', 'knowledge']
        }
    }
];
