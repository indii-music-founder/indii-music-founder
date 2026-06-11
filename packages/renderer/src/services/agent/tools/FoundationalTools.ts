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

    /**
     * Updates an agent's persistent procedural knowledge.
     * Use this to remember user preferences or enforce new rules.
     */
    update_agent_memory: wrapTool('update_agent_memory', async (args: {
        agentId: string,
        action: 'add' | 'remove',
        knowledge: string
    }) => {
        try {
            // Construct path based on agentId
            const filePath = `agents/${args.agentId}/instructions.md`;
            
            const result = await window.electronAPI!.agent.updateKnowledge(filePath, args.action, args.knowledge);
            
            if (result.success) {
                return toolSuccess(result, `SYSTEM UPDATE COMPLETE: Changes permanently written to ${args.agentId}.`);
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
        description: "Updates an agent's persistent procedural knowledge (instructions.md). Use this to remember user preferences or enforce new rules across sessions.",
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
                    description: "The specific procedural instruction or rule to persist."
                }
            },
            required: ['agentId', 'action', 'knowledge']
        }
    }
];
